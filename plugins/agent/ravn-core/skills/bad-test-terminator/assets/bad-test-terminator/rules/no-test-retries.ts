import { defineRule } from "@oxlint/plugins";

import { calleeChain, isTestApiChain } from "../shared/test-api.ts";

/** Ban the `retry` test option, which turns an intermittent failure into a pass. */
export const noTestRetriesRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow the `retry` option on tests and suites; a retried test hides the flakiness it has.",
    },
    messages: {
      retry:
        "Remove `retry`: a test that passes on a later attempt is flaky. Find the nondeterministic input (time, order, concurrency, network) and control it.",
    },
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        const chain = calleeChain(node.callee);
        if (chain === null || !isTestApiChain(chain)) return;
        for (const argument of node.arguments) {
          if (argument.type !== "ObjectExpression") continue;
          for (const property of argument.properties) {
            if (property.type !== "Property" || property.computed) continue;
            const named =
              (property.key.type === "Identifier" && property.key.name === "retry") ||
              (property.key.type === "Literal" && property.key.value === "retry");
            if (!named) continue;
            if (property.value.type === "Literal" && property.value.value === 0) continue;
            context.report({ node: property, messageId: "retry" });
          }
        }
      },
    };
  },
});
