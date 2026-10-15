### Authoring or modifying a skill

Adapted from the [pstack](https://github.com/cursor/plugins/tree/main/pstack) `authoring-a-skill` playbook, MIT License, Copyright (c) 2026 Lauren Tan.

**You own the skill's voice.**

1. Use the **writing-for-agents** skill.
2. Validate the skill: frontmatter has `name` and `description`, referenced files exist, cross-skill links resolve.
3. Test cases if structural. Skip if subjective.
4. Open a PR with `.github/pull_request_template.md`.

When in doubt, delete. Keep only prose that changes a decision. Tell it to do the thing and skip the reason. Explain only when the rule is confusing without one. Match tone to scope. Point at structural sources (types, READMEs, config) per `docs/authoring/encode-lessons-in-structure.md`. Delegate to other skills by path. Don't restate. A workflow you keep hitting but isn't captured → propose a new skill.

**Reply:** summary of the skill, key design decisions, validation notes.
