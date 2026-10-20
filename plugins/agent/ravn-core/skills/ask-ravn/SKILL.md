---
name: ask-ravn
description: Find the ravn-core skill or flow that fits your work.
disable-model-invocation: true
metadata:
  proof: subjective
---

# Ask Ravn

Route only to ravn-core's own skills linked in this map. When asked for another marketplace plugin, explain that it is outside this map and keep the advice within ravn-core. Do not supply other-plugin routes or invocation guidance, or propose extending the map to include them.

Use these invocation forms, replacing `<skill>` with the recommended skill's frontmatter `name`:

| Harness | Skill invocation | This router |
|---|---|---|
| Cursor | `/<skill>` | `/ask-ravn` |
| Claude Code | `/ravn-core:<skill>` | `/ravn-core:ask-ravn` |
| Codex | `$<skill>` | `$ask-ravn` |
| Pi | `/skill:<skill>` | `/skill:ask-ravn` |

Use this map to choose a ravn-core skill. It points to skills; it does not run them. Before explaining what a skill does or suggesting that a step can be skipped, read its linked `SKILL.md`. The descriptions here are only orientation. Classify invocation from each skill's own frontmatter: `disable-model-invocation: true` requires human invocation; an absent or false flag means model-invocable and may start when the request matches it. A trigger requiring an explicit user request still permits model invocation: "pause for now" can trigger `pause-safely` without the user naming the skill. Check each recommended skill separately, including skills grouped in the same flow or section.

## Main flow: idea to ready PR

Start with [ship](../ship/SKILL.md) when an idea or requested change should become a ready pull request with verified results and passing CI. `ship` owns the sequence and the conditions for skipping a step:

1. Shape the goal, then inspect the code with [how](../how/SKILL.md) for behavior and [why](../why/SKILL.md) for rationale. Use [research](../research/SKILL.md) when external documentation or API facts matter.
2. Settle assumptions through [grilling](../grilling/SKILL.md). Use [domain-modeling](../domain-modeling/SKILL.md) when terms or state representations need work, and [codebase-design](../codebase-design/SKILL.md) when a module or interface needs shaping.
3. Write and confirm the plan, build in verifiable steps, and use [show-me-your-work](../show-me-your-work/SKILL.md) when an unattended build needs a decision trail.
4. Check the real result with [prove-it-works](../principle-prove-it-works/SKILL.md). [Create a verification skill](../create-verification-skill/SKILL.md) when a user-facing project has no such path; [maintain it](../maintain-verification-skill/SKILL.md) when its existing path has drifted. Use [blast-radius](../blast-radius/SKILL.md) when a change may affect behavior beyond its diff.
5. [pr](../pr/SKILL.md) shapes the PR body; `ship` owns [delivery](../ship/DELIVER-GREEN-CI.md). Explain its completion condition: the PR is marked ready and all applicable checks, including readiness-triggered jobs, pass on its verified latest commit. Passing draft checks is an intermediate gate.

Read `ship` before choosing an entry point within that sequence. This map does not turn its phases into independently automatic commands.

## On-ramps

- **Something is broken:** [bug-fix](../bug-fix/SKILL.md) reproduces the bug, finds its cause with runtime evidence, and delivers the fix as a PR whose history shows the failure before the fix. It applies [fix-root-causes](../principle-fix-root-causes/SKILL.md) throughout.
- **PR or stack is open and needs to land:** [babysit](../babysit/SKILL.md) brings it to merge-ready or an evidenced blocker: it discovers the repository gates and clears conflicts, review threads, and failing CI. It merges only when the user asks it to, and only after an independent verifier passes the PR.
- **Architecture is causing friction:** [improve-codebase-architecture](../improve-codebase-architecture/SKILL.md) surveys deepening opportunities. A chosen change can enter `ship` at goal shaping; [codebase-design](../codebase-design/SKILL.md) supplies its design vocabulary.
- **Work already started:** [session-pickup](../session-pickup/SKILL.md) finds the resume point from a handoff or prior trail, then continues the unfinished work through the fitting skill or flow.

## Standalone work

Reach for these without committing to the whole `ship` flow:

| Need | Skill |
|---|---|
| Understand current code, ownership, or runtime flow | [how](../how/SKILL.md) |
| Investigate why code has its current shape | [why](../why/SKILL.md) |
| Test a plan or decision by interview | [grill-me](../grill-me/SKILL.md), the user-invoked wrapper around [grilling](../grilling/SKILL.md) |
| Gather primary-source facts | [research](../research/SKILL.md) |
| Check what a change could break elsewhere | [blast-radius](../blast-radius/SKILL.md) |
| Create or audit a project's user-facing verification path | [create-verification-skill](../create-verification-skill/SKILL.md) or [maintain-verification-skill](../maintain-verification-skill/SKILL.md) |
| Audit and fix how well a coding agent can work in a repo | [agent-readiness](../agent-readiness/SKILL.md) |
| Keep a reviewable trail during unattended work | [show-me-your-work](../show-me-your-work/SKILL.md) |
| Check a PR or stack's gates and merge readiness | [babysit](../babysit/SKILL.md) in `check` mode |
| Write a PR body | [pr](../pr/SKILL.md) |
| Write a skill or agent-facing document | [writing-for-agents](../writing-for-agents/SKILL.md) |

## Vocabulary and principles underneath

[domain-modeling](../domain-modeling/SKILL.md) owns domain terms and representations; [codebase-design](../codebase-design/SKILL.md) owns the vocabulary for modules, interfaces, and seams. They can support a flow or answer a focused design request.

Apply principles when their conditions occur during any route:

| Condition | Principle |
|---|---|
| Debugging a symptom | [fix-root-causes](../principle-fix-root-causes/SKILL.md) |
| Designing validation, error handling, or adapters | [boundary-discipline](../principle-boundary-discipline/SKILL.md) |
| Writing types or signatures in a typed language | [type-system-discipline](../principle-type-system-discipline/SKILL.md) |
| Writing or reviewing TypeScript | [typescript-best-practices](../typescript-best-practices/SKILL.md) |
| Handling retries, restarts, or interrupted mutation | [make-operations-idempotent](../principle-make-operations-idempotent/SKILL.md) |
| Coordinating writers of shared mutable state | [separate-before-serializing-shared-state](../principle-separate-before-serializing-shared-state/SKILL.md) |
| Trusting or reporting a benchmark or eval number | [explain-the-number](../principle-explain-the-number/SKILL.md) |
| Checking a finished output | [prove-it-works](../principle-prove-it-works/SKILL.md) |
| Large reads or outputs are crowding the session | [guard-the-context-window](../principle-guard-the-context-window/SKILL.md) |

## Phase boundaries

Choose at a natural boundary, after recording any decisions and proof the next phase needs:

- **Continue** in this session while the current evidence and decisions still fit and the next step depends on them.
- **Clear** the context when the phase is complete and the next step can start from durable artifacts alone.
- **Compact** when the context is filling but the next step still needs a concise account of decisions, evidence, and open questions. See [guard-the-context-window](../principle-guard-the-context-window/SKILL.md).
- **Pause or hand off** when asked to stop or transfer work: [pause-safely](../pause-safely/SKILL.md) writes the checkpoint; [session-pickup](../session-pickup/SKILL.md) resumes it. Automatic compaction is not a pause.
- **Use a subagent** for a bounded, independent slice when the active skill calls for one and the harness permits it. Keep the main thread responsible for integrating and checking the result.

Only model-invocable skills can start on their own. For every user-invoked skill named here, this map is a hint for the human to invoke it, not a promise that the router will fire it.
