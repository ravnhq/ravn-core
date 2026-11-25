# Skill mechanics

Skill-specific rules for [`writing-for-agents`](SKILL.md): invocation, descriptions, shared reference, splitting, and routers.

## Invocation

Choose between two modes:

- **Model-invoked (default)**: omit `disable-model-invocation` and write a trigger-oriented `description` following the pointer rules in `SKILL.md`. Pays permanent context load so the agent can discover the skill from a user request alone (humans can still invoke it by name).
- **User-invoked**: set `disable-model-invocation: true` and write a one-line human-facing `description` with trigger lists stripped. Pays zero context load; runs only when the user names it or another skill links to it.

Default to user-invoked unless the agent must discover the skill without being told its name.

## Descriptions and testing

Write a model-invoked `description` against its closest neighbor: name the decision or deliverable that makes the agent pick this skill over the alternative.

Verify with three prompts:

1. A request that should load this skill.
2. A minimally changed request that should load the neighboring skill instead.
3. An ordinary request that should load neither.

Check skill selection, required reference reads, and final outcome separately.

## Shared reference

- **Within one plugin**: keep shared reference in a plain file with one owner. Link to it from other skills at the decision point that needs it (for example, [`deprecate-and-migrate`](../deprecate-and-migrate/SKILL.md) linking [`ship`'s sequencing reference](../ship/SEQUENCE-VERIFIABLE-UNITS.md)).
- **Across plugins**: links do not cross plugin boundaries; put cross-plugin shared reference in a model-invoked reference skill.

## Splitting skills

Split off a new model-invoked skill only when an independent trigger or cross-skill reach justifies the extra always-loaded description.

## Router skills

When user-invoked skills grow too numerous to remember, add a **router skill** that maps intents to skill names. Make the router model-invoked when "which skill fits this?" should load it automatically (as `ask-ravn` does). A router only maps and recommends; it does not execute the target skills.
