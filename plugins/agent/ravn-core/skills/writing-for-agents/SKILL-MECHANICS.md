# Skill mechanics

The skill-specific branch of [`writing-for-agents`](SKILL.md): frontmatter, the invocation choice, and router skills. Everything else about writing a skill is the universal reference in `SKILL.md`.

## Invocation

Two choices, trading the two loads:

- A **model-invoked** skill keeps a `description`, so the agent can fire it autonomously and other skills can reach it. The human can still type its name: a description only adds agent discovery, never removes the human's reach. The description is the skill's top-level context pointer, always loaded: permanent context load in exchange for discoverability. A model-invoked skill of all reference is also a home for shared reference: reference several skills need lives in one place that each invokes. Mechanics: omit `disable-model-invocation`, and write a model-facing description carrying the trigger branches (the pointer-writing rules in `SKILL.md` apply in full).
- A **user-invoked** skill strips the description from the agent's reach: only the human typing its name can invoke it, and no other skill can. Zero context load, but it spends cognitive load: you are the index. Mechanics: set `disable-model-invocation: true`; the `description` becomes a one-line human-facing summary, trigger lists stripped.

Pick model-invocation only when the agent or another skill must reach the skill on its own. A skill that only ever fires by hand is user-invoked and pays no context load.

Shared reference that two user-invoked skills both need lives in neither, since with no descriptions neither can fire the other. Push it to a plain file outside the skill system: external reference any skill can point at.

## Splitting by invocation

The invocation cut of splitting (the sequence cut lives in `SKILL.md`): split off a model-invoked skill when a distinct leading word, one you actually use in your prompts, should trigger it on its own, or another skill must reach it. The new always-loaded description costs context load, so that independent reach has to be worth it.

## Router skills

When user-invoked skills multiply past what you can remember, a **router skill** cures the piled-up cognitive load: one user-invoked skill that names the others and when to reach for each, so the human remembers one skill instead of many. It can only hint, never fire them: with no descriptions, nothing but the human can reach them.
