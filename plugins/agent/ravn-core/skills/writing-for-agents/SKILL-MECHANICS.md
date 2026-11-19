# Skill mechanics

The skill-specific branch of [`writing-for-agents`](SKILL.md): frontmatter, the invocation choice, and router skills. Everything else about writing a skill is the universal reference in `SKILL.md`.

## Invocation

Two choices, trading the two loads:

- A **model-invoked** skill keeps a `description`, so the agent can fire it autonomously and other skills can reach it. The human can still type its name: a description only adds agent discovery, never removes the human's reach. The description is the skill's top-level context pointer, always loaded: permanent context load in exchange for discoverability. A model-invoked skill of all reference is also a home for shared reference: reference several skills need lives in one place that each invokes. Mechanics: omit `disable-model-invocation`, and write a model-facing description carrying the trigger branches (the pointer-writing rules in `SKILL.md` apply in full).
- A **user-invoked** skill strips the description from the agent's reach: nothing fires it on its own, so it starts only when the human types its name or another skill links its `SKILL.md` and the agent follows that link. Zero context load, but it spends cognitive load: you are the index, or a linking skill is. Mechanics: set `disable-model-invocation: true`; the `description` becomes a one-line human-facing summary, trigger lists stripped.

Pick model-invocation only when the agent must reach the skill from a request alone, with no human naming it and no skill linking it. A skill that only ever fires by hand is user-invoked and pays no context load.

Shared reference lives as a plain file with one owner. Other skills link to it at the decision that needs it, as [`deprecate-and-migrate`](../deprecate-and-migrate/SKILL.md) links [`ship`'s sequencing reference](../ship/SEQUENCE-VERIFIABLE-UNITS.md) when moving callers one at a time. Links work only within one installed plugin; reference shared across plugins goes in a model-invoked skill.

Write the description against its closest neighbor: name the decision or deliverable that would make the agent choose this skill instead. Test the two requests with a single change in intent, plus one ordinary request that should load neither. Test selection, any required reference read, and the final outcome separately.

## Splitting by invocation

The invocation cut of splitting (the sequence cut lives in `SKILL.md`): split off a model-invoked skill when a distinct leading word, one you actually use in your prompts, should trigger it on its own, or another skill must reach it. The new always-loaded description costs context load, so that independent reach has to be worth it.

## Router skills

When user-invoked skills multiply past what you can remember, a **router skill** cures the piled-up cognitive load: one skill that names the others and when to reach for each, so the human remembers one skill instead of many. Make the router model-invoked when "which skill fits this?" should load it on its own, as `ask-ravn` is. Either way it maps and never runs the user-invoked skills it names: it tells the human which to invoke.
