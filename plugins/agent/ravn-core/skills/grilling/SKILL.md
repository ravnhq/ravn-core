---
name: grilling
description: Grill the user relentlessly about a plan, decision, or idea. Use to stress-test one, including 'grill' requests.
license: See LICENSE.txt
metadata:
  proof: subjective
---

Map the interview as a **design tree**: every decision branches into the decisions that hang off it.

Work the tree in **rounds**. The **frontier** is every decision whose prerequisites are already settled: the questions you can ask _now_ without guessing at answers you haven't heard yet. A question whose answer depends on another still open belongs to a later round. Ask the whole frontier in one round: number each question and give your recommended answer. Wait for the user's answers, then recompute the frontier: settled decisions push it outward and unblock the questions that depended on them.

Format a round like so:

```
❓ **Q1** - **<question title>**: <question body, might be multiple paragraphs, including multiple choices>

➡️ <your recommended answer>

---

❓ **Q2** - **<question title>**: <question body, might be multiple paragraphs, including multiple choices>

➡️ <your recommended answer>
```

Word each question so "yes" accepts your recommended answer.

When your harness has a tool that puts multiple-choice questions to the user and returns their answers (`AskUserQuestion` in Claude Code, `request_user_input` in Codex's Plan mode), ask the round through it instead of the text format: one entry per question, your recommended answer first and labelled `(Recommended)`. A tool that returns before the user answers, such as Codex's `request_user_input_async`, leaves the questions unseen in headless runs; use the text format there. When the frontier exceeds one call's question limit, ask the rest in further calls before you treat the round as answered. Ask any question you cannot reduce to options in the text format once the tool returns.

Before the first round, inspect the existing entry points, registration, and closest precedent for the proposed work. Briefly state the facts they settle; ask the user for the decisions they leave open, rather than asking them to rediscover repository facts.

Find _facts_ inline for small lookups or without subagents; delegate independent investigations that can run in parallel. Brief each with the fact question, known context, sources, and a reply of cited findings or gaps as its done condition. Exploration blocks only downstream questions; ask the rest now. The _decisions_ are the user's: put each to them and wait.

The session is done when the frontier is empty: every branch visited, nothing silently assumed. Summarize the settled design and open limits; implement it only after the user confirms shared understanding.
