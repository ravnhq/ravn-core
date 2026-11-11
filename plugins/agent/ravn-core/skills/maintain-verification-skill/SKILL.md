---
name: maintain-verification-skill
description: "Audit a project's verification skill and feature map. Use for /maintain-verification-skill or \"audit the verify skill\"."
disable-model-invocation: true
license: See LICENSE.txt
metadata:
  proof: subjective
---

# Maintain verification skill

Audit an existing verification skill and feature map. Keep edits in its directory; report product regressions for separate repair.

1. Locate the target; clarify multiple candidates. If absent, use `create-verification-skill`. Reconcile the feature index with its files.
2. Read source for every feature. For large maps, delegate independent reads with the goal, known context, source paths, and a reply of behavior, cited drift, missing features, and live recipes as the done condition. Work inline for small maps or without subagents.
3. Reconcile overlapping recipes. One coordinator drives every feature live through the skill's launch model. Doctor before first use, each fresh session, and after unexpected behavior. Reset wedged state rather than guessing.
4. Preserve evidence across cleanup, stop only owned processes, and clean failed attempts. Diagnose errors and retry safe operations; report a blocker only for missing access, a protected prerequisite, or a product regression that prevents verification.
5. Fix documentation drift and harness gaps. Re-drive affected paths after each fix; reuse passing evidence for unchanged paths. Mark a feature unreachable only with its prerequisite and attempted route; document missing prerequisites.
6. Perform final teardown and confirm evidence survives. Lead the report with clean (source and live coverage complete), changed (one PR of proven corrections), or blocked (specific incomplete coverage), then evidence paths. Re-read changes before publication; clean/blocked outcomes need no PR.

Keep concise task-local coverage notes; do not commit them.
