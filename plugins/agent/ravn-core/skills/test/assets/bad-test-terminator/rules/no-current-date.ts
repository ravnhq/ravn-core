import { defineRule } from "@oxlint/plugins";

import type { ESTree } from "@oxlint/plugins";

/** Ban reading the wall clock through `new Date()` and `Date()`, which `no-restricted-properties` cannot express. */
export const noCurrentDateRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow `new Date()` and `Date()` without arguments in tests; they read the wall clock.",
    },
    messages: {
      currentDate:
        'Pass a fixed instant (`new Date("2026-01-01T00:00:00Z")`) or read time through a clock the test controls.',
    },
  },
  createOnce(context) {
    const check = (node: ESTree.NewExpression | ESTree.CallExpression): void => {
      if (node.arguments.length > 0 || node.callee.type !== "Identifier" || node.callee.name !== "Date") return;
      if (context.sourceCode.isGlobalReference(node.callee)) context.report({ node, messageId: "currentDate" });
    };

    return { NewExpression: check, CallExpression: check };
  },
});
