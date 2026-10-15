# why anchor script

`anchor.ts` turns a file and line range into blame commits, PR numbers, ticket IDs, and PR details as JSON.

## Sub-features

- `anchor.file`: anchor a whole file.
- `anchor.lines`: anchor a line range with `--lines a,b`.
- `anchor.gaps`: missing `gh` data is listed in `gaps`, not fatal.

## How to get to it (user POV)

- The `why` skill runs it in step 2 inside the user's repo.

## Driving it with node

Preconditions: inside a git repo with history; `gh auth status` ok.

- `anchor.file`: `node scripts/collect.ts why-anchor-file node plugins/agent/ravn-core/skills/why/scripts/anchor.ts CLAUDE.md`. Expect exit 0, `"lines": null`, and non-empty `commits` in `stdout.txt`.
- `anchor.lines`: `node scripts/collect.ts why-anchor node plugins/agent/ravn-core/skills/why/scripts/anchor.ts README.md --lines 1,10`. Expect exit 0, non-empty `commits` and `prNumbers`, and empty `gaps`.
- `anchor.gaps`: hide `gh` from PATH: `node scripts/collect.ts why-anchor-gaps env PATH=/usr/bin:/bin "$(command -v node)" plugins/agent/ravn-core/skills/why/scripts/anchor.ts README.md --lines 1,10`. Expect exit 0 and one `gh pr view <N> failed` entry in `gaps` per PR number.

## Gotchas

- Unit tests live in `test/ravn-core/why/`; they do not replace a run on real history.
- `anchor.ts` exits 2 without a file argument and throws (exit 1) when `git blame` or `git log` fails.
