# Promptify

Promptify rewrites a request without submitting the draft: TUI hosts prepend it to the composer, RPC hosts open one editable prefilled dialog, and headless hosts emit one displayed event.

## Sub-features

- `promptify.engine`: the exported engine extracts a copy-ready draft and presents it through a host surface.
- `promptify.surfaces`: Pi maps TUI, RPC, JSON, and print modes to composer, dialog, and event surfaces without triggering a model turn. Event-only hosts receive the draft after the handled command settles so Pi does not strand it in the active command queue.
- `promptify.rpc`: a real Pi RPC process handles `/promptify`, opens one editor titled `Promptify draft` with the rewritten text, and starts no agent run.
- `promptify.package`: the package contains the engine and Pi surface modules that its manifest exports.

## How to get to it (user POV)

- In Pi TUI, run `/promptify <request>` and find the draft in the composer.
- From a Pi RPC client, send `/promptify <request>`, receive the handled prompt disposition, then review the draft in the editor. The prompt response does not wait for the editor to close.
- In Pi JSON or print mode, run the command and consume the displayed custom message.

## Driving it with Node and npm

Preconditions: `pnpm install` done. The RPC driver uses Pi's real host and extension but replaces the nested helper response with a deterministic draft, so it needs no login or API budget.

- Run `node .agents/skills/verify-ravn-core/scripts/collect.ts promptify-rpc node .agents/skills/verify-ravn-core/scripts/promptify-rpc.ts`. Expect exit 0. In `stdout.txt`, `promptHandled` is `true`, `agentRunStarted` is `false`, and the editor title and prefill are `Promptify draft` and `deterministic rewrite`.
- Run `node .agents/skills/verify-ravn-core/scripts/collect.ts promptify-event node .agents/skills/verify-ravn-core/scripts/promptify-event.ts`. Expect exit 0. In `stdout.txt`, `promptHandled` and `customMessage` are `true`, and `agentRunStarted` is `false`.
- Run `node .agents/skills/verify-ravn-core/scripts/collect.ts promptify-contract node --test test/ravn-core/promptify/*.test.ts`. Expect exit 0 and eight passing tests in `stdout.txt`.
- Run `node .agents/skills/verify-ravn-core/scripts/collect.ts promptify-package npm pack --dry-run --json --ignore-scripts --workspace=false plugins/agent/ravn-core`. Expect exit 0. In `stdout.txt`, the file list includes `promptify/engine.ts` and `pi/promptify-surface.ts`.

## Gotchas

- The RPC driver is also the executable Promptify discovers for its nested helper. Arguments select driver, Pi CLI, or fixed helper mode; preserve all three branches.
- A handled RPC prompt proves only that the extension command ran. The editor request and absence of `agent_start` prove the draft reached the host without starting a turn.
- Pi treats an extension command as streaming until its handler returns. A display-only custom message emitted inside that handler can remain queued forever when the command intentionally starts no agent run, so event presentation must defer publication until the handler settles.
- Product tests own the TUI and headless contracts because those surfaces are adapters over the same engine boundary. The RPC recipe owns the live Pi protocol boundary that originally lost the draft.
