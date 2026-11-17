import { defineRule } from "@oxlint/plugins";

import { calleeChain, isCalleeOfOuterCall, isTestApiChain } from "../shared/test-api.ts";

const prefixedAliases = new Map([
  ["fit", "focused"],
  ["fdescribe", "focused"],
  ["xit", "skipped"],
  ["xtest", "skipped"],
  ["xdescribe", "skipped"],
] as const);

/** Ban `.only` and `.skip` on any test API chain, including wrappers such as `it.effect.only`. */
export const noFocusedOrSkippedTestsRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow focused and unconditionally skipped tests on every test API chain, including wrapper APIs the built-in rules do not know.",
    },
    messages: {
      focused: "Remove `.only`: a focused test silently stops the rest of the suite from running.",
      skipped:
        "Remove `.skip`: fix the test or delete it. Use `skipIf` when a platform condition decides whether it can run.",
    },
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        if (isCalleeOfOuterCall(node)) return;
        const chain = calleeChain(node.callee);
        if (chain === null) return;
        const alias = chain.length === 1 ? prefixedAliases.get(chain[0] as "fit") : undefined;
        if (alias !== undefined) {
          context.report({ node: node.callee, messageId: alias });
          return;
        }
        if (!isTestApiChain(chain)) return;
        const modifiers = chain.slice(1);
        if (modifiers.includes("only")) context.report({ node: node.callee, messageId: "focused" });
        else if (modifiers.includes("skip")) context.report({ node: node.callee, messageId: "skipped" });
      },
    };
  },
});
