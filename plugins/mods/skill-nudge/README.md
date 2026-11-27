# Skill Nudge

Skill Nudge watches your Claude Code session in the background and tells you when one of your installed skills fits what you're doing. After a turn finishes, Haiku reads the recent conversation and your skill list. When a skill fits the next step well, a tip appears above the prompt:

```
╭─────────────────────────────────────────────────────────╮
│ ✦ Skill tip · /research                                 │
│ You're weighing approaches; see what others did first.  │
│ 1: Use /research  2: Dismiss  3: Mute skill             │
╰─────────────────────────────────────────────────────────╯
```

Type `1`, `2`, or `3` into the empty prompt to pick, as you answer a survey, or click. **Use** puts `/<skill>` in the prompt box—ahead of anything you already typed, or with a short suggested argument from the conversation when the box is empty—so it's ready to edit or send. A skill marked `user-invocable: false` can't be typed as a command, so for one of those **Use** writes `Use the <skill> skill.` instead. **Dismiss** hides the tip for now. **Mute skill** hides it and stops suggesting that skill across sessions (`/skill-nudge unmute` restores muted skills). Sending your next prompt also clears it.

Requires Claude Code 2.1.287 or later.

## Install

```
/plugin marketplace add ravnhq/ravn-core
/plugin install skill-nudge@ravn
```

For a local session:

```sh
claude --plugin-dir ./plugins/mods/skill-nudge
```

## Behavior

- Skill Nudge starts on. `/skill-nudge` turns it off or back on, and Claude Code's plugin store keeps the choice across sessions. `/skill-nudge stats` shows how tips fared, and `/skill-nudge unmute` restores any muted skills.
- Haiku judges starting on the first answered turn, and cools down for two finished turns after showing a tip. Interrupted turns, subagent turns, and non-interactive sessions such as `claude -p` never trigger it.
- Haiku sees only skills and slash commands from plugins and from your own user or project configuration. Built-in commands and MCP prompts stay out of the list.
- A skill the session already ran, through the Skill tool or typed as `/name`, is never suggested. Skill Nudge suggests each skill at most once per session.
- Most turns produce no tip. A tip names an unfinished action and cites a line from the latest request or answer. Before showing a tip, a short second Haiku request checks it against the whole answer. Tips without evidence, approvals, or a listed skill stay hidden.
- If you send a new prompt while Haiku is still deciding, the mod drops that late suggestion.

## Cost and privacy

Each judgment starts with one Haiku request on your session's own Claude Code client and account. It sends the names and descriptions of the listed skills, cached across requests, plus the last eight messages of the conversation, each cut to 1,500 characters, along with the names of the tools each message used. Only a proposed tip gets a second request. That request sends the same conversation excerpt and the proposed tip, not the skill list. Both requests share a 20-second deadline. Tool inputs and outputs aren't sent. Skill Nudge never changes what the main model reads.

## Usage stats

Skill Nudge keeps a local record of how its tips fare, so you can see whether they help and share the numbers with the team.

Run `/skill-nudge stats` to see judgments, tips shown, and how many you took (pressed **Use** or ran the skill yourself), dismissed, or ignored by sending a different prompt, overall and per skill. The command also copies a JSON summary to the clipboard. Paste it wherever the team collects feedback.

The record stays in Claude Code's plugin store on your machine. Nothing is sent anywhere. Each event holds only:

- what happened: a judgment's outcome, or a tip's fate,
- the suggested skill's name,
- Haiku's latency and token counts,
- a short hash that identifies the version of the prompt in use,
- a random install ID, so shared summaries can be told apart.

Events never include conversation text, Haiku's reason, file paths, repository names, or your identity. Skill Nudge keeps the newest 500 events per session and the newest 50 sessions.

Stats separates deliberate abstentions, tips rejected on review, invalid replies, suggestions without evidence, replies cut off at the token limit, and tips that arrived too late. Older events recorded as quiet remain separate because they did not distinguish those outcomes.

## Limits

The tip card draws in the band above the prompt in the terminal and the Desktop Code tab (a survey in that band takes priority over the tip). On VS Code and mobile, where that band doesn't render, tips appear as a toast notification instead.
