### Authoring or modifying a skill

Adapted from the [pstack](https://github.com/cursor/plugins/tree/bf0c7cd80abdbf7fe47b634978a7d1b4071f71a7/pstack) `authoring-a-skill` playbook, MIT License, Copyright (c) 2026 Lauren Tan.

**You own the skill's voice.**

1. Use the **writing-for-agents** skill.
2. Validate the skill: frontmatter has `name` and `description`, referenced files exist, cross-skill links resolve. `scripts/validate-skills.ts` also enforces:
   - **Size**: `SKILL.md` stays within 18,000 bytes. After a compaction, Claude Code re-attaches each invoked skill cut at 20,000 characters, and the rest is lost for the session. Put what every run needs first; move what only some branches reach into `references/`.
   - **Frontmatter**: a shipped skill uses only `name`, `description`, `license`, `compatibility`, `metadata.proof`, and `disable-model-invocation`. These are the [Agent Skills](https://agentskills.io/specification) fields that every harness reads alike, plus the invocation policy.
3. Add the skill's eval config (`evals/AGENTS.md`). `test/evals/configs.test.ts` requires every case kind, a `route` to a model-invocable sibling, and a `stay-out` case that asserts the skill itself stays unused. A structural skill's evals gate the merge; a subjective skill's live check does.
4. Open a PR with `.github/pull_request_template.md`.

When in doubt, delete. Keep only prose that changes a decision. Tell it to do the thing and skip the reason. Explain only when the rule is confusing without one. Match tone to scope. Point at structural sources (types, READMEs, config) per `docs/authoring/encode-lessons-in-structure.md`. Delegate to other skills by path. Don't restate. A workflow you keep hitting but isn't captured → propose a new skill.

**Reply:** summary of the skill, key design decisions, validation notes.
