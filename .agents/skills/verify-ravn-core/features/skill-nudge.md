# Skill Nudge tip band

After every second answered turn, Haiku reads the recent conversation and the session's skills. When one fits, a tip draws in the band above the prompt: a `✦ Skill tip · /<skill>` header, the reason on the next line, and a `1: Use  2: Dismiss` row. A bare `1` or `2` in the empty prompt answers it, as for a survey. `/skill-nudge` turns judging off and back on.

## Sub-features

- `nudge.tip`: after two answered turns whose topic fits an installed skill, the tip draws with its three rows.
- `nudge.style`: the header is bold in the theme's `suggestion` color, the skill name bold, the reason at full strength, the hotkey digits in the accent color.
- `nudge.use`: `1` in the empty prompt fills it with `/<skill>` and clears the tip.
- `nudge.dismiss`: `2` in the empty prompt clears the tip and leaves the prompt empty.
- `nudge.toggle`: `/skill-nudge` prints `Skill nudges off.`, and again prints `Skill nudges on.`

## How to get to it (user POV)

- Install `skill-nudge`, work in an interactive `claude` session, and finish two turns about something an installed skill covers. The tip appears above the prompt.

## Driving it with tmux

A mod acts only in an interactive terminal, so the collector cannot show it. Drive a real `claude` TUI in a detached tmux session and read the screen with `capture-pane`. `doctor.ts` does not check for `tmux`; without it, report the feature as unverified.

Preconditions: `claude plugin test plugins/mods/skill-nudge` passes; `tmux` is installed; `RUN_ID` is exported. Set these once:

```bash
F=skill-nudge-band; S=/tmp/ravn-verify/$RUN_ID/$F; E=.verify/$RUN_ID/$F
mkdir -p "$S/work" "$E" && git -C "$S/work" init -q
claude plugin list | grep -A3 skill-nudge   # note the Scope line
```

1. Pick the mod to load. If `claude plugin list` shows no `skill-nudge`, load `plugins/mods/skill-nudge` itself and skip the toggles in steps 3 and 6. If it shows one, its copy draws first and hides the working tree's, and a `managed` scope cannot be unloaded. Load a renamed copy instead, which gets its own command, state, and store:

   ```bash
   cp -R plugins/mods/skill-nudge "$S/mod" && rm -rf "$S/mod/.claude-plugin/types" "$S/mod/tests"
   grep -rl skill-nudge "$S/mod" | xargs sed -i '' 's/skill-nudge/skill-nudge-dev/g'   # BSD sed; GNU sed takes -i alone
   diff -r plugins/mods/skill-nudge/hooks "$S/mod/hooks"   # only the name may differ
   ```

2. Start the session at a fixed size, with Haiku as the main model to keep cost down, and trust the new folder:

   ```bash
   tmux new-session -d -s "$F" -x 120 -y 40 -c "$S/work" "claude --model haiku --plugin-dir $S/mod"
   sleep 8; tmux send-keys -t "$F" Down Enter   # "Yes, I trust this folder"
   ```

3. `nudge.toggle`, and only with a renamed copy: run the installed copy's `/skill-nudge` to turn it off. Type a slash command with `-l`, close the typeahead with Escape, then submit:

   ```bash
   tmux send-keys -t "$F" -l "/skill-nudge"; sleep 1; tmux send-keys -t "$F" Escape; sleep 0.5; tmux send-keys -t "$F" Enter
   ```

   Expect `Skill nudges off.` on screen.

4. `nudge.tip`: send two prompts that fit a skill and need no tools. These two drew `/ravn-core:research`:

   - `I'm choosing between BullMQ and pg-boss for a Node job queue. Without using any tools, give me a one-line first thought.`
   - `Before I decide I want to dig into what other teams actually found running each in production, with primary sources. Without tools, just say in one line how you'd approach that.`

   Send each with `tmux send-keys -t "$F" -l "<prompt>"`, then `Enter`, and wait for the answer before the next. Then poll for the tip and keep both captures:

   ```bash
   for i in $(seq 30); do tmux capture-pane -t "$F" -p | grep -q "Skill tip" && break; sleep 2; done
   tmux capture-pane -t "$F" -p > "$E/tip.txt"; tmux capture-pane -t "$F" -e -p > "$E/tip.ansi"
   ```

   Expect in `tip.txt` the header, the indented reason, and the indented `1: Use  2: Dismiss` row. A first-line `Skill tip: /<skill>` with the reason on the same line is the 0.1.1 layout, which means an installed copy drew it (see step 1).

5. `nudge.style`: `LC_ALL=C grep -a -A3 "Skill tip" "$E/tip.ansi" | LC_ALL=C cat -v`. Expect `^[[1m` and a color code before `Skill tip`, `^[[1m` before `/<skill>`, no dim code before the reason, and a color code around each hotkey digit. The 0.1.2 run on the default dark theme showed `^[[1m^[[94m` for the header and `^[[94m` for the digits.

   Then `nudge.use`: `tmux send-keys -t "$F" 1`, capture to `$E/after-use.txt`, and expect the prompt line `❯ /<skill>` and no tip. For `nudge.dismiss`, restart from step 2 in a new tmux session, because a session offers each skill only once. Press `2` and expect no tip and an empty prompt.

6. Tear down. With a renamed copy, clear the prompt and run `/skill-nudge` again as in step 3. Expect `Skill nudges on.` and save the screen to `$E/restore.txt`, since that flag persists in the person's own store. Then `tmux kill-session -t "$F"` and `node .agents/skills/verify-ravn-core/scripts/cleanup.ts $RUN_ID`.

## Gotchas

- Haiku may suggest no skill; most turns produce none. Two turns that clearly ask for primary-source research have drawn `ravn-core:research` reliably. If no tip appears, send two more turns on the same topic; don't change the mod.
- The composer may show a ghost suggestion, such as `❯ how do other teams run pg-boss`. That ghost text doesn't count as typing, so the prompt is still empty and a bare digit still answers the tip.
- `cut` and plain `cat -v` fail on the tip's multibyte glyphs; read ANSI captures under `LC_ALL=C`.
- The toggle in steps 3 and 6 rewrites the person's real setting for the installed copy. Always run step 6, even after a failed attempt.
- `claude plugin test` covers stats, telemetry, staleness, and repeat offers. This recipe proves only what the person sees and presses.
