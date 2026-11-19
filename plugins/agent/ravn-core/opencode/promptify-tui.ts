import { Plugin } from "@opencode/plugin/tui";

import { promptifyRpc } from "./promptify-rpc.ts";

export default Plugin.define({
  id: "ravn-core",
  setup(ctx) {
    ctx.keymap.layer(() => ({
      mode: "global",
      commands: [
        {
          id: "ravn-promptify-draft",
          title: "Show Promptify draft",
          palette: true,
          slash: { name: "promptify-draft" },
          async run() {
            const route = ctx.ui.router.current();

            if (route.type !== "session") return;

            const result = await ctx.client
              .rpc(promptifyRpc)
              .draft(
                { sessionID: route.sessionID },
                { location: ctx.location },
              );

            const current = ctx.ui.router.current();

            if (
              current.type !== "session" ||
              current.sessionID !== route.sessionID
            )
              return;

            await ctx.ui.dialog.alert({
              title: "Promptify",
              message: result.text,
            });
          },
        },
      ],
    }));
  },
});
