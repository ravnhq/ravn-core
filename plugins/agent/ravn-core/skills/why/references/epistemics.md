# Epistemics

How to reason about confidence when evidence is historical, fragmentary, and sometimes contradictory. Code shows what it does, not *why it exists*; the why lives in commits, PRs, tickets, docs, and conversations, all incomplete and biased. The synthesizer runs the checklist in `synthesizer-prompt.md` before delivering.

## Confidence Tiers

Every claim in the output sits in one tier. The tier sets its section and its phrasing.

### 1. Direct

An explicit, textual citation answers the question: something an author actually *wrote* that says why, not "the code does X so the author must have wanted X." Examples: a PR description "this fixes the bug where users with >1000 items couldn't paginate", a code comment "// clamp to 100 because the upstream API rejects larger values", a chat message from the author "switching to this approach since the old one was flaky in tests".

Phrasing: confident, present tense, cited. "This exists because X."

### 2. Supported

Multiple pieces of indirect evidence converge on one conclusion. No single source states it, but the pattern across sources makes it likely: the PR title says "improve performance", the ticket is labeled "perf", and the surrounding commits all touch the same hot path.

Phrasing: confident but clearly derived, citing each item. "The evidence points strongly to X: [the specific pieces]."

### 3. Inferred

A reasonable reading of the context that nothing explicitly supports: *your interpretation*, not a fact from the record. The PR doesn't say why, but the error was happening in production (per the incident channel timing) and the fix merged the same day, so it was likely a hotfix.

Phrasing: hedged, with the chain explicit. "Given A and B, C seems likely because D."

### 4. Speculative

A plausible hypothesis on thin evidence, where other explanations fit equally well. Present it, since the user may know which is right, but mark it as a guess: "This might be a workaround for a browser bug that's since been fixed, but we found no contemporary evidence."

Phrasing: "One possibility is X, but we have no direct evidence." Usually lives in Competing Hypotheses.

### 5. Unknown

You looked and couldn't find out. A valid, important outcome. Name what you searched: "We searched the ticket tracker with keywords A and B, scanned the 6 PRs that touched this file since 2023, and grep'd the repo for string literals matching the threshold. None surfaced a rationale."

## Phrasing Guide

**Confidence words** imply Direct or Supported evidence and need a citation immediately adjacent, so keep them out of inferences: "because", "the reason is", "was designed to" (claims author intent), "fixes" / "addresses" / "solves" (claims the change achieved its goal), "the team decided" (claims a group decision happened).

**Hedges** signal interpretation: "appears to", "seems to", "likely", "suggests", "is consistent with", "one reading is", "plausibly", "may have been", "the evidence points toward". Use them in What We Can Reasonably Infer.

**Words to avoid:**

- "obviously", "clearly", "of course". If it were obvious, the user wouldn't be asking
- "just" (as in "it's just X for performance"). Dismissive and usually hides uncertainty
- "I think" / "I believe". You're synthesizing evidence, not giving an opinion. Write "the evidence suggests".

## Avoid Rationalization

Code that "makes sense" today may have been written for reasons that no longer apply, or that were wrong at the time. Take the history as it is: don't work backward from the "right" decision to a clean rationale, read a consistent pattern as intentional when it might be copy-paste, or turn an absence of evidence into evidence of absence ("no one mentioned security concerns, so it wasn't a concern").

## The Sycophancy Trap

Users often embed a hypothesis: "Why do we do it this way, I assume it's for performance?" The guess is a candidate among others. Check the evidence independently; say so with citations if it holds, and if not, present what the evidence *does* support.

## When Evidence Contradicts

Surface both sources, with citations, and let the user make the call. Both may be true (the ticket says "customer X's compliance requirement", the PR says "cleaning up tech debt": the ticket motivated the work, the PR gave the author's framing), or one may be wrong.

## When Evidence Is Missing

An honest "we don't know" is one of the most valuable outputs: the user learns the answer isn't in the obvious places, must ask a human (the original author, the product owner, the team lead), or can decide the question isn't worth pursuing. A confident guess in its place harms the user, who will act on it. Name each gap concretely: the question, the sources searched, what you searched for in each, and what you found (nothing, or only tangential material).
