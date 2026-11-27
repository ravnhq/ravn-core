---
name: plan
description: Stress-test a plan by interview (grill), design an auditable phase plan for ambitious multi-part work, or keep a decision log for unattended runs.
disable-model-invocation: true
license: See LICENSE.txt
metadata:
  proof: subjective
---

# Plan

Choose the mode that fits the user's request (combine them for ambitious, multi-phase work):

- **Grill a plan** ("grill me", "poke holes in this", stress-testing a design or set of decisions): follow the interview protocol below.
- **Auditable phase plan** (ambitious, multi-part work that no narrower playbook like `ship`, `debug`, or `migrate` fits): read and follow [Phase Plan](references/phase-plan.md).
- **Decision log** ("show your work", "log your decisions", or an unattended/multi-phase run the user will review later): read and follow [Decision Log](references/decision-log.md) (uses `scripts/log.ts`).

---

## Grill a plan

Interview the user relentlessly until you reach a shared understanding. Start with their plan, design, or decision and map it as a **design tree**: every decision branches into the decisions that hang off it.

Work the tree in **rounds**. The **frontier** is every decision whose prerequisites are already settled: the questions you can ask _now_ without guessing at answers you haven't heard yet. Ask the whole frontier in one round: number each question and give your recommended answer. Wait for the user's answers, then recompute the frontier.

Format a round like so:

```
❓ **Q1** - **<question title>**: <question body, might be multiple paragraphs, including multiple choices>

➡️ <your recommended answer>

---

❓ **Q2** - **<question title>**: <question body, might be multiple paragraphs, including multiple choices>

➡️ <your recommended answer>
```

Word each question so "yes" accepts your recommended answer.

When your harness has a synchronous multiple-choice question tool (`AskUserQuestion` in Claude Code, `request_user_input` in Codex's Plan mode), ask the round through it instead of the text format: one entry per question, recommended answer first and labelled `(Recommended)`. Use the text format if the tool is async or the question cannot be reduced to options.

Finding _facts_ is your job, never the user's: when a frontier question needs a fact from the environment, dispatch a sub-agent to find it. Put only the _decisions_ to the user and wait.

The session is done when the frontier is empty: every branch of the design tree visited, nothing left silently assumed. Do not act on it until the user confirms you have reached a shared understanding.
