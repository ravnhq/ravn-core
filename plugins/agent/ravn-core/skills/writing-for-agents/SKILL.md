---
name: writing-for-agents
description: Writing documents for agents. Use when creating or editing skills, or modifying AGENTS.md or CLAUDE.md.
license: See LICENSE.txt
metadata:
  proof: subjective
---

Reference for writing any document an agent consumes: a skill, an `AGENTS.md` / `CLAUDE.md`, or a linked reference doc. Good agent writing makes the agent follow a reliable process using the fewest necessary tokens.

For skill-specific mechanics (frontmatter, invocation choice, shared reference, router skills), read [`SKILL-MECHANICS.md`](SKILL-MECHANICS.md).

## 1. Decide where information lives

Every line in an always-loaded document (`AGENTS.md`, a skill `description`) pays context cost on every turn, whether or not it applies.

- **Always-loaded**: include only what nearly every task needs, plus pointers to conditional material.
- **Behind a pointer (progressive disclosure)**: move branch-specific rules, workflows, and bulky reference into separate files loaded only when relevant.
- **Leave in the repo**: do not restate what the agent can read from `package.json`, config files, directory layout, or `--help` unless lookup is expensive. Document what the repo cannot confess: unwritten conventions, rationale behind choices, and non-obvious gotchas.

## 2. Write sharp pointers

A **pointer** is a short line in context that names an out-of-context file and the exact condition for reading it (a skill's `description`, or a link in `AGENTS.md`).

- **Lead with the sharpest word**: front-load the distinguishing concept.
- **One trigger per distinct branch**: list only genuinely distinct cases; cut synonyms that rename the same branch.
- **Cut redundancy**: omit details the target file already states.
- **Fix misses by sharpening first**: if an agent fails to follow a pointer to required material, tighten the trigger wording before inlining the content.

## 3. Structure for execution

- **Co-locate**: keep a concept's definition, rules, and caveats under one heading. Do not scatter one rule across sections or duplicate it in two places.
- **Keep steps clean**: in a procedural document, push bulky reference behind a pointer so it does not bury the steps.
- **Prescribe order only when it matters**: enforce a sequence only when order protects correctness or user authority.
- **Offload deterministic checks to scripts**: use a script for mechanical verification and leave judgment calls to the agent.

## 4. Set clear, demanding completion criteria

Every step or phase needs an explicit condition for "done."

- **Make it checkable**: vague bounds ("understanding reached") invite premature completion. State an observable artifact or check.
- **Make it demanding**: "every modified model accounted for" forces thorough legwork; "produce a change list" does not. In all-reference docs, state the exhaustiveness bar ("apply every rule").
- **Gate phase boundaries**: name the input, the artifact passed forward, the check that opens the next phase, and what change invalidates that check.
- **Prevent rushing**: if visible later steps tempt the agent to rush an earlier step, sharpen the completion criterion first. Split across a real context boundary (handoff or subagent) only when the criterion is irreducibly fuzzy and rushing persists.

## 5. Phrase for reliability

- **Prompt the positive**: state the target behavior ("write one-line comments") rather than negations ("don't write long comments"), which prime the forbidden behavior. Use prohibitions only for hard guardrails that cannot be phrased positively, and pair them with the positive target.
- **Prefer established, high-signal terms**: use a single standard term the model already understands instead of a multi-sentence restatement or a coined term.
  - "fast, deterministic, low-overhead" → *tight* loop
  - "a test you trust to catch the bug" → a *red* test
- **Replace weak exhortations**: generic modifiers ("be thorough", "be careful") rarely change default behavior. Replace them with concrete criteria or a stronger, specific term.

## 6. Prune ruthlessly

- **Single source of truth**: keep each rule in one authoritative place so updates are a one-place edit.
- **Delete no-ops**: if an instruction produces no behavioral change over the model's default, delete the whole sentence rather than trimming words. Settle doubts by running the document, not by debate.
- **Remove stale lines**: treat every edit as a chance to delete instructions that no longer apply. Accumulated stale layers dilute attention on what still matters.
