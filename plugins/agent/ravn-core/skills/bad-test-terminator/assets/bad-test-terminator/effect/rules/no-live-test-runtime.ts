import { defineRule } from "@oxlint/plugins";

const runners = new Set(["runPromise", "runPromiseExit", "runSync", "runSyncExit", "runFork", "runCallback"]);

/** Ban the two ways an Effect test leaves the test services: a fresh runtime and `excludeTestServices`. */
export const noLiveTestRuntimeRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow `Effect.run*` and `excludeTestServices: true` in tests; both run the effect on the live clock instead of the TestClock.",
    },
    messages: {
      freshRuntime:
        "Return the effect from `it.effect` instead of calling `Effect.{{runner}}`: a fresh runtime has the live clock, so sleeps, timeouts and schedules wait for real time.",
      excludedServices:
        "Remove `excludeTestServices`: it drops the TestClock, so the tests in this layer wait for real time.",
    },
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        const callee = node.callee;
        if (callee.type !== "MemberExpression" || callee.computed) return;
        if (callee.object.type !== "Identifier" || callee.object.name !== "Effect") return;
        if (callee.property.type !== "Identifier" || !runners.has(callee.property.name)) return;
        context.report({ node, messageId: "freshRuntime", data: { runner: callee.property.name } });
      },
      Property(node) {
        if (node.computed || node.key.type !== "Identifier" || node.key.name !== "excludeTestServices") return;
        if (node.value.type === "Literal" && node.value.value === false) return;
        context.report({ node, messageId: "excludedServices" });
      },
    };
  },
});
