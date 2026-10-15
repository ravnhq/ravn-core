import type { UnifiedConfig } from "promptfoo";

const config: UnifiedConfig = {
  prompts: ["{{request}}"],
  providers: [],
  defaultTest: {
    assert: [
      {
        type: "max-score",
        value: {
          method: "average",
          threshold: 0.7,
          weights: { "llm-rubric": 4, "skill-used": 2 },
        },
      },
    ],
  },
};

export default config;
