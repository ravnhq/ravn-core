# Code Archaeology (git + in-repo)

The most trustworthy source, tied directly to the code. It covers commits, PR descriptions and review threads (via `gh`), inline comments (TODO, FIXME, deprecation notes), ADRs if the repo keeps them, tests (names and assertions often encode the edge cases that motivated a change), co-changed files, CHANGELOG and release notes, and ticket IDs in commit messages and PR bodies.

## How to search it

```bash
# History through renames
git log --follow --oneline -- <file>

# Pickaxe: commits that added or removed this exact text, or matched a regex
git log -S '<exact_string_from_code>' -- <file>
git log -G '<regex>' -- <file>

# Who wrote each line and when
git blame -L <start>,<end> <file>

# One commit's full diff
git show <hash>

# Commits between two points affecting this file
git log <old>..<new> -p -- <file>

# ADRs often live in docs/adr/ or similar
rg -l -i 'architecture.decision' --glob '*.md'

# TODOs and FIXMEs near the target
rg -n -C2 '(TODO|FIXME|HACK|XXX|NOTE)' <target_file>

# Related tests
rg -l '<symbol>' --glob '*test*'
```
