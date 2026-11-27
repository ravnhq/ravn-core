---
name: review
description: >-
  Invoke for any code review or change-safety check ("review this", "review my
  branch", "look over my changes", "check this PR", "what could this break",
  "blast radius of X"). Runs risk-tiered specialist review, caller blast-radius
  analysis, and optional safe simplifications. To teach or walk through a diff,
  use explain-change.
license: See LICENSE.txt
metadata:
  proof: subjective
---

# Review

Adapted from Ravn's Symphony pull request reviewer, Cloudflare's write-up of its AI code reviewer (["Cutting our inference bill by 68%"](https://blog.cloudflare.com/obsessive-inference-optimization/)), and pstack `blast-radius` (MIT License, Copyright (c) 2026 Lauren Tan; see [LICENSE.txt](LICENSE.txt)).

Choose the mode that matches the request (or run both when reviewing a risky shared-code change):

- **Blast radius only** ("what could this break", "blast radius of X", or a small diff you don't trust yet): read and follow [Blast Radius](references/blast-radius.md), then stop.
- **Branch or PR review** (default): follow Steps 1–7 below. If the diff touches shared code, a wire/data format, or a public interface, also run [Blast Radius](references/blast-radius.md) and include its proof in the report.

Resolve `<skill>` to this installed skill's directory. Run every command from the repo root.

**Scope.** With no argument, review the current branch: everything from its merge base to the working tree, uncommitted and untracked files included. With a PR number or URL, review that PR on the engineer's existing `gh` login. Simplifications are applied only when the user asked for them: they asked you to fix or simplify, or passed `--fix`. A plain review request, "report only", or `--no-fix` keeps every finding report-only. `--tier <trivial|lite|full>` forces a tier; `--full` forces a full first review instead of a re-review; `--max-findings <n|all>` changes the report's cap of 20 open findings.

**When a script command fails**, it prints `{"ok": false, "code", "message", "hint"}`. Correct the cause and rerun. After two failed corrections, do that step by hand under the same contract and name it as done by hand in your report.

## Step 1. Gather the change

Make a temporary directory for this run, `<run>`. Every diff below uses `<diff-flags>`: `--no-color --no-ext-diff -M --src-prefix=a/ --dst-prefix=b/`.

**Branch.** Take the base from the user, or else the default branch from `git symbolic-ref --short refs/remotes/origin/HEAD`. Fetch it, then run as one shell call:

```bash
mb=$(git merge-base <base> HEAD)
git diff <diff-flags> "$mb" > <run>/diff.patch
git ls-files -z --others --exclude-standard |
  xargs -0 -I{} git diff <diff-flags> --no-index -- /dev/null {} >> <run>/diff.patch   # exit 1 per file is normal
git status --porcelain                                      # the user's uncommitted files; keep for Step 5
```

The head checkout is the repo root, and `<head>` is `git rev-parse HEAD`.

**Pull request.** Read `gh pr view <pr> --json number,url,headRefOid,baseRefName,author`. Fetch with `git fetch origin <baseRefName> pull/<pr>/head`. Then `<merge-base>` is `git merge-base origin/<baseRefName> <headRefOid>` and `<head>` is `headRefOid`. Write `git diff <diff-flags> <merge-base> <head> > <run>/diff.patch`. When `HEAD` is `<head>` and `git status --porcelain` is empty, the head checkout is the repo root. Otherwise create one with `git -c core.symlinks=false worktree add --detach <run>/head <head>`.

**Guidance.** Write `<run>/guidance.md` from the merge base: every `AGENTS.md`, `CLAUDE.md`, `REVIEW.md`, and `.claude/rules/*` at the root or in a directory that holds a changed file. List them with `git ls-tree -r --name-only <merge-base>`, then write each as a `## <path>` heading followed by `git show <merge-base>:<path>`. Use an empty file when none exist.

**Re-review.** The state file is `$(git rev-parse --git-common-dir)/review-and-simplify/<key>.json`, with `<key>` as the branch name or `pr-<number>`, `/` replaced by `-`. When it exists, the user did not pass `--full`, its `merge_base` equals `<merge-base>`, and `git merge-base --is-ancestor <saved head> <head>` succeeds, this run is a re-review. Write the changes since then to `<run>/increment.patch`. An empty increment means nothing changed: say so and stop, unless the user asks for `--full`.

## Step 2. Pick the tier

```bash
node <skill>/scripts/review.ts tier <run>/increment.patch   # re-review; otherwise <run>/diff.patch
```

Add `--tier` when the user forced one. Save the JSON as `<run>/tier.json`. Drop `release` when no changed file is a build, dependency, CI, container, migration, or runtime-configuration file, and `engineering_standards` when `guidance.md` is empty. On a re-review, also drop one whose specialty the increment gives nothing to check and that has no open previous finding. `security` always runs when listed.

## Step 3. Run the specialists

Give every specialist the same brief, identical up to its last line, so the requests share a cached prefix:

```text
You are a review specialist. Before anything else, read these three files in full, in one parallel batch, then follow the first one:
- <skill>/references/reviewer.md
- <run>/guidance.md
- <run>/diff.patch
Head checkout: <checkout>
Specialty: <name>
```

On a re-review, the third file is `<run>/increment.patch`. For TypeScript diffs, also check [TypeScript Best Practices](../design/references/typescript.md).

On the `trivial` tier, run the one `code_quality` pass yourself from the same brief; Steps 4 to 7 still apply. On other tiers, spawn each specialist as a fresh read-only subagent on the model its class names in [models.md](references/models.md):

- **Claude Code:** the Agent tool with `ravn-core:review-specialist` (or `review-specialist` where installed as a project agent).
- **Codex:** `spawn_agent` with the brief as its message.
- **A harness without subagents:** read the three files once, then run each specialist's pass yourself in turn.

Spawn the first specialist of each model class, then the rest together in your next message without waiting. Retry refused spawns as running ones finish. A reply that is not the findings JSON gets one follow-up asking for only the JSON.

## Step 4. Judge

Judge the combined findings into `<run>/judged.json`, as `{"findings": [...]}`. Each finding carries `specialist` plus the fields in [reviewer.md](references/reviewer.md#output):

- Deduplicate issues raised by multiple specialists under the best-fitting specialty and list others in `also_raised_by`.
- Move misfiled findings to the right specialty and set severity from demonstrated impact.
- Drop speculative findings, nitpicks, false positives, and findings that contradict `guidance.md`.
- Keep `replacement` only when it is exact code for the anchored lines.
- On a re-review, read the code at each previous finding's anchor; drop fixed ones and re-emit unfixed ones at their current anchor.

## Step 5. Apply simplifications

When `simplify` ran and you kept any of its findings, follow [simplify.md](references/simplify.md).

## Step 6. Check

```bash
node <skill>/scripts/review.ts check <run>/diff.patch <run>/judged.json --commit <head>
```

Add `--max-findings <n>` or `--max-findings all` when requested. Check against `<run>/diff.patch` even on a re-review. Done when it exits 0.

## Step 7. Report

Save `{"head": "<head>", "merge_base": "<merge-base>", "findings": [...]}` to the state file, keeping only findings whose status is not `applied`.

Reply with the `report` from Step 6 as it is, verdict line first, then the tier and why, specialists run/skipped/failed, and any applied simplifications' `git diff --stat` and passing checks.

Post to the pull request only when the user asks (always event `COMMENT`):

- **Pull request:** `gh api --method POST repos/<owner>/<repo>/pulls/<number>/reviews --input <run>/github-review.json`.
- **Branch:** confirm `gh pr view --json number,url,headRefOid` matches `<head>` and working tree was clean; otherwise tell the user to push and review again.

Finish by removing `<run>`, and `git worktree remove --force <run>/head` when you created it.
