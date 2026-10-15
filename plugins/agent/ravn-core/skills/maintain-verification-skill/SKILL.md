---
name: maintain-verification-skill
description: "Periodic pass that keeps a project's verification skill and feature map honest: parallel source readers per feature, one live session driving every feature, at most one PR of proven corrections. Use for /maintain-verification-skill or \"audit the verify skill\"."
disable-model-invocation: true
license: See LICENSE.txt
metadata:
  proof: subjective
---

# Maintain verification skill

Audit an existing verification skill and feature map. Edit only its directory, never product code.

1. Locate the target; clarify multiple candidates. If absent, use `create-verification-skill`. Reconcile the feature index with its files.
2. Read source for every feature, delegating independent read-only slices when permitted. Collect behavior, cited drift, and a live-verification recipe; find missing features from concrete source paths.
3. Reconcile overlapping recipes. One coordinator drives every feature live through the skill's launch model. Doctor before first use, each fresh session, and after unexpected behavior. Reset wedged state rather than guessing.
4. Preserve evidence across cleanup and stop only owned processes. Clean failed attempts. Correct a drift-caused doctor failure and retry once before reporting a blocker.
5. Fix documentation drift and harness gaps; report product regressions without disguising them in docs. Re-drive every harness fix. Mark a feature unreachable only with its prerequisite and attempted route; document missing prerequisites.
6. Perform final teardown and confirm evidence survives. Report clean (source and live coverage complete), changed (one PR of proven corrections), or blocked (specific incomplete coverage). Re-read changes before publication; clean/blocked outcomes need no PR.

Keep concise task-local coverage notes; do not commit them.
