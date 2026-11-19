import { Command, Plugin } from "@opencode/plugin/gui";

import { promptifyRpc } from "./promptify-rpc.ts";

export default Plugin.define({
  setup(ctx) {
    ctx.add(Command, {
      id: "insert-promptify-draft",
      title: "Insert Promptify draft",
      section: "prompt",
      slash: { name: "promptify-insert" },
      async run() {
        const session = ctx.sessions.current();

        if (!session) return;

        const { text, draft } = await session.server.client
          .rpc(promptifyRpc)
          .draft({ sessionID: session.id }, { location: session.location });

        if (!draft) {
          ctx.toast.show({ title: text });

          return;
        }

        if (ctx.sessions.current()?.key !== session.key) return;

        const composer = ctx.screen.current()?.composer;

        if (composer)
          composer.insert(`${composer.text() ? "\n\n" : ""}${draft}`);
      },
    });
  },
});
