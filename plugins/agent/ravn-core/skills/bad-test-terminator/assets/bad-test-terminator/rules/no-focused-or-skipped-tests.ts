import { defineRule } from "@oxlint/plugins";

import {
  runnerChain,
  isCalleeOfOuterCall,
  isRunnerTestChain,
} from "../shared/test-api.ts";

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
      focused:
        "Remove `.only`: a focused test silently stops the rest of the suite from running.",
      skipped:
        "Remove `.skip`: fix the test or delete it. Use `skipIf` when a platform condition decides whether it can run.",
    },
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        if (isCalleeOfOuterCall(node)) return;
        const chain = runnerChain(context, node.callee);
        if (chain === null) return;
        const alias =
          chain.length === 1
            ? prefixedAliases.get(chain[0] as "fit")
            : undefined;
        if (alias !== undefined) {
          context.report({ node: node.callee, messageId: alias });
          return;
        }
        if (chain[0] === "test-context" && chain[1] === "runOnly") {
          if (
            !(
              node.arguments[0]?.type === "Literal" &&
              node.arguments[0].value === false
            )
          )
            context.report({ node, messageId: "focused" });
          return;
        }
        if (!isRunnerTestChain(chain)) return;
        for (const argument of node.arguments) {
          if (argument.type !== "ObjectExpression") continue;
          for (const property of argument.properties) {
            if (property.type !== "Property") continue;
            const key =
              property.key.type === "Identifier" && !property.computed
                ? property.key.name
                : property.key.type === "Literal"
                  ? property.key.value
                  : null;
            if (key !== "only" && key !== "skip") continue;
            if (
              property.value.type === "Literal" &&
              property.value.value === false
            )
              continue;
            // Conditional skip values retain platform gating; focus always selects a subset.
            if (
              key === "skip" &&
              !(
                property.value.type === "Literal" &&
                (property.value.value === true ||
                  (typeof property.value.value === "string" &&
                    property.value.value.length > 0))
              )
            )
              continue;
            context.report({
              node: property,
              messageId: key === "only" ? "focused" : "skipped",
            });
          }
        }
        const modifiers = chain.slice(1);
        if (modifiers.includes("only"))
          context.report({ node: node.callee, messageId: "focused" });
        else if (modifiers.includes("skip"))
          context.report({ node: node.callee, messageId: "skipped" });
      },
    };
  },
});
