import type { Context, ESTree } from "@oxlint/plugins";

const testApiRoots = new Set(["it", "test", "describe", "suite", "bench"]);

/**
 * The names of a callee chain, root first: `it.effect.only` gives ["it", "effect", "only"],
 * and `it.each(cases)("name", fn)` gives ["it", "each"]. Null when the callee is not a plain chain.
 */
export function calleeChain(callee: ESTree.Node): string[] | null {
  const names: string[] = [];
  let current: ESTree.Node = callee;
  for (;;) {
    if (current.type === "Identifier") {
      names.unshift(current.name);
      return names;
    }
    if (current.type === "CallExpression") {
      current = current.callee;
      continue;
    }
    if (current.type !== "MemberExpression") return null;
    const property = current.property;
    if (current.computed) {
      if (property.type !== "Literal" || typeof property.value !== "string")
        return null;
      names.unshift(property.value);
    } else {
      if (property.type !== "Identifier") return null;
      names.unshift(property.name);
    }
    current = current.object;
  }
}

/** True for a chain rooted at a test API such as `it`, `test` or `describe`, including wrappers like `it.effect`. */
export function isTestApiChain(chain: readonly string[]): boolean {
  const root = chain[0];
  return root !== undefined && testApiRoots.has(root);
}

/** True when this call is the callee of an outer call, as `it.each(cases)` is in `it.each(cases)("name", fn)`. */
export function isCalleeOfOuterCall(node: ESTree.CallExpression): boolean {
  const parent = node.parent;
  return (
    parent !== null &&
    parent !== undefined &&
    parent.type === "CallExpression" &&
    parent.callee === node
  );
}

const runnerModules = new Set([
  "vitest",
  "@effect/vitest",
  "@jest/globals",
  "bun:test",
  "node:test",
  "node:assert",
  "node:assert/strict",
  "assert",
  "assert/strict",
]);

function importedChain(
  source: string,
  imported: string,
  tail: string[],
): string[] {
  if (source.replace("node:", "").startsWith("assert"))
    return [
      "assert",
      ...(imported === "*" || imported === "default" ? [] : [imported]),
      ...tail,
    ];
  if (imported === "*") return tail;
  if (imported === "default" && source === "node:test")
    return tail.length === 0 || tail[0] === "only" || tail[0] === "skip"
      ? ["test", ...tail]
      : tail;
  return [imported, ...tail];
}

/** Resolve imports and test-context parameters using their bindings, including CommonJS. */
export function runnerChain(
  context: Context,
  callee: ESTree.Node,
): string[] | null {
  const chain = calleeChain(callee);
  if (chain === null) return null;
  const root = chain[0];
  if (root === undefined) return null;
  let scope = context.sourceCode.getScope(callee);
  for (;;) {
    const variable = scope.set.get(root);
    if (variable !== undefined && variable.defs.length > 0) {
      const definition = variable.defs[0];
      if (definition === undefined) return null;
      const binding = definition.node;
      const declaration = definition.parent;
      if (
        definition.type === "ImportBinding" &&
        declaration?.type === "ImportDeclaration"
      ) {
        const source = String(declaration.source.value);
        if (!runnerModules.has(source)) return null;
        if (binding.type === "ImportSpecifier") {
          const imported = binding.imported;
          return importedChain(
            source,
            imported.type === "Identifier"
              ? imported.name
              : String(imported.value),
            chain.slice(1),
          );
        }
        return importedChain(
          source,
          binding.type === "ImportNamespaceSpecifier" ? "*" : "default",
          chain.slice(1),
        );
      }
      if (
        binding.type === "VariableDeclarator" &&
        binding.init?.type === "CallExpression" &&
        binding.init.callee.type === "Identifier" &&
        binding.init.callee.name === "require"
      ) {
        const source = binding.init.arguments[0];
        if (
          source?.type !== "Literal" ||
          typeof source.value !== "string" ||
          !runnerModules.has(source.value)
        )
          return null;
        if (binding.id.type === "ObjectPattern") {
          for (const property of binding.id.properties) {
            if (
              property.type !== "Property" ||
              property.value.type !== "Identifier" ||
              property.value.name !== root
            )
              continue;
            const imported = property.key;
            if (imported.type === "Identifier" && !property.computed)
              return importedChain(source.value, imported.name, chain.slice(1));
          }
        }
        if (binding.id.type === "Identifier")
          return importedChain(
            source.value,
            source.value === "node:test" ? "default" : "*",
            chain.slice(1),
          );
      }
      if (
        definition.type === "Parameter" &&
        (binding.type === "ArrowFunctionExpression" ||
          binding.type === "FunctionExpression") &&
        binding.params[0]?.type === "Identifier" &&
        binding.params[0].name === root
      ) {
        const call = binding.parent;
        if (call?.type === "CallExpression") {
          const owner = runnerChain(context, call.callee);
          if (owner !== null && isRunnerTestChain(owner))
            return ["test-context", ...chain.slice(1)];
        }
      }
      return null;
    }
    if (scope.upper === null) return chain;
    scope = scope.upper;
  }
}

/** Node subtests are declared on the test context. */
export function isRunnerTestChain(chain: readonly string[]): boolean {
  return (
    isTestApiChain(chain) ||
    (chain[0] === "test-context" && chain[1] === "test")
  );
}
