---
name: improve-codebase-architecture
description: Scan a codebase for deepening opportunities, present them as a visual HTML report, then grill through whichever one you pick.
disable-model-invocation: true
license: See LICENSE.txt
metadata:
  proof: subjective
---

# Improve Codebase Architecture

Surface architectural friction and propose **deepening opportunities**: refactors that turn shallow modules into deep ones, for testability and AI-navigability.

Use the `codebase-design` skill's vocabulary and principles in every suggestion. The domain language in `GLOSSARY.md` names good seams; ADRs in `docs/adr/` record decisions not to re-litigate.

Work through scan or rendering failures; pause for the candidate choice, user design decisions, or deliberately withheld access needed to proceed.

## Process

### 1. Explore

**Scope before you scan (YAGNI).** Deepening pays off by easing future changes, so weight recently changed code. Decide where to look first:

- If the user named a direction (a module, subsystem, or pain point), take it and skip the inference below.
- Otherwise read `git log --oneline` far enough back to find the hot spots, the files that keep coming up, and start there. With no clear hot spot, widen the net.

Read `GLOSSARY.md` and ADRs in the area. Explore a small area inline; delegate a broad scan to keep bulk out of the main context, or scan inline without sub-agents. Brief the explorer with the scope, known glossary and ADR constraints, and questions below; require evidence-backed candidates with file paths, friction, and dependency categories:

- Where does understanding one concept require bouncing between many small modules?
- Where are modules **shallow**?
- Where are pure functions extracted just for testability while the real bugs hide in how they're called (no **locality**)?
- Where do tightly-coupled modules leak across their seams?
- Which parts are untested, or hard to test through their current interface?

Apply `codebase-design`'s **deletion test** to each suspected shallow module.

### 2. Present candidates as an HTML report

Write a self-contained HTML file to `<tmpdir>/architecture-review-<timestamp>.html` so nothing lands in the repo and each run gets a fresh file; `<tmpdir>` is `$TMPDIR`, else `/tmp` (`%TEMP%` on Windows). Open it for the user (`xdg-open` on Linux, `open` on macOS, `start` on Windows) and tell them the absolute path.

Follow [HTML-REPORT.md](HTML-REPORT.md) for the scaffold, card contents, diagram patterns, and tone. Every candidate gets a card with a before/after diagram; the report ends with a **Top recommendation**.

Name the domain with `GLOSSARY.md` terms ("the Order intake module," not "the FooBarHandler"), the architecture with `codebase-design` terms.

**ADR conflicts**: surface a candidate that contradicts an existing ADR only when the friction warrants reopening it, and mark it in the card (_"contradicts ADR-0007, but worth reopening because..."_). Skip refactors an ADR forbids that are merely theoretical.

Keep interface proposals for Step 3. Once the report's diagrams render and its path is delivered, ask: "Which of these would you like to explore?" Wait for the candidate choice.

### 3. Grilling loop

Once the user picks a candidate, use the grilling skill to walk the decision tree: constraints, dependencies, the shape of the deepened module, what sits behind the seam, what tests survive.

As decisions crystallize, use the domain-modeling skill to keep the model current inline:

- **A deepened module named after a concept missing from `GLOSSARY.md`**, or **a fuzzy term sharpened**: update `GLOSSARY.md` right there, creating it lazily.
- **User rejects the candidate with a load-bearing reason:** apply `domain-modeling`'s ADR criteria before offering to record the reason.
- **User wants alternative interfaces:** use the `codebase-design` skill's design-it-twice pattern.

Finish when the grilling loop reaches shared understanding and resolved terms and accepted ADRs are recorded; implementing the refactor requires a request to do so.
