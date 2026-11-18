---
name: why
description: >-
  Use for 'why does X work this way', 'why we picked Y', design rationale,
  regressions, postmortems, or data-backed thresholds. Returns a cited read
  on decisions and tradeoffs. Use how for runtime behavior.
license: See LICENSE.txt
---

# Why

Adapted from pstack `why`, MIT License, Copyright (c) 2026 Lauren Tan. See [LICENSE.txt](LICENSE.txt).

Answer from the record, not the code: read the commits and PR discussions that introduced the target and each later change, and other sources if the trail is thin. Cite what the authors wrote, mark your own inferences as inferences, and say what the record does not answer.

If the history spans many commits or the first search returns large output, read [Guard the Context Window](../ship/references/guard-the-context-window.md) before expanding the search. Keep enough of the original record to check each citation.
