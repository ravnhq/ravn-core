---
name: ask-ravn
description: >-
  Recommend the ravn-core skill or workflow that fits. Invoke for "which skill
  or command should I use?", "what can ravn-core do?", or "where do I start?".
metadata:
  proof: subjective
---

# Ask Ravn

Route only to ravn-core's own skills linked in this map. For another marketplace plugin, say it is outside this map and keep the advice within ravn-core.

Use these invocation forms, replacing `<skill>` with the recommended skill's frontmatter `name`:

| Harness | Skill invocation | This router |
|---|---|---|
| Cursor | `/<skill>` | `/ask-ravn` |
| Claude Code | `/ravn-core:<skill>` | `/ravn-core:ask-ravn` |
| Codex | `$<skill>` | `$ask-ravn` |
| Pi | `/skill:<skill>` | `/skill:ask-ravn` |
| OpenCode v2 | `/<skill>` | `/ask-ravn` |

This map points to skills; it does not run them. End the turn with the map: start none of the recommended skills, model-invocable ones included, so the user picks what runs. Before explaining what a skill does or suggesting that a step can be skipped, read its linked `SKILL.md`. Classify invocation from each recommended skill's own frontmatter: `disable-model-invocation: true` requires human invocation; an absent or false flag means model-invocable and may start when the request matches it. Tell the user, for each skill you recommend, whether it starts on its own or they invoke it, and give the invocation form for the ones they invoke.

## One skill per job

### Model-invoked (start on their own when a request matches)

| Need | Skill |
|---|---|
| Understand how this repo's code works or why it was built that way | [codebase-qa](../codebase-qa/SKILL.md) |
| Look up external docs, specs, or third-party library behavior | [research](../research/SKILL.md) |
| Design a module seam, settle domain terms/GLOSSARY/ADRs, TypeScript types, idempotency/shared state, or survey refactor candidates | [design](../design/SKILL.md) |
| Reproduce, root-cause, and fix a bug, crash, or repeated failed premise | [debug](../debug/SKILL.md) |
| Write, fix, or prune tests, or install Oxlint test guards | [test](../test/SKILL.md) |
| Review a branch/diff/PR for bugs, simplifications, or caller blast radius | [review](../review/SKILL.md) |
| Teach/walk through a diff, branch, or PR with diagrams and a quiz | [explain-change](../explain-change/SKILL.md) |
| Prove a change works on the real artifact, or vet a benchmark/eval number | [verify](../verify/SKILL.md) |
| Explore and QA a running web app like a user with screenshots and repros | [web-qa](../web-qa/SKILL.md) |
| Model-check a TLA+ spec and draw a Mermaid statechart with counterexample paths | [statechart](../statechart/SKILL.md) |
| Rename, replace, or remove an API with callers, or build a codemod/script lever | [migrate](../migrate/SKILL.md) |
| Pause work into a handoff note, or resume from a handoff/transcript/branch | [handoff](../handoff/SKILL.md) |

### User-invoked (`disable-model-invocation: true` — invoke explicitly)

| Need | Skill |
|---|---|
| Take a change end-to-end from idea to a ready PR with passing CI | [ship](../ship/SKILL.md) |
| Draft/update a PR body (with screenshots) or babysit an open PR/stack to merge-ready | [pr](../pr/SKILL.md) |
| Stress-test a plan (`grill`), design an auditable phase plan, or keep a decision log | [plan](../plan/SKILL.md) |
| Audit repo agent-readiness, author skills/`AGENTS.md`, or mine past sessions for lessons | [agent-ops](../agent-ops/SKILL.md) |
| Create or maintain a project guide that drives the real app and preserves evidence | [verification-skill](../verification-skill/SKILL.md) |
| Create or resync a project guide that formally checks a named property against code | [formal-verification-skill](../formal-verification-skill/SKILL.md) |
| Deepen a prompt using project evidence without carrying it out | [promptify](../promptify/SKILL.md) |

## Phase boundaries

- **Continue** in this session while current evidence and decisions still fit.
- **Clear** context when the phase is complete and the next step starts from durable artifacts alone.
- **Compact** when the next step needs a concise account of decisions and open questions. For large reads before compaction, point to [Guard the Context Window](../ship/references/guard-the-context-window.md).
- **Pause or resume:** [handoff](../handoff/SKILL.md) owns both writing checkpoints and resuming from them. Automatic compaction is not a pause.
