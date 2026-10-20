---
name: create-verification-skill
description: "Generate a project-local verification skill that drives your app the way a user does — any language, framework, or platform. Use for /create-verification-skill, \"make a control skill for this repo\", or when a project has no scripted way to prove UI/CLI/service behavior."
disable-model-invocation: true
license: See LICENSE.txt
metadata:
  proof: subjective
---

# Create verification skill

Create a project-local `verify-<app>` skill that drives the real app and preserves evidence.

Inspect the repository for its user-facing surface, launch command, readiness signal, auth/data needs, existing automation, observable outputs, and isolation constraints. Ask only for missing decisions. Fix or report startup failures before generating instructions; label temporary scaffolding and remove it during cleanup.

Generate `SKILL.md` with name/description and these grounded sections:

- Launch: exact commands, readiness, teardown. Launch reaches a usable state from an empty data dir, including migrations and seed data; ready means usable, not just a process answering (a database health check can pass while its init scripts still run). Short-lived CLIs use fresh isolated sessions.
- Doctor: read-only checks for the correct live instance, build, port ownership, and auth.
- Drive: real user paths and stable selectors/commands; prefer existing harnesses.
- Evidence: actions, resulting state, and side effects. Observe what dry-run modes actually skip. Avoid internal setters and test-only shortcuts.
- Cleanup: stop only owned processes and remove scratch state, preserving evidence.
- Helpers: executable scripts with documented invocations.

Seed `features/README.md` and files for the top 3–5 user-facing features using [the feature-map example](references/feature-map-example/README.md). Each file needs `Sub-features`, `How to get to it (user POV)`, `Driving it with <harness>`, and `Gotchas`. When the seed data lacks a precondition a journey needs, the journey reports a failure and the reason goes in that feature's `Gotchas`; keep the journey as the user walks it.

Run the generated instructions: launch, doctor, drive one mapped feature, capture evidence, clean up, and confirm evidence survives. Clean failed attempts too. Unexecuted instructions are a draft. If you proved them on a stand-in for the real target (a container for a fresh VM, a local stack for a remote one), list every setup step the stand-in did that the target will not; those stay unverified until a run on the real target covers them. Point to `maintain-verification-skill` for upkeep; schedule nothing unless requested.
