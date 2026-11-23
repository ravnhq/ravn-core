# Pi RPC custom-message contract for Promptify

## What ravn-core does today

`plugins/agent/ravn-core/pi/promptify.ts` deliberately keeps Promptify as a
rewrite-only command. In TUI mode it places the generated draft in the editor
and says “Nothing was sent.” In every other mode it calls:

```ts
pi.sendMessage({
  customType: "promptify",
  content: draft,
  display: true,
});
```

It does not set `triggerTurn`. That is consistent with the command's existing
contract: show the draft without asking the main agent to execute it. See
[`promptify.ts` lines 273–297](../../plugins/agent/ravn-core/pi/promptify.ts#L273-L297).

## What Pi promises

1. `pi.sendMessage()` creates a **custom message**. With an idle agent and no
   `triggerTurn`, Pi stores and emits that message but does not start an LLM
   turn. `display: true` controls terminal rendering. This is the API that
   matches Promptify's display-only result. [Pi extension docs,
   `pi.sendMessage()`](https://github.com/earendil-works/pi/blob/v1.5.2/packages/coding-agent/docs/extensions.md#pisendmessagemessage-options)

2. Pi's implementation appends the custom message, then emits both
   `message_start` and `message_end` events with `role: "custom"`. An RPC host
   therefore receives a complete, durable message event even though no agent
   turn starts. [Pi `AgentSession.sendCustomMessage()` source](https://github.com/earendil-works/pi/blob/v1.5.2/packages/coding-agent/src/core/agent-session.ts#L1931-L1985)

3. `pi.sendUserMessage()` is not a display-only substitute. When idle it sends
   a real user message and always starts a new agent turn. Using it for the
   draft would make the main agent execute the rewritten prompt, changing
   Promptify's contract. [Pi extension docs,
   `pi.sendUserMessage()`](https://github.com/earendil-works/pi/blob/v1.5.2/packages/coding-agent/docs/extensions.md#pisendusermessagecontent-options)

4. RPC reports an extension command as `disposition: "handled"`; that only
   means the command consumed the submitted prompt. Independent work and later
   output are reported through the normal event/message stream. A host must not
   treat `handled` as proof that no user-visible output follows. [Pi RPC command
   docs](https://github.com/earendil-works/pi/blob/v1.5.2/packages/coding-agent/docs/rpc-commands.md#prompt)

## Recommendation

Keep ravn-core's non-TUI `pi.sendMessage({ display: true })` behavior. The
integration boundary should translate Pi `message_start`/`message_end` events
whose message role is `custom` into a visible transcript item (while preserving
that it is not an assistant-model response). It should then settle the handled
command only after that custom message has been delivered.

Do **not** replace this with `sendUserMessage()` or `triggerTurn: true`: either
would execute the draft rather than merely return it. If a host cannot render
custom Pi messages, that is a host-adapter capability gap; the safe fallback is
an explicit unsupported-output error, not silently completing the command.

## A portable Promptify design

There is no single Pi presentation call that can guarantee the same result in
every host. Pi deliberately exposes four modes: TUI, RPC, JSON, and print. Only
TUI owns an input editor; RPC delegates dialogs and notifications to its client;
JSON and print have no UI. Pi therefore tells extensions to branch on `ctx.mode`
for terminal-only behavior and `ctx.hasUI` for dialogs supported by both TUI and
RPC. [Pi mode behavior](https://github.com/earendil-works/pi/blob/v1.5.2/packages/coding-agent/docs/extensions.md#mode-behavior)

The portable seam should be the generated draft, not a Pi UI operation:

```ts
interface PromptifyResult {
  request: string;
  draft: string;
  answer: string;
}

type PromptifySurface =
  | { kind: "tui"; setEditorText(text: string): void }
  | { kind: "dialog"; edit(title: string, prefill: string): Promise<string | undefined> }
  | { kind: "events"; emit(result: PromptifyResult): void };
```

The rewrite engine should return `PromptifyResult` and know nothing about Pi,
BB, a terminal, or an editor. Thin adapters then present it:

1. **Pi TUI:** retain `ctx.ui.setEditorText(draft)`, because this is the only
   surface that actually owns Pi's composer.
2. **Pi RPC with UI:** use `await ctx.ui.editor("Promptify draft", draft)`.
   Pi defines `editor` as a blocking, multiline dialog with prefilled content,
   and the RPC protocol carries it as an `extension_ui_request`. This displays
   the draft without sending it to the model. [Pi RPC extension UI,
   `editor`](https://github.com/earendil-works/pi/blob/v1.5.2/packages/coding-agent/docs/rpc-extension-ui.md#editor)
3. **JSON/print or an RPC client without dialog support:** emit the structured
   result through `pi.sendMessage({ customType: "promptify", content: draft,
   display: true })`, without `triggerTurn`, and also expose the same engine as
   a CLI whose stdout is exactly the draft. A host can consume the event; a
   shell, editor, or other agent can consume the CLI. The CLI is the universal
   fallback because stdout has a stable consumer-independent meaning.

BB already accepts Pi's RPC `editor` requests and turns `select`, `confirm`,
`input`, and `editor` into user interactions; it only drops fire-and-forget
methods such as `notify` and `set_editor_text`. See
`plugins/provider-pi/src/extension-ui-contract.ts` and
`plugins/provider-pi/src/bridge/extension-ui.ts` at BB commit
`35a03bbbb3f4d8dc814c1a152db5a463102b4250`. Using `ctx.ui.editor` for RPC is
therefore an immediate ravn-core-side solution for BB, while preserving the
correct custom-message fallback for other event consumers.

A cross-agent skill can wrap the CLI for Codex, Claude Code, Pi, or another
skill-aware harness, but it has a weaker invariant: invoking a skill starts an
agent turn, so its instructions must say to return the draft and not follow it.
The direct CLI and Pi presentation adapters preserve the stronger invariant
that the rewritten prompt is never executed.

## Concrete test through the seam

Given a fake rewrite runner that returns `{ request: "x", draft: "rewritten",
answer: "analysis" }`:

- the TUI adapter must place `rewritten` in the editor and send no message;
- the RPC adapter must issue one `editor` request whose prefill is `rewritten`
  and must send no user message or model-triggering custom message;
- the event adapter must emit one displayed custom message with no
  `triggerTurn` option; and
- the CLI must write `rewritten` followed by a newline to stdout and diagnostics
  only to stderr.

These are adapter contract tests. The rewrite engine itself only needs tests for
prompt construction, helper failure, cancellation, and extraction of the
`<promptify-draft>` block.
