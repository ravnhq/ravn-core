# Statechart

`/ravn-core:statechart` model-checks a TLA+ spec with TLC and draws it as a Mermaid statechart. The report gives the shortest path to each state that breaks a rule, and the agent hands off the chart and that path in the reader's words.

## Sub-features

- `statechart.run`: the transcript shows the agent running the bundled `scripts/statechart.ts` on `spec/Checkout.tla`, exit 1, and its `--out` folder outside the repo holds `chart.mmd`, `report.md`, and `tlc.out`.
- `statechart.trace`: `report.md` says `ChargedAtMostOnce breaks` with a 5-step shortest path, and the final message gives that path in words: pay, time out, the first charge lands, pay again, the second charge lands.
- `statechart.chart`: the final message shows the chart as a `mermaid` block whose states carry the agent's labels rather than raw variable values, with the breaking state marked `breaks`.
- `statechart.repo`: `git status --short` is empty: the spec and its config are unchanged, and the rule was not weakened.

## How to get to it (user POV)

- An engineer types the skill's invocation form (README) and names the spec. The skill is model-invocable, so a request to draw or check a state machine can also reach it unprompted.

## Driving it with scripts/scratch.ts

- Build one scratch repo per harness: `node .agents/skills/verify-ravn-core/scripts/scratch.ts statechart /tmp/ravn-verify/$RUN_ID/statechart-<harness>/work`. Its `spec/Checkout.tla` lets a retry after a timeout charge the card twice; TLC reaches 12 states.
- Load the working-tree skills as the README's Harness runs say, and send one turn: `<invocation> Check spec/Checkout.tla and show me how checkout moves between states. Do not ask me questions.`
- Check each sub-feature: quote the command line from the transcript, `ls` of the `--out` folder, the `ChargedAtMostOnce` section of `report.md`, the final message's path and `mermaid` block, and `git status --short`.

## Gotchas

- The command needs Java 11 or later on `PATH`. Its first run downloads `tla2tools.jar` 1.7.4 into the per-user cache (`~/.cache/ravn-core/statechart` on Linux, `~/Library/Caches/ravn-core/statechart` on macOS, `%LOCALAPPDATA%\ravn-core\Cache\statechart` on Windows) and checks its SHA-256, so that run needs the network. `TLA2TOOLS` points it at a local jar instead.
- Exit 1 is the expected result: a rule breaks. Exit 2 means the command could not run, and it writes nothing.
- The command refuses an `--out` folder that is not empty, so a second run in the same session needs a new folder.
