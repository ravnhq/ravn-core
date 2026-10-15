# Skill Nudge

Skill Nudge watches your Claude Code session in the background and tells you when one of your installed skills fits what you're doing. After a turn finishes, Haiku reads the recent conversation and your skill list. When a skill fits the next step well, a tip appears above the prompt:

```
✦ Skill tip · /ravn-core:research
  You're weighing approaches; see what others did first.
  1: Use  2: Dismiss
```

Type `1` or `2` into the empty prompt to pick, as you answer a survey, or click. **Use** puts `/<skill>` in the prompt box, ahead of anything you already typed, so your draft becomes the skill's arguments. **Dismiss** hides the tip. Sending your next prompt also clears it.

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

- Skill Nudge starts on. `/skill-nudge` turns it off or back on, and Claude Code's plugin store keeps the choice across sessions. `/skill-nudge stats` shows how tips fared.
- Haiku judges at most once every two finished turns, and only after the main conversation's turns that end in an answer. Interrupted turns, subagent turns, and non-interactive sessions such as `claude -p` never trigger it.
- Haiku sees only skills and slash commands from plugins and from your own user or project configuration. Built-in commands and MCP prompts stay out of the list.
- A skill the session already ran, through the Skill tool or typed as `/name`, is never suggested. Skill Nudge suggests each skill at most once per session.
- Most turns produce no tip. Haiku suggests a skill only when it fits well, and the mod drops any reply that names a skill outside the list.
- If you send a new prompt while Haiku is still deciding, the mod drops that late suggestion.

## Cost and privacy

Each judgment is one Haiku request on your session's own Claude Code client and account. It sends the names and descriptions of the listed skills, cached across requests, plus the last eight messages of the conversation, each cut to 1,500 characters, along with the names of the tools each message used. Tool inputs and outputs aren't sent. Skill Nudge never changes what the main model reads.

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

## Limits

The tip draws in the band above the prompt, so it shows in the terminal and the Desktop Code tab only. A survey in that band takes priority over the tip.
