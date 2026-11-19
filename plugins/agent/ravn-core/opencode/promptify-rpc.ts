import { Rpc } from "@opencode/plugin";
import { z } from "zod";

export const promptifyRpc = Rpc.define({
  id: "ravn-promptify",
  methods: {
    draft: {
      input: z.object({ sessionID: z.string() }),
      output: z.object({ text: z.string(), draft: z.string() }),
    },
  },
  events: {},
});
