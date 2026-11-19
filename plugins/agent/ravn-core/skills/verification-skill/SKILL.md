---
name: verification-skill
description: Create or maintain a project guide that drives the real app and preserves evidence.
disable-model-invocation: true
license: See LICENSE.txt and LICENSE-maintain.txt
metadata:
  proof: subjective
---

# Verification skill

Create or maintain the project's `verify-<app>` skill. The deliverable is a guide another engineer can run on the real user surface, with evidence that survives cleanup.

- **`create`:** For a project without a verification guide, read [Create](references/create.md). Start from the actual launch path and prove one mapped journey end to end.
- **`maintain`:** For an existing guide or feature map, read [Maintain](references/maintain.md). Drive every mapped feature and correct only the verification files. If no guide exists, report it and ask before switching to creation.

An explicit mode wins. Otherwise infer it from whether the user asked to create or audit a guide; ask only when the requested scope is ambiguous. A change to launch, setup data, or the driver invalidates the affected journey's evidence until it is driven again.

This command replaces `create-verification-skill` and `maintain-verification-skill`.
