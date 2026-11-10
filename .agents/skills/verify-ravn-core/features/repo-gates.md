# Repo gates without private evals

With `evals/private/` absent, `pnpm check` says the eval configs were NOT checked and names `pnpm eval:fetch` as the fix, `evals/run.ts` stops before any runner starts, and the `validate` skill fetches the private evals first and still runs `pnpm check` when the fetch fails.

## Sub-features

- `repo-gates-skip`: each eval-config test skipped by `node --test` carries the reason `eval configs NOT checked: private evals are not fetched; run pnpm eval:fetch, then pnpm check`.
- `repo-gates-check`: `pnpm check` exits 0 and prints that same reason.
- `repo-gates-run-stops`: `evals/run.ts` exits 1 before it starts promptfoo, so it spends no tokens.
- `repo-gates-run-reason`: with a private eval config but no fixtures, `evals/run.ts` throws the same eval-config text.
- `repo-gates-fetch`: `GIT_TERMINAL_PROMPT=0 pnpm eval:fetch` fails without private access, and the `pnpm check` after it still runs.
- `repo-gates-validate-step`: the `validate` skill contains the fetch step with its continue-on-failure note.

## How to get to it (user POV)

- A contributor without access to `ravnhq/ravn-core-evals` clones the repo, runs `pnpm install`, then `pnpm check`. The output must say the eval configs were not checked, not pass silently.
- The same contributor runs `pnpm eval` or `pnpm eval:smoke`. It must stop with an error before it spends tokens.
- Someone runs the `validate` skill's step 1 without deploy-key access. The fetch fails, and the skill continues to `pnpm check`.

## Driving it with pnpm and node

Preconditions: a checkout or worktree with no `evals/private/` directory, and `pnpm install --frozen-lockfile` done. Run every command from the repo root. Never run `pnpm eval` or `pnpm eval:compare` for this feature; the `run.ts` commands below stop before any runner starts.

- `repo-gates-skip`: `node .agents/skills/verify-ravn-core/scripts/collect.ts repo-gates-skip node --test --test-reporter=tap test/evals/configs.test.ts`. Expect exit 0. Count the skip lines in `stdout.txt`: `grep "# SKIP" stdout.txt | grep -vc "NOT checked"` prints 0, and `grep -c "NOT checked" stdout.txt` prints a number above 0. Quote one `# SKIP` line.
- `repo-gates-check`: `node .agents/skills/verify-ravn-core/scripts/collect.ts repo-gates-check pnpm check`. Expect exit 0 and quote one `NOT checked` line from `stdout.txt`.
- `repo-gates-run-stops`: `mkdir -p /tmp/ravn-verify/$RUN_ID/evals-tmp`, then `node .agents/skills/verify-ravn-core/scripts/collect.ts repo-gates-run-stops env TMPDIR=/tmp/ravn-verify/$RUN_ID/evals-tmp node evals/run.ts --runners codex/gpt-6-luna`. Expect exit 1, a `stderr.txt` error, and an empty `stdout.txt`. Also expect no `ravn-skills-evals-*` directory under the TMPDIR, because this path stops before the run's temp dir is made.
- `repo-gates-run-reason` (throwaway worktree only): create a stub private config, then run `evals/run.ts` against it:

  ```bash
  mkdir -p evals/private/ravn-core/stubskill && : > evals/private/ravn-core/stubskill/promptfooconfig.ts
  mkdir -p /tmp/ravn-verify/$RUN_ID/evals-tmp
  node .agents/skills/verify-ravn-core/scripts/collect.ts repo-gates-run-reason env TMPDIR=/tmp/ravn-verify/$RUN_ID/evals-tmp node evals/run.ts --runners codex/gpt-6-luna --skills stubskill
  rm -rf evals/private
  ```

  Expect exit 1 and `stderr.txt` to hold `Error: eval configs NOT checked: private evals are not fetched; run pnpm eval:fetch, then pnpm check`. Remove `evals/private/` before any `pnpm check` in the same tree.
- `repo-gates-fetch`: `node .agents/skills/verify-ravn-core/scripts/collect.ts repo-gates-fetch sh -c 'GIT_TERMINAL_PROMPT=0 RAVN_EVALS_PRIVATE_URL=/nonexistent/ravn-core-evals.git pnpm eval:fetch; pnpm check'`. Expect `fatal: repository '/nonexistent/ravn-core-evals.git' does not exist` in `stdout.txt` or `stderr.txt`, and exit 0 from the `pnpm check` that ran after it.
- `repo-gates-validate-step`: `node .agents/skills/verify-ravn-core/scripts/collect.ts repo-gates-validate-step grep -n "eval:fetch" .agents/skills/validate/SKILL.md`. Expect exit 0 with the fetch line and the continue-on-failure note. On `main`, expect exit 1, because the step is absent.

## Gotchas

- With `evals/private/` absent, `evals/run.ts` never reaches the eval-config text. It stops first at the `--skills` check (`Unknown --skills value(s): . Known: `), or at the `CLAUDE_CODE_OAUTH_TOKEN` check when that is unset. The eval-config text needs a private config without fixtures, which is why `repo-gates-run-reason` uses a stub.
- `run.ts` copies `~/.codex/auth.json` into its temp dir before it throws, and the throw never removes that copy. Always set `TMPDIR` under `/tmp/ravn-verify/$RUN_ID`, so `cleanup.ts` deletes it.
- `repo-gates-fetch` points the fetch at a local path that does not exist, so it does not touch the network. `eval:fetch` only pulls when `evals/private/.git` already exists; a fresh worktree has none.
- `pnpm check` on `main` also exits 0 with the silent skip. The new reason, not the exit code, separates the two.
