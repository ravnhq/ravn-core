import type { ESTree } from "@oxlint/plugins";

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
      if (property.type !== "Literal" || typeof property.value !== "string") return null;
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
  return parent !== null && parent !== undefined && parent.type === "CallExpression" && parent.callee === node;
}
