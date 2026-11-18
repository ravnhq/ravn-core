import { eslintCompatPlugin } from "@oxlint/plugins";

import { testAssertionsRule } from "./rules/test-assertions.ts";
import { noTestDoublesRule } from "./rules/no-test-doubles.ts";
import { noCurrentDateRule } from "./rules/no-current-date.ts";
import { noFocusedOrSkippedTestsRule } from "./rules/no-focused-or-skipped-tests.ts";
import { noTestRetriesRule } from "./rules/no-test-retries.ts";

/** Oxlint rules for test files that close the gaps the built-in restriction and Vitest rules leave. */
const testGuardsPlugin = eslintCompatPlugin({
  meta: { name: "bad-test-terminator" },
  rules: {
    "no-current-date": noCurrentDateRule,
    "no-test-doubles": noTestDoublesRule,
    "test-assertions": testAssertionsRule,
    "no-focused-or-skipped-tests": noFocusedOrSkippedTestsRule,
    "no-test-retries": noTestRetriesRule,
  },
});

export default testGuardsPlugin;
