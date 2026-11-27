import { eslintCompatPlugin } from "@oxlint/plugins";

import { noLiveTestRuntimeRule } from "./rules/no-live-test-runtime.ts";

/** Opt-in Oxlint rules that keep Effect tests on the test services. */
const testGuardsEffectPlugin = eslintCompatPlugin({
  meta: { name: "bad-test-terminator-effect" },
  rules: {
    "no-live-test-runtime": noLiveTestRuntimeRule,
  },
});

export default testGuardsEffectPlugin;
