---
name: research
description: Research a topic or API question from primary sources and save cited findings in the repo. Use for requested research or delegated reading.
license: See LICENSE.txt
metadata:
  proof: subjective
---

Delegate substantial reading when it would crowd the main context; do small lookups inline. Use a **background agent** while independent work continues, and foreground delegation when its result is needed to finish this turn. Collect asynchronous completion before delivering the research. If subagents are unavailable, research inline. Brief it with the question, known facts and sources, scope, and the file contract below.

Its job:

1. Investigate the question against **primary sources** (official docs, source code, specs, first-party APIs), not a secondary write-up of them. Follow every claim back to the source that owns it. For dependency behavior, open its official documentation or implementation; local configuration and comments establish intent, not external runtime semantics. Attempt retrieval before calling a source unavailable, and label unopened sources as further reading rather than verified evidence.
2. Write the findings to a single Markdown file, citing each claim's source.
3. Save it where the repo already keeps such notes; match the existing convention, and if there is none, put it somewhere sensible and say where.

Finish after collecting the result and checking that the file answers the question with cited findings or explicit gaps; report the answer and file path for a reader who has not seen the research.
