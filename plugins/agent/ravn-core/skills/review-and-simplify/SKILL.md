---
name: review-and-simplify
description: Review the current branch or a GitHub PR with risk-tiered specialist subagents in your own harness and model family, judge their findings, apply safe simplifications on your own branch, and post to the PR on request.
disable-model-invocation: true
metadata:
  proof: subjective
---

# Review and Simplify

Adapted from Ravn's Symphony pull request reviewer and Cloudflare's write-up of its AI code reviewer (["Cutting our inference bill by 68%"](https://blog.cloudflare.com/obsessive-inference-optimization/)).

You are the **coordinator**. A script picks the change's risk tier. Specialists run in parallel, each reviewing one specialty against the same inputs. You judge their findings, apply the simplifications that are safe to apply, and report one verdict. Every specialist runs in your own harness on your own model family, per [models.md](references/models.md).

Resolve `<skill>` to this installed skill's directory. Run every command from the repo root.

**Scope.** With no argument, review the current branch: everything from its merge base to the working tree, uncommitted and untracked files included. With a PR number or URL, review that PR on the engineer's existing `gh` login. "Report only" or `--no-fix` keeps every finding report-only. `--tier <trivial|lite|full>` forces a tier; `--full` forces a full first review instead of a re-review; `--max-findings <n|all>` changes the report's cap of 20 open findings.

**When a script command fails**, it prints `{"ok": false, "code", "message", "hint"}`. Read the code and the hint, correct the cause (a wrong path, an empty or partial diff, a malformed findings file, a misplaced anchor), and run the command again. After two failed corrections, do that step by hand under the same contract and name the step as done by hand in your report.

## Step 1. Gather the change

Make a temporary directory for this run, `<run>`. Every diff below uses `<diff-flags>`: `--no-color --no-ext-diff -M --src-prefix=a/ --dst-prefix=b/`, which hold the output steady whatever the user's git config says.

**Branch.** Take the base from the user, or else the default branch from `git symbolic-ref --short refs/remotes/origin/HEAD`. Fetch it, then run this as one shell call:

```bash
mb=$(git merge-base <base> HEAD)
git diff <diff-flags> "$mb" > <run>/diff.patch
git ls-files -z --others --exclude-standard |
  xargs -0 -I{} git diff <diff-flags> --no-index -- /dev/null {} >> <run>/diff.patch   # exit 1 per file is normal
git status --porcelain                                      # the user's uncommitted files; keep it for Step 5
```

The head checkout is the repo root, and `<head>` is `git rev-parse HEAD`.

**Pull request.** Read `gh pr view <pr> --json number,url,headRefOid,baseRefName,author`. Fetch with `git fetch origin <baseRefName> pull/<pr>/head`. Then `<merge-base>` is `git merge-base origin/<baseRefName> <headRefOid>` and `<head>` is `headRefOid`. Write `git diff <diff-flags> <merge-base> <head> > <run>/diff.patch`. When `HEAD` is `<head>` and `git status --porcelain` is empty, the head checkout is the repo root. Otherwise create one with `git -c core.symlinks=false worktree add --detach <run>/head <head>`, so a symlink in the change cannot point a reader outside it.

**Guidance.** Write `<run>/guidance.md` from the merge base, so the guidance the change is judged by comes from before it: every `AGENTS.md`, `CLAUDE.md`, `REVIEW.md`, and `.claude/rules/*` at the root or in a directory that holds a changed file. List them with `git ls-tree -r --name-only <merge-base>`, then write each, in one shell loop, as a `## <path>` heading followed by `git show <merge-base>:<path>`. Use an empty file when none exist.

**Re-review.** The state file is `$(git rev-parse --git-common-dir)/review-and-simplify/<key>.json`, with `<key>` as the branch name or `pr-<number>`, `/` replaced by `-`. When it exists, the user did not pass `--full`, its `merge_base` equals `<merge-base>`, and `git merge-base --is-ancestor <saved head> <head>` succeeds, this run is a re-review. Write the changes since then to `<run>/increment.patch`: `git diff <diff-flags> <saved head>` with untracked files appended for a branch, or `git diff <diff-flags> <saved head> <head>` for a pull request. Specialists review the increment, and the state's `findings` are the previous findings. An empty increment means nothing changed since the last review: say so, and stop unless the user asks for `--full`.

Done when `<run>/diff.patch` holds the whole change and `<run>/guidance.md` exists.

## Step 2. Pick the tier

```bash
node <skill>/scripts/review.ts tier <run>/increment.patch   # re-review; otherwise <run>/diff.patch
```

Add `--tier` when the user forced one. Save the JSON as `<run>/tier.json`. It lists `specialists`, each with a `model` class, and the `files` they review. A sensitive path or more than 50 files gives `full` (all eight). At most 10 changed lines in at most 20 files gives `trivial` (`code_quality`). At most 100 lines in at most 20 files gives `lite` (`code_quality`, `documentation`, `engineering_standards`, `agents_md`, `simplify`). Anything else is `full`.

Drop a listed specialist that has nothing to review: `release` when no changed file is a build, dependency, CI, container, migration, or runtime-configuration file, and `engineering_standards` when `guidance.md` is empty. On a re-review, also drop one when the increment gives its specialty nothing to check and no previous finding of its specialty is still open. `security` always runs when listed.

## Step 3. Run the specialists

Give every specialist the same brief, byte for byte up to its last line, so the requests share a cached prefix:

```text
You are a review-and-simplify specialist. Before anything else, read these three files in full, in one parallel batch, then follow the first one:
- <skill>/references/reviewer.md
- <run>/guidance.md
- <run>/diff.patch
Head checkout: <checkout>
Specialty: <name>
```

On a re-review, the third file is `<run>/increment.patch`.

On the `trivial` tier, run the one `code_quality` pass yourself from the same brief instead of spawning it, since a change that small does not repay a subagent's setup and reads. Write its findings JSON down as a specialist's reply; Steps 4 to 7 still apply.

On the other tiers, spawn each specialist as a fresh read-only subagent, not a fork of your conversation, on the model its class names in [models.md](references/models.md):

- **Claude Code:** the Agent tool with ravn-core's read-only `review-specialist` agent: `ravn-core:review-specialist` from the plugin, or `review-specialist` where it is installed as a project agent.
- **Codex:** `spawn_agent` with the brief as its message.
- **A harness without subagents:** read the three files once, then run each specialist's pass yourself in turn, changing only the specialty, and write its reply down before you start the next.

Spawn the first specialist of each model class, then the rest together in your next message without waiting for the first ones to finish, so the later requests can reuse the prefix the first ones cache. Wait for every reply. Harnesses cap how many subagents run at once (Codex's `agents.max_concurrent_threads_per_session`, for one): when a spawn is refused, spawn that specialist again as soon as a running one replies, and when none will start, run its pass yourself as a harness without subagents does. A reply that is not the findings JSON gets one follow-up asking for only the JSON.

Done when you hold a valid findings reply, from a subagent or your own pass, for every specialist you did not drop in Step 2. Report a specialist as run only when you hold its reply; one without a reply is failed.

## Step 4. Judge

Judge the combined findings into `<run>/judged.json`, as `{"findings": [...]}`. Each finding carries `specialist` plus the fields in [reviewer.md](references/reviewer.md#output):

- Keep an issue that several specialists raised at one location once, under the specialty that fits it best, and list the others in `also_raised_by`.
- Move a finding filed under the wrong specialty to the right one.
- Set each severity from the impact the finding demonstrates, whatever its specialist chose. A `suggestion` that shows a concrete security or correctness impact, such as a token written to logs, rises to that impact.
- Drop speculative findings, nitpicks, false positives, and findings that contradict `guidance.md`. When unsure, read the code to settle it.
- Keep a `replacement` only when it is exact code for the anchored lines.
- On a re-review, read the code at each previous finding's anchor. Drop the ones the code now fixes. Re-emit the ones still unfixed, at their anchor in the current diff. Re-emit one whose PR thread a person resolved only when the issue has grown worse, at the higher severity.

Done when every specialist finding is kept, merged, moved, or dropped for a reason you can state.

## Step 5. Apply simplifications

When `simplify` ran and you kept any of its findings, follow [simplify.md](references/simplify.md). It decides whether they apply. When they do, it applies them, proves the repo's checks still pass, and marks each one `applied` or `reverted` in `<run>/judged.json`.

## Step 6. Check

```bash
node <skill>/scripts/review.ts check <run>/diff.patch <run>/judged.json --commit <head>
```

Add `--max-findings <n>` or `--max-findings all` when the user asked for a different cap.

Always check against `<run>/diff.patch`, the diff from Step 1, which is the one GitHub shows. It rejects any finding whose anchor is outside that diff's hunks and names each rejection. It drops exact duplicates, keeps the 20 most severe open findings (applied simplifications always stay) and reports how many it left out, and computes the verdict: `request_changes` for any critical, `comment` for any warning, otherwise `approve`. Applied simplifications do not count. Its output carries the `report` Markdown, and it writes `report.md` and `github-review.json` beside `judged.json`.

Done when it exits 0.

## Step 7. Report

Save `{"head": "<head>", "merge_base": "<merge-base>", "findings": [...]}` to the state file, keeping only findings whose status is not `applied`.

Reply with the `report` from Step 6 as it is, its verdict line first, then the tier and why, the specialists that ran, were skipped, or failed, and for applied simplifications their `git diff --stat` and the checks that passed.

Post to the pull request only when the user asks:

- **Pull request:** `gh api --method POST repos/<owner>/<repo>/pulls/<number>/reviews --input <run>/github-review.json`.
- **Branch:** first find its pull request with `gh pr view --json number,url,headRefOid`. Post only when `headRefOid` is `<head>` and Step 1's `git status --porcelain` was empty, so every anchor exists on GitHub. Otherwise tell the user to push and review again.

The review's event is always `COMMENT`: the verdict is text, and the review never approves or blocks. Report the posted review's `html_url`.

Finish by removing `<run>`, and `git worktree remove --force <run>/head` when you created it.
