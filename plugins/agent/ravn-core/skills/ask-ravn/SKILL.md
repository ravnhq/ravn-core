---
name: ask-ravn
description: >-
  Recommend the ravn-core command or workflow that fits. Use for "which skill
  or command should I use?", "what can ravn-core do?", or "where do I start?".
metadata:
  proof: subjective
---

# Ask Ravn

Route only to ravn-core's own skills linked in this map. For another marketplace plugin, say it is outside this map and keep the advice within ravn-core: give no route or invocation form for it, and leave the map as it is.

Use these invocation forms, replacing `<skill>` with the recommended skill's frontmatter `name`:

| Harness | Skill invocation | This router |
|---|---|---|
| Cursor | `/<skill>` | `/ask-ravn` |
| Claude Code | `/ravn-core:<skill>` | `/ravn-core:ask-ravn` |
| Codex | `$<skill>` | `$ask-ravn` |
| Pi | `/skill:<skill>` | `/skill:ask-ravn` |
| OpenCode v2 | `/<skill>` | `/ask-ravn` |

This map points to skills; it does not run them. End the turn with the map: start none of the recommended skills, model-invocable ones included, so the user picks what runs. Its descriptions are orientation only: before explaining what a skill does or suggesting that a step can be skipped, read its linked `SKILL.md`. Classify invocation from each recommended skill's own frontmatter, one skill at a time, including skills grouped in the same flow or section: `disable-model-invocation: true` requires human invocation; an absent or false flag means model-invocable and may start when the request matches it, even without the user naming it ("pause for now" can trigger `pause-safely`). Tell the user, for each skill you recommend, whether it starts on its own or they invoke it, and give the invocation form for the ones they invoke.

## Main flow: idea to ready PR

For an idea that should become one ready PR, recommend [ship](../ship/SKILL.md). It owns the sequence: read it to identify the next phase and any approval that phase needs. The artifact is a ready PR with all applicable checks passing on its current head, including checks that only run after readiness. For a PR body alone, recommend [pr](../pr/SKILL.md).

## On-ramps

- **Something is broken:** [bug-fix](../bug-fix/SKILL.md) reproduces the bug, finds its cause with runtime evidence, and delivers the fix as a PR whose history shows the failure before the fix. It applies [fix-root-causes](../principle-fix-root-causes/SKILL.md) throughout.
- **PR or stack is open and needs to land:** [babysit](../babysit/SKILL.md) brings it to merge-ready or an evidenced blocker: it discovers the repository gates and clears conflicts, review threads, and failing CI. It merges only when the user asks it to, and only after an independent verifier passes the PR.
- **Architecture is causing friction:** [improve-codebase-architecture](../improve-codebase-architecture/SKILL.md) surveys deepening opportunities. A chosen change can enter `ship` at goal shaping; [codebase-design](../codebase-design/SKILL.md) supplies its design vocabulary.
- **Ambitious work no playbook fits:** [figure-it-out](../figure-it-out/SKILL.md) designs a phase plan with a falsifiable done predicate before any code, runs each unit as an experiment it keeps or reverts, and commits the decision trail. Use it for a multi-part change across packages or a long unattended run, after checking that `ship`, `bug-fix`, and `deprecate-and-migrate` do not fit.
- **Work already started:** [session-pickup](../session-pickup/SKILL.md) finds the resume point from a handoff or prior trail, then continues the unfinished work through the fitting skill or flow.

## Standalone work

Use these without the whole `ship` flow:

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

## Vocabulary and principles underneath

[domain-modeling](../domain-modeling/SKILL.md) owns domain terms and representations; [codebase-design](../codebase-design/SKILL.md) owns the vocabulary for modules, interfaces, and seams. They can support a flow or answer a focused design request.

Use this table only when the user asks for guidance on one of these decisions. Point to the owning skill when the guidance is disclosed within it:

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
| Making the same change in many places, or work a reviewer must rerun | [ship](../ship/SKILL.md)'s [build-the-lever reference](../ship/references/build-the-lever.md) |

## Phase boundaries

Choose at a natural boundary, after recording any decisions and proof the next phase needs:

- **Continue** in this session while the current evidence and decisions still fit and the next step depends on them.
- **Clear** the context when the phase is complete and the next step can start from durable artifacts alone.
- **Compact** when the next step still needs a concise account of decisions, evidence, and open questions. For large reads before compaction, point to [Guard the Context Window](../ship/references/guard-the-context-window.md).
- **Pause or hand off** when asked to stop or transfer work: [pause-safely](../pause-safely/SKILL.md) writes the checkpoint; [session-pickup](../session-pickup/SKILL.md) resumes it. Automatic compaction is not a pause.
- **Use a subagent** for a bounded, independent slice when the active skill calls for one and the harness permits it. Keep the main thread responsible for integrating and checking the result.

Only model-invocable skills can start on their own. For a user-invoked skill named here, this map hints that the human invoke it; the router cannot fire it.
