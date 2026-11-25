---
name: grilling
description: >-
  Stress-test a plan with the user, one round of decisions at a time. Use for
  "grill me" or "poke holes in this".
license: See LICENSE.txt
metadata:
  proof: subjective
---

# Grilling

Interview the user relentlessly until you reach a shared understanding. (Explicit command: `grilling`, formerly `grill-me`.)

## How to run it

1. **Map the design tree.** Break the plan, design, or decision into a tree of dependent decisions.
2. **Ask the current frontier in one round.** The **frontier** is every open decision whose prerequisites are already settled. Hold back questions that depend on an unanswered question.
3. **Give a recommended answer for every question**, worded so "yes" accepts your recommendation.
4. **Find facts yourself.** Never ask the user for facts you can read from the repo or environment. Dispatch a sub-agent to look them up; hold only the questions downstream of that lookup and ask the rest of the frontier now.
5. **Recompute after each reply.** Settled answers push the frontier outward and unlock downstream questions.

Done when the frontier is empty — every branch visited, nothing silently assumed — and the user confirms shared understanding. Do not act on the plan before that confirmation.

## Question format

When your harness provides a synchronous multiple-choice prompt tool (`AskUserQuestion` in Claude Code, `request_user_input` in Codex Plan mode), use it instead of text: one entry per question, recommended answer first and labelled `(Recommended)`. Split across multiple calls if the frontier exceeds the tool's limit. Ask any free-form question in text after the tool returns. Skip async prompt tools that return before the user answers (e.g., `request_user_input_async`); use text there.

Text format:

```markdown
❓ **Q1** - **<question title>**: <question body, including multiple choices>

➡️ <your recommended answer>

---

❓ **Q2** - **<question title>**: <question body, including multiple choices>

➡️ <your recommended answer>
```
