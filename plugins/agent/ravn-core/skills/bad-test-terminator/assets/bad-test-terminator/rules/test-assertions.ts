import { defineRule, type ESTree } from "@oxlint/plugins";

import {
  calleeChain,
  isRunnerTestChain,
  runnerChain,
} from "../shared/test-api.ts";

type Callback = ESTree.ArrowFunctionExpression | ESTree.Function;

/** Check assertions through each runner's imported APIs. */
export const testAssertionsRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Require assertions and reject snapshots and mock call assertions.",
    },
    schema: [
      {
        type: "object",
        properties: { matchers: { type: "array", items: { type: "string" } } },
        additionalProperties: false,
      },
    ],
    messages: {
      missing: "Assert the behavior this test guards.",
      invalid: "Complete the expect assertion with a matcher call.",
      standalone: "Put this assertion inside a test or lifecycle hook.",
      conditional:
        "Assert on every execution path; a conditional assertion can silently pass.",
      snapshot:
        "Assert the properties the behavior requires instead of a snapshot.",
      calls: "Assert on the result or the recorded state of an injected fake.",
    },
  },
  create(context) {
    // SAFETY: the rule schema validates the optional matcher list.
    const options = context.options[0] as { matchers?: string[] } | undefined;
    const restricted = new Set(options?.matchers ?? []);
    const callbacks = new Map<Callback, boolean>();
    return {
      CallExpression(node) {
        const chain = runnerChain(context, node.callee);
        if (
          chain !== null &&
          isRunnerTestChain(chain) &&
          !["describe", "suite", "bench"].includes(chain[0] ?? "") &&
          !chain.includes("todo")
        ) {
          for (const argument of node.arguments) {
            if (
              argument.type === "ArrowFunctionExpression" ||
              argument.type === "FunctionExpression"
            )
              callbacks.set(argument, false);
          }
        }
        if (chain?.[0] === "test-context" && chain[1] === "test") {
          let parent: ESTree.Node | null = node.parent;
          while (parent !== null) {
            if (
              (parent.type === "ArrowFunctionExpression" ||
                parent.type === "FunctionExpression") &&
              callbacks.has(parent)
            ) {
              callbacks.set(parent, true);
              break;
            }
            parent = parent.parent;
          }
        }
        const isExpect = chain?.[0] === "expect";
        const assertion =
          chain !== null &&
          ((isExpect && chain.length === 1) ||
            chain[0] === "assert" ||
            (chain[0] === "test-context" && chain[1] === "assert"));
        if (isExpect && chain.length > 1 && restricted.has(chain.at(-1) ?? ""))
          context.report({
            node,
            messageId: chain.at(-1)?.includes("Snapshot")
              ? "snapshot"
              : "calls",
          });
        if (assertion) {
          if (chain.includes("snapshot") || chain.includes("fileSnapshot"))
            context.report({ node, messageId: "snapshot" });
          if (isExpect) {
            let outer: ESTree.Node = node;
            while (
              outer.parent?.type === "MemberExpression" ||
              (outer.parent?.type === "CallExpression" &&
                outer.parent.callee === outer)
            )
              outer = outer.parent;
            const names =
              outer.type === "CallExpression"
                ? runnerChain(context, outer.callee)
                : null;
            if (
              names === null ||
              names.length < 2 ||
              ["not", "resolves", "rejects"].includes(names.at(-1) ?? "")
            )
              context.report({ node, messageId: "invalid" });
          }
          let parent: ESTree.Node | null = node.parent;
          let inside = false;
          let conditional = false;
          while (parent !== null && parent !== undefined) {
            if (
              (parent.type === "ArrowFunctionExpression" ||
                parent.type === "FunctionExpression") &&
              callbacks.has(parent)
            ) {
              callbacks.set(parent, true);
              inside = true;
              break;
            }
            if (
              [
                "IfStatement",
                "ConditionalExpression",
                "CatchClause",
                "SwitchCase",
                "LogicalExpression",
              ].includes(parent.type)
            )
              conditional = true;
            if (
              (parent.type === "ArrowFunctionExpression" ||
                parent.type === "FunctionExpression") &&
              parent.parent?.type === "CallExpression"
            ) {
              const owner = runnerChain(context, parent.parent.callee);
              if (
                owner !== null &&
                ["beforeEach", "afterEach", "beforeAll", "afterAll"].includes(
                  owner[0] ?? "",
                )
              )
                inside = true;
            }
            parent = parent.parent;
          }
          if (isExpect && !inside)
            context.report({ node, messageId: "standalone" });
          if (conditional) context.report({ node, messageId: "conditional" });
        }
      },
      MemberExpression(node) {
        const chain = calleeChain(node);
        if (chain !== null) {
          // Mock function bindings are local; their `.mock` tracker still identifies call assertions.
          const property = node.property;
          const object = node.object;
          const name =
            property.type === "Identifier" && !node.computed
              ? property.name
              : property.type === "Literal"
                ? property.value
                : null;
          if (
            object.type === "MemberExpression" &&
            chain.at(-2) === "mock" &&
            (name === "calls" || name === "callCount")
          )
            context.report({ node, messageId: "calls" });
        }
      },
      "Program:exit"() {
        for (const [callback, asserted] of callbacks) {
          if (!asserted)
            context.report({ node: callback, messageId: "missing" });
        }
      },
    };
  },
});
