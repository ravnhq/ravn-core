# Writing for agents

An authoring request produces a dispatcher with the common steps and a branch reference that contains only the detail for that operation.

## Sub-features

- `authoring.entry`: `SKILL.md` says when to use the notes CLI, gives the common check, and names when to read the search reference.
- `authoring.reference`: the relative link resolves and the reference names a command and an observable success condition.

## How to get to it (user POV)

Ask for a project-local skill to use `notes.mjs` with specific search guidance, kept behind a pointer in the skill.

## Driving it with a scratch repo

Use `scripts/scratch.ts authoring <dir>` with the [harness setup](README.md#harness-runs). Invoke `writing-for-agents` through `scripts/collect.ts` and request the guide under `.agents/skills/notes-guide`. Open the generated entry and follow its link, then seed an isolated notes file and run the documented search. Preserve the guide and output in evidence.

## Gotchas

- An example path that only looks correct does not count. A real reference must exist at that relative path and the documented command must find the seeded note.
