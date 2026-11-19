import type { UnifiedConfig } from "promptfoo";

const config: UnifiedConfig = {
  prompts: [],
  providers: [],
  defaultTest: {
    assert: [
      {
        type: "max-score",
        value: {
          method: "average",
          threshold: 0.7,
          // skillEval emits only outcome rubrics and workspace assertions
          // for comparable cases. Selection and reference reads gate pnpm eval.
          weights: { "llm-rubric": 4, javascript: 1 },
        },
      },
    ],
  },
};

export default config;
