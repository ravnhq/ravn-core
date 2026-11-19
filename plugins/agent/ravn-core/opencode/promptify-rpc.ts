import { Rpc } from "@opencode/plugin/rpc";
import { Schema } from "effect";

export const promptifyRpc = Rpc.define({
  id: "ravn-promptify",
  methods: {
    draft: {
      input: Schema.toStandardSchemaV1(
        Schema.Struct({ sessionID: Schema.String }),
      ),
      output: Schema.toStandardSchemaV1(
        Schema.Struct({ text: Schema.String, draft: Schema.String }),
      ),
    },
  },
  events: {},
});
