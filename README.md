# ravn-core

Ravn's agent plugins, open source under the MIT license.

- **`ravn-core`** packages the engineering workflows Ravn uses with coding agents: an idea-to-PR flow (`ship`), code archaeology (`how`, `why`), verification, design vocabulary, and handoffs. It runs in Claude Code, Codex, Cursor, and Pi.
- **[`explain-change`](plugins/mods/explain-change/README.md)** is a Claude Code mod that shows the `ravn-core` skill's change lessons in a pane, with diagrams and an interactive quiz.
- **`skill-nudge`** is a Claude Code mod. A background Haiku watches the session and suggests one of your installed skills above the prompt when it fits.

## Install `ravn-core`

### Claude Code

```
/plugin marketplace add ravnhq/ravn-core
/plugin install ravn-core@ravn
```

Run `/plugin marketplace update ravn` to pick up new versions.

### Codex

Codex reads `.agents/plugins/marketplace.json`. Add the catalog from GitHub, then install `ravn-core` and start a new session:

```
codex plugin marketplace add ravnhq/ravn-core
codex plugin add ravn-core@ravn
```

### Cursor

On Teams and Enterprise, import this repo from Dashboard → Plugins & MCPs → Team Marketplaces → Add Marketplace → Import from Repo. Without a team marketplace, add it as a personal marketplace from the Cursor CLI:

```
cursor-agent plugin marketplace add https://github.com/ravnhq/ravn-core
```

Then run `/plugins` in an interactive `cursor-agent` session, open the Marketplace tab, and install `ravn-core (ravn)`. To try a local checkout for one session instead, run `cursor-agent --plugin-dir plugins/agent/ravn-core`.

### Pi

```
pi install git:github.com/ravnhq/ravn-core
```

The repo-root `package.json` points Pi at the `ravn-core` skills. From a checkout, `pi install ./plugins/agent/ravn-core` installs the same skills from disk.

## Use `ravn-core`

| Harness | Find a skill | Ship a change |
|---|---|---|
| Cursor | `/ask-ravn` | `/ship` |
| Claude Code | `/ravn-core:ask-ravn` | `/ravn-core:ship` |
| Codex | `$ask-ravn` | `$ship` |
| Pi | `/skill:ask-ravn` | `/skill:ship` |

Most `ravn-core` skills, including `ask-ravn`, `ship`, `why`, and the principles, set `disable-model-invocation: true`. They run only when you invoke them. Each skill's frontmatter controls whether the agent can start it on its own.

Evals prove `ravn-core` in Claude Code, Codex, Cursor, and Pi. The Cursor runner is `cursor/composer-2.5` and authenticates with `CURSOR_API_KEY`.

## Install `skill-nudge`

Needs Claude Code v2.1.287 or later.

```
/plugin marketplace add ravnhq/ravn-core
/plugin install skill-nudge@ravn
```

See its [README](plugins/mods/skill-nudge/README.md) for behavior and what it sends to Haiku.

## Contribute

Read `AGENTS.md` for the layout and rules, and `plugins/agent/VISION.md` for what merges into `ravn-core`.

`pnpm install` installs a pre-push guard that runs `pnpm check` on a clean checkout of the outgoing commit. It preserves existing custom hooks. On a conflict, `pnpm install` prints a warning and finishes without the guard; integrate `scripts/check-push.ts` into your hook.

Run the `validate` skill before you push. The per-skill evals are private, so `pnpm eval` needs Ravn access; without it, `pnpm check` skips the tests that read them.

## License

MIT. Some skills adapt MIT-licensed work from [mattpocock/skills](https://github.com/mattpocock/skills), [pstack](https://github.com/cursor/plugins/tree/main/pstack), and [HumanLayer](https://github.com/humanlayer/skills); each carries its upstream license in its `LICENSE.txt`.
