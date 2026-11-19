---
name: research
description: >-
  Look up or research a question against primary sources — official docs,
  source code, specs — and save the cited findings as Markdown in the repo.
  Use before answering any question about how a third-party library, API, or
  framework behaves, including quick ones ("research whether X", "look up
  Y's official docs, defaults, or behavior", "what's the default", "how does
  Y retry"), and for reading legwork for a background agent. Use why for
  this repo's own history.
license: See LICENSE.txt
metadata:
  proof: subjective
---

Spin up a **background agent** to do the research, so you keep working while it reads. If your harness cannot spawn one, do the research yourself before continuing.

Its job:

1. Investigate the question against **primary sources** (official docs, source code, specs, first-party APIs), not a secondary write-up of them. Follow every claim back to the source that owns it. Start from what this repo already contains: quote the local code, config, and comments that raised the question, and never assume a file or setting the repo does not contain.
2. Write the findings to a single Markdown file, citing each claim's source.
3. Save it where the repo already keeps such notes; match the existing convention, and if there is none, put it somewhere sensible and say where.

The note leads with what the repo already shows — the local code, config, and comments, quoted — then what the primary sources say, each claim cited. Say where you saved it.
