# Explain Change

Explain Change gives `ravn-core`'s `explain-change` skill a pane inside Claude Code. Ask Claude to explain a diff, branch, commit, or PR, and the lesson opens beside the conversation in four parts:

- **Background**: the system the change lives in, from a skippable primer down to the part the change touches.
- **Intuition**: the core idea, walked through with toy data.
- **Code**: the diff in reading order, with `path:line` references.
- **Quiz**: five multiple-choice questions. Pick an answer to see why it's right or wrong, and your score once you finish.

Flows are Mermaid flowcharts that the pane draws as boxes and connectors at its own width. Widen or narrow the pane and they lay out again. Connections it cannot draw are listed below the drawing; Mermaid it cannot parse stays as source. Other diagrams are text: call trees, file trees, component trees, and diff-shaped sketches of what changed. Text diagrams and diff sketches clip at the pane's width. Code is syntax-highlighted, and diff sketches show added lines in green and removed ones in red.

```
Cache saves by content hash
Saving unchanged content now returns the cached result.

[ Background ] [ Intuition ] [ Code ] [ Quiz ]

save(a) -> write
save(a) -> cached
```

Requires Claude Code 2.1.287 or later, and `ravn-core` for the skill. Without this mod, the skill writes the lesson in chat, in every harness `ravn-core` supports.

## Install

```
/plugin marketplace add ravnhq/ravn-core
/plugin install ravn-core@ravn
/plugin install explain-change@ravn
```

For a local session:

```sh
claude --plugin-dir ./plugins/agent/ravn-core --plugin-dir ./plugins/mods/explain-change
```

## Use

- Run `/ravn-core:explain-change`, optionally with a PR number, branch, ref range, or commit, or ask in your own words ("explain this branch"). With no target, Claude explains the current branch against the default branch, plus uncommitted work.
- Press `1` to `4` to switch parts, or click them. Press ctrl+x tab to move the keyboard into the pane, and use the arrow keys to scroll.
- `/explain-change-pane` reopens the pane after you close it. A new explanation replaces the last one and resets the quiz.

## Sidebar or inline

The pane docks as a sidebar only in Claude Code's fullscreen renderer, on a terminal at least 110 columns wide. In the classic renderer it opens above the prompt and shows a tip to switch. Run `/tui fullscreen` to switch for good, or start a single session with `CLAUDE_CODE_NO_FLICKER=1 claude`.

## Credits

The skill combines HumanLayer's [show-me](https://github.com/humanlayer/skills/blob/main/plugins/show-me/skills/show-me/SKILL.md) skill (MIT License, Copyright (c) 2026 HumanLayer), for its catalogue of small text diagrams, with Geoffrey Litt's [explain-diff](https://gist.github.com/geoffreylitt/a29df1b5f9865506e8952488eac3d524) prompt, for the background, intuition, code, and quiz structure. Drawing Mermaid flowcharts as text that fits the pane follows Ray Amjad's [diagram-pane](https://github.com/ray-amjad/claude-code-mods/tree/main/plugins/diagram-pane) mod.
