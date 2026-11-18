# Ask Ravn

The router maps user intent to installed commands and says which start on their own. It ends there.

## Sub-features

- `router.enter`: distinguish user-journey creation from resyncing a formal check.
- `router.mode`: print the harness's real invocation forms for `verification-skill create` and `formal-verification-skill maintain`, both explicit.
- `router.read-only`: read recommendations' frontmatter but run neither workflow.

## How to get to it (user POV)

Ask which command creates a guide for a local notes CLI and which keeps a formal proof in sync after code changes; request a map only.

## Driving it with a scratch repo

Use `scripts/scratch.ts authoring <dir>` and the [harness setup](README.md#harness-runs). Invoke `ask-ravn` under `scripts/collect.ts`. Quote the two command forms and how each starts. Check the trace for reads of the two entry files and the diff for no generated guide, PR, or product change.

## Gotchas

- Reading the recommended skill is how the router checks its facts. Operating the CLI or generating a proof guide is execution and fails `router.read-only`.
