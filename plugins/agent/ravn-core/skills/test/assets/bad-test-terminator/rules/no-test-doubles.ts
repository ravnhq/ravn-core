import { defineRule } from "@oxlint/plugins";

import { runnerChain } from "../shared/test-api.ts";

/** Recognize the runner APIs that replace modules or spy on real dependencies. */
export const noTestDoublesRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Use injected dependencies instead of module mocks and spies.",
    },
    messages: {
      double:
        "Inject a fake dependency and assert on its result or recorded state.",
    },
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        const chain = runnerChain(context, node.callee);
        if (chain === null) return;
        const root = chain[0];
        const method = chain.at(-1);
        const jestOrVi =
          (root === "jest" || root === "vi") &&
          ["mock", "doMock", "spyOn", "unstable_mockModule"].includes(
            method ?? "",
          );
        const bun =
          (root === "spyOn" && chain.length === 1) ||
          (root === "mock" && method === "module");
        const nodeMock =
          (root === "mock" ||
            (root === "test-context" && chain[1] === "mock")) &&
          ["module", "method", "getter", "setter"].includes(method ?? "");
        if (jestOrVi || bun || nodeMock)
          context.report({ node, messageId: "double" });
      },
    };
  },
});
