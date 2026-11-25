---
name: ask-ravn
description: >-
  Recommend the ravn-core command or workflow that fits. Use for "which skill
  or command should I use?", "what can ravn-core do?", or "where do I start?".
metadata:
  proof: subjective
---

# Ask Ravn

Recommend the fitting `ravn-core` skill from this map.

## Rules

- **Map only, never run**: end the turn with the recommendation; do not start any recommended skill (including model-invocable ones).
- **Stay inside `ravn-core`**: for another marketplace plugin, say it is outside this map and give no route or invocation form for it.
- **Read before explaining**: read a skill's linked `SKILL.md` before explaining its details or suggesting a step can be skipped.
- **Classify invocation per skill**: check each recommended skill's frontmatter individually. `disable-model-invocation: true` means the user must invoke it; absent or `false` means the model can invoke it automatically when the request matches. Tell the user which applies and give the invocation form for user-invoked skills:

| Harness | Skill invocation | This router |
|---|---|---|
| Cursor | `/<skill>` | `/ask-ravn` |
| Claude Code | `/ravn-core:<skill>` | `/ravn-core:ask-ravn` |
| Codex | `$<skill>` | `$ask-ravn` |
| Pi | `/skill:<skill>` | `/skill:ask-ravn` |
| OpenCode v2 | `/<skill>` | `/ask-ravn` |

## Main flow: idea to ready PR

For an idea that should become one ready PR, recommend [ship](../ship/SKILL.md). It owns the full sequence through a ready PR with all applicable checks passing on its current head. For a PR body alone, recommend [pr](../pr/SKILL.md).

## On-ramps

- **Something is broken:** [bug-fix](../bug-fix/SKILL.md) reproduces the bug, proves its cause with runtime evidence, and delivers a PR whose history shows the failure before the fix (applies [fix-root-causes](../principle-fix-root-causes/SKILL.md)).
- **PR or stack is open and needs to land:** [babysit](../babysit/SKILL.md) discovers repo gates and clears conflicts, review threads, and failing CI; merges only when asked and after an independent verifier passes.
- **Architecture is causing friction:** [improve-codebase-architecture](../improve-codebase-architecture/SKILL.md) surveys deepening opportunities using [codebase-design](../codebase-design/SKILL.md) vocabulary; a chosen change can enter `ship`.
- **Ambitious work no playbook fits:** [figure-it-out](../figure-it-out/SKILL.md) designs a phase plan with a falsifiable done predicate, runs each unit as a keep-or-revert experiment, and commits a decision trail. Use after confirming `ship`, `bug-fix`, and `deprecate-and-migrate` do not fit.
- **Work already started:** [session-pickup](../session-pickup/SKILL.md) finds the resume point from a handoff or prior trail and continues through the fitting skill.

## Standalone work

| Need | Skill |
|---|---|
| Understand current code, ownership, or runtime flow | [how](../how/SKILL.md) |
| Decide where a new seam should go or what one module should expose | [codebase-design](../codebase-design/SKILL.md) |
| Investigate why code has its current shape | [why](../why/SKILL.md) |
| Review a branch, diff, or PR and get one verdict, with safe simplifications applied only when asked | [review-and-simplify](../review-and-simplify/SKILL.md) |
| Learn a diff, branch, or PR well enough to review it | [explain-change](../explain-change/SKILL.md) |
| Test a plan or decision by interview | [grilling](../grilling/SKILL.md) |
| Gather primary-source facts | [research](../research/SKILL.md) |
| Check what a change could break elsewhere | [blast-radius](../blast-radius/SKILL.md) |
| Replace, rename, or remove a function, API, endpoint, or column that still has callers | [deprecate-and-migrate](../deprecate-and-migrate/SKILL.md) |
| Create or audit a guide for driving the real app | [verification-skill](../verification-skill/SKILL.md), `create` or `maintain` |
| Prove a particular property in scope or bring a stale proof back in sync with code | [formal-verification-skill](../formal-verification-skill/SKILL.md), `create` or `maintain` |
| Model-check a TLA+ spec and show each broken rule as the shortest path through a statechart | [statechart](../statechart/SKILL.md) |
| Audit and fix how well a coding agent can work in a repo | [agent-readiness](../agent-readiness/SKILL.md) |
| QA a running web app like a user and report each bug with screenshots and repro steps | [web-qa](../web-qa/SKILL.md) |
| Prune tests that guard no behavior, or install deterministic test guards | [bad-test-terminator](../bad-test-terminator/SKILL.md) |
| Keep a reviewable trail during unattended work | [show-me-your-work](../show-me-your-work/SKILL.md) |
| Check a PR or stack's gates and merge readiness | [babysit](../babysit/SKILL.md) in `check` mode |
| Write a PR body | [pr](../pr/SKILL.md) |
| Write a skill or agent-facing document | [writing-for-agents](../writing-for-agents/SKILL.md) |
| Turn corrections that recur across past sessions into structural fixes, checks, or instructions | [learn-from-sessions](../learn-from-sessions/SKILL.md) |

## Vocabulary and principles

[domain-modeling](../domain-modeling/SKILL.md) owns domain terms and representations; [codebase-design](../codebase-design/SKILL.md) owns module, interface, and seam vocabulary.

Use this table when the user asks for guidance on a specific engineering decision:

| Condition | Principle |
|---|---|
| Debugging a symptom | [fix-root-causes](../principle-fix-root-causes/SKILL.md) |
| Two or more fixes on one premise have failed | [attack-the-premise](../principle-attack-the-premise/SKILL.md) |
| Designing validation, adapters, or types across a module interface | [codebase-design](../codebase-design/SKILL.md) |
| Writing or reviewing TypeScript | [typescript-best-practices](../typescript-best-practices/SKILL.md) |
| Handling retries, restarts, or interrupted mutation | [make-operations-idempotent](../principle-make-operations-idempotent/SKILL.md) |
| Coordinating writers of shared mutable state | [separate-before-serializing-shared-state](../principle-separate-before-serializing-shared-state/SKILL.md) |
| Planning a measurement, or trusting or reporting a benchmark or eval number | [explain-the-number](../principle-explain-the-number/SKILL.md) |
| Checking a finished output | [prove-it-works](../principle-prove-it-works/SKILL.md) |
| Writing, changing, or deleting a test, or a test disagrees with the spec | [test-the-contract](../principle-test-the-contract/SKILL.md) |
| Making the same change in many places, or work a reviewer must rerun | [principle-build-the-lever](../principle-build-the-lever/SKILL.md) (user-invoked) |

## Phase boundaries

At a natural boundary, after recording decisions and proof for the next phase:

- **Continue** while current evidence still fits and the next step depends on it.
- **Clear** when the phase is complete and the next step can start from durable artifacts alone.
- **Compact** when the next step needs a concise summary of decisions, evidence, and open questions (for large reads before compaction, see [Guard the Context Window](../ship/references/guard-the-context-window.md)).
- **Pause or hand off** when asked to stop or transfer work: [pause-safely](../pause-safely/SKILL.md) writes the checkpoint; [session-pickup](../session-pickup/SKILL.md) resumes it. Automatic compaction is not a pause.
- **Use a subagent** for a bounded, independent slice when the active skill calls for one and the harness permits it; the main thread integrates and verifies the result.
