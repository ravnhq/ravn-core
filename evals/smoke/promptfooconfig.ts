import { skillEval } from "../skill-eval.ts";

export default skillEval("greet", [
  {
    kind: "quality",
    description: "every runner loads and uses a skill",
    fixture: "repo-a",
    request: "Hi there, use the greet skill.",
    assert: [{ type: "icontains", value: "help" }],
  },
  // greet-explicit sets disable-model-invocation, as the vendored ravn-core
  // skills do: its command must load it, and nothing else may.
  {
    kind: "quality",
    description: "every runner loads a skill from its command",
    skill: "greet-explicit",
    fixture: "repo-a",
    request: "please",
    invoked: true,
    assert: [{ type: "icontains", value: "PINEAPPLE-42" }],
  },
  {
    kind: "stay-out",
    description: "no runner loads a skill the model may not invoke",
    fixture: "repo-a",
    request: "Hi there, say hello.",
    skills: ["greet-explicit"],
  },
]);
