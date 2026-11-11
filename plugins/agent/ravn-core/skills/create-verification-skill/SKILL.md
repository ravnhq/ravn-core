---
name: create-verification-skill
description: "Generate a project-local verification skill. Use for /create-verification-skill, \"make a control skill for this repo\", or when a project has no scripted way to prove UI/CLI/service behavior."
disable-model-invocation: true
license: See LICENSE.txt
metadata:
  proof: subjective
---

# Create verification skill

Create a project-local `verify-<app>` skill that drives the real app and preserves evidence.

Inspect user-facing paths, launch command, readiness, auth/data needs, automation, outputs, and isolation. Ask only for missing decisions while continuing independent inspection. Diagnose startup failures and fix those within scope; report withheld access or protected changes as blockers. Label temporary scaffolding and remove it during cleanup.

Generate `SKILL.md` with name/description and these grounded sections:

- Launch: exact commands, readiness, teardown. Launch reaches a usable state from an empty data dir, including migrations and seed data; ready means usable, not just a process answering (a database health check can pass while its init scripts still run). Short-lived CLIs use fresh isolated sessions.
- Doctor: read-only checks for the correct live instance, build, port ownership, and auth.
- Drive: real user paths and stable selectors/commands; prefer existing harnesses.
- Evidence: actions, resulting state, and side effects. Observe what dry-run modes actually skip. Avoid internal setters and test-only shortcuts.
- Cleanup: stop only owned processes and remove scratch state, preserving evidence.
- Helpers: executable scripts with documented invocations.

Seed `features/README.md` and files for the top 3–5 user-facing features using [the feature-map example](references/feature-map-example/README.md). Each file needs `Sub-features`, `How to get to it (user POV)`, `Driving it with <harness>`, and `Gotchas`. When the seed data lacks a precondition a journey needs, the journey reports a failure and the reason goes in that feature's `Gotchas`; keep the journey as the user walks it.

Run the generated instructions: launch, doctor, drive one mapped feature, capture evidence, clean up, and confirm evidence survives. Clean failed attempts too. Unexecuted instructions are a draft; repeat passing checks only after relevant changes or failures. Report the result and evidence paths. If using a stand-in (a container for a VM, a local stack for a remote one), list setup steps the stand-in did that the target will not; those stay unverified until run on the real target. Point to `maintain-verification-skill` for upkeep; schedule only when requested.
