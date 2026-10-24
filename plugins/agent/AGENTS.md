# Agent tier: `ravn-core`

`ravn-core` is the coding-agent plugin. These rules govern it and its tooling in `evals/`, `test/ravn-core/`, and `tools/`. Read `plugins/agent/VISION.md` before adding, changing, or reviewing a skill; it defines what merges.

`ravn-core`'s `plugin.json` and `mcp.json` follow the agent-plugins.org 1.0.0 schemas, and each skill lives at `skills/<name>/SKILL.md`. The plugin directory holds only what the plugin needs at runtime; tests, evals, and repo tooling live outside it, with script tests under `test/ravn-core/<skill>/`.

Author skills by `docs/authoring/authoring-a-skill.md`, and use the `writing-for-agents` skill whenever you write or edit a skill, a reference, or an `AGENTS.md`; it ships in `ravn-core` and is linked into `.agents/skills/`, `.claude/skills/`, and `.pi/skills/` for work in this repo. When a correction or review comment recurs, turn it into a mechanism by `docs/authoring/encode-lessons-in-structure.md`. The gates in brief:

- Supported harnesses are Claude Code, Codex, Cursor, and Pi. Every skill must behave the same in all four, so use only plugin and skill features the agent-plugins.org schemas define.
- Keep SKILL.md thin: when and how to act. Put deterministic logic in the skill's `scripts/` directory as TypeScript that Node 24 runs directly, portable across macOS, Windows, and Linux.
- Scripts rely on the engineer's existing CLI logins (e.g. `gh`); credentials stay out of the repo and out of MCP config.
- Every skill merges with proof it works in all four harnesses. Until v1, that proof is a live check: run the skill in Claude Code, Codex, Cursor, and Pi and confirm its observable behavior. From v1, a structural skill (its outcome a check can confirm) is proven by a promptfoo config at `evals/private/<plugin>/<skill>/promptfooconfig.ts`, run against all four harnesses by `pnpm eval` on your existing Claude Code and Codex logins and a Cursor API key (Pi runs on the Codex login); v1's first full run sets the baseline. A subjective skill (its outcome only judgment can grade) declares `proof: subjective` under `metadata` in its frontmatter, skips evals, and keeps the live check. Read `evals/AGENTS.md` before writing or changing an eval.
- Skills are human-authored, generic engineering workflows. Proposals drawn from session history, or specific to one client, project, or person, belong elsewhere.

The `agent-readiness` checklist is its rubric. Write each item as an outcome an agent can observe, never a tool or file name, so it holds across languages and layouts.
Change an item only to make the audit more accurate, never to raise a particular repository's grade.

CI also runs SkillSpector's static security scan on every `ravn-core` skill and fails on any finding; reproduce it with the command in `.github/workflows/ci.yml`.
