# Specialist models

Every specialist runs in your own harness and model family. The tier JSON labels each specialist's `model` class `session` or `step-down`:

- `session`: spawn it on the model you are running on now.
- `step-down`: spawn it on the next cheaper model of the same family, where your harness lets a spawn pick a model. Where it does not, spawn it on your own model; the review is the same, only the cost differs.

| Harness | Your model | `step-down` spawn |
|---|---|---|
| Claude Code | Opus or Fable | Agent tool with `model: "sonnet"` |
| Claude Code | Sonnet | Agent tool with `model: "haiku"` |
| Claude Code | Haiku | No `model` override |
| Codex | GPT family | `spawn_agent` with `model` set to the smaller model of your family (the mini variant of your model), only when `spawn_agent` lists a `model` parameter; otherwise no override |
| Pi, or any harness without per-spawn models | any | No override |

Never spawn a model from another family or another harness: review stays inside the family that runs the session.
