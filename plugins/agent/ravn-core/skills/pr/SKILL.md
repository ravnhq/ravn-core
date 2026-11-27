---
name: pr
description: Draft or update a GitHub PR body (with before/after screenshots for visual changes), or babysit an open PR or stack through CI, reviews, and conflicts to merge-ready.
disable-model-invocation: true
license: See LICENSE.txt
metadata:
  proof: subjective
---

# PR

Choose the mode from the user's request:

- **Babysit an existing PR or stack** (clear CI failures, conflicts, review threads, check merge readiness, or merge when asked): read and follow [Babysit](references/babysit.md).
- **Draft or update a PR body** (default for pushed work or an existing PR description): follow the template and rules below.

---

## PR Body Template

```markdown
<opener>

<optional: screenshot or short output>

<details>
<summary><model name and effort level></summary>

## Summary

<diagram, diff-sketch, or tree>

## Evidence

- **Before:** <screenshot/output/failing test run>
  **After:** <screenshot/output/passing test run>

## Merge Danger

**Door:** <one-way or two-way>

<optional: description>

**Blast Radius:** <one-word description>

<optional: potential ramifications of merge>

</details>
```

Keep the blank lines around `<summary>` and before `</details>`: GitHub renders Markdown inside `<details>` only with them.

## Sections

Skip all preambles and keep prose brief. Use the user's domain language from `GLOSSARY.md`.

### Opener

The shortest text that tells a reviewer what the PR is for and whether it deserves more of their attention: one to three sentences in plain words, naming the problem and the outcome. A visual change gets one "after" screenshot below it, taken by [references/screenshots.md](references/screenshots.md); a new command can get its `--help` output. Everything else goes in the collapsed details.

Write it last, from the sections below. Also show it to the user in your reply, apart from the body, so they can rewrite it.

### Details summary

Your model name and effort level, as in `Claude Opus 5.5 Medium`, so the reader knows an agent wrote what it hides. Drop the effort level when you cannot find it.

### Summary

Pick the smallest view that makes the key point clear:

- **Algorithm/logic:** concise pseudocode.
- **Runtime control flow:** call tree or Mermaid `sequenceDiagram`.
- **UI structure:** component tree naming key state and module boundaries.
- **Broad refactor:** shallow file tree.
- **Incremental change:** `diff` over the same shape (component tree, file tree, call tree, or pseudocode).

Place each visual next to the short text it supports. Keep only the calls, files, props, states, and boundaries the reader needs to grasp the change. Most changes need one visual.

### Evidence

Concrete before and after evidence that the change works:

- **Visual change:** screenshots of the real build. Before writing the body, read [references/screenshots.md](references/screenshots.md): it covers capture, redaction, before/after tables, and upload.
- **Non-visual change:** execution output, test results, or console output showing the failing check and the passing check.

### Merge Danger

- **Door:** a two-way door can be walked back; a one-way door cannot. Destructive actions and hard-to-reverse decisions are one-way.
- **Blast radius:** the scope of what the merge can affect (e.g., layout shift, downstream consumers, mobile responsiveness).
