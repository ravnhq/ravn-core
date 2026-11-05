# Secret Entry

Secret Entry closes the gap when Claude needs a secret in a file. Instead of asking you to open an editor, or worse, paste the value into the chat, Claude writes the file with a marker where the secret goes. The write holds, a masked prompt opens beside the transcript, you paste the value, and the file is written with it filled in. The value reaches the file and only the file: it never enters the transcript, the model's context, or the plugin store.

```
╭──────────────────────────────────────────────────────────────╮
│ 🔑 secret-entry · .env                                        │
│ Claude is writing this file (Write); it waits while you enter │
│ the secrets.                                                  │
│ Secret 1 of 2                                                 │
│ API_KEY                                                       │
│ value: ••••••••••••••••••  ⏎ next                             │
│ p: From clipboard  c: Cancel                                  │
│ Values never enter the chat.                                  │
╰──────────────────────────────────────────────────────────────╯
```

Requires Claude Code 2.1.287 or later.

## Install

```
/plugin marketplace add ravnhq/ravn-core
/plugin install secret-entry@ravn
```

For a local session:

```sh
claude --plugin-dir ./plugins/mods/secret-entry
```

## The marker

Where a secret goes, the file's content carries `{{secret:NAME}}`, with a name that says what the secret is:

- `.env` — `OPENAI_API_KEY={{secret:OPENAI_API_KEY}}`
- a bare key file — `{{secret:api_key}}` as the whole content
- a service account — `private_key = "{{secret:private_key}}"`

Three roads lead to the same masked prompt:

- **Claude writes the file itself.** Every Write and Edit whose content carries a marker holds, and the mod takes the write over. A file Claude creates this way is `chmod 600`.
- **Claude calls the write tool the mod registers.** Its description teaches Claude the marker, so Claude reaches for it on its own when a task needs credentials.
- **You run `/secret-entry <file> [KEY...]` yourself.** With KEY names, each becomes a `KEY=value` line (dotenv style): `/secret-entry .env GITHUB_TOKEN`. With only a file, every marker in it is filled.

Paste or type each value and press Enter to move to the next one. After the last one, the pane lists each name with its length; press Enter again to write the file. Esc closes the pane and refuses the write: Claude reads a denial that names the file and suggests `/secret-entry` instead. Pasting works over SSH and on machines with no clipboard tool, because the value arrives as terminal input. **From clipboard** fills the field from the system clipboard (pbpaste, wl-paste, xclip, or xsel) when one is available, and is the reliable way to enter a multi-line value such as a PEM key.

## What Claude sees

Claude reads the write's result in the Write or Edit tool's own shape, with every secret elided (`<secret:OPENAI_API_KEY>`). The result never contains the values, and neither does the session's transcript file. For the rest of the session, Read results for a filled file come back with the values redacted, so a later Read cannot leak what you pasted. Grep and Bash output are not redacted: anything that prints the file's secret lines reaches the transcript as it would without the mod.

## Behavior

- One entry at a time. A second held write waits for the first to be answered.
- Nobody answering within 10 minutes, an interrupted turn, or a closed pane refuses the write. Nothing is written half-filled: the file is written once, after the last Enter.
- A write whose markers hold no value fails in the engine's own way, so Claude sees a normal error.
- Non-interactive sessions (`claude -p`) never hold: the write is refused with instructions, because there is no one to ask.
- In a terminal too narrow for a pane, the prompt draws in the band above the prompt instead.

## Cost and privacy

The mod calls no model and sends nothing anywhere. Entered values live in the session's memory while the prompt is open and while Read redaction needs them, and nowhere else: not in the plugin store, not in telemetry, not on disk outside the target file. Files the mod creates are `chmod 600`; existing files keep their permissions.

## Limits

- Claude Code only: the CLI, the Desktop Code tab, and the VS Code extension. Other harnesses never see the mod, and the mobile surface, which has no text field, doesn't draw the pane.
- The value is masked after each redraw, so a long paste can flash on screen for a frame before the bullets replace it.
- A Bash command or Grep that prints a filled file bypasses the Read redaction. The file's permissions are the guard there, as they already are without the mod.
- Redaction covers the session that filled the file; a later session Reads it plainly (as any process you run would).
