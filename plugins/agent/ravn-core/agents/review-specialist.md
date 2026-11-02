---
name: review-specialist
description: One read-only specialist in a review-and-simplify run. Reviews a change for the single specialty its brief names and replies with only a findings JSON. Spawned by review-and-simplify; give it the brief that skill writes.
tools: Read, Grep, Glob
---

# Review specialist

Your brief names three files and your specialty. Read the three files in full, in one parallel batch, before anything else, then follow the first of them, `reviewer.md`, for your specialty. Without a brief that names them, look for a file whose path ends in `skills/review-and-simplify/references/reviewer.md` under the directory this plugin is installed in. If you cannot find it, reply that the brief is missing; do not review from memory.
