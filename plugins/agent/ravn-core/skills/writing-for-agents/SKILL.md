---
name: writing-for-agents
description: Writing documents for agents. Use when creating or editing skills, or modifying AGENTS.md or CLAUDE.md.
license: See LICENSE.txt
metadata:
  proof: subjective
---

Reference for writing any document an agent consumes: a skill, an `AGENTS.md` / `CLAUDE.md`, a doc reached by a pointer. The packaging differs; the writing does not. The same levers make each one predictable, since the agent takes the same _process_ every run rather than producing the same output.

For a skill, read [`SKILL-MECHANICS.md`](SKILL-MECHANICS.md) for frontmatter, invocation choice, and router skills.

## Context pointers

A **context pointer** is a reference held in the agent's context that names out-of-context material and encodes the condition for reaching it. A skill's description is one; a line in `AGENTS.md` naming a doc is the same object. The pointer's _wording_, not its target, decides when and how reliably the agent reaches the material. A must-have target behind a weakly worded pointer is a variance bug: sharpen the wording first, and inline the material only if sharpening fails.

A pointer states what the material is and lists the **branches** that should trigger reaching it (a branch is a distinct case the document handles, so different runs take different paths through it). A repo-specific instruction names the material to inspect and the check or prerequisite that bounds its claim; put the detailed procedure behind the pointer. An always-loaded pointer pays on every turn, so it earns harder pruning than the body:

- **Front-load the leading word.**
- **One trigger per branch.** Synonyms that rename a branch are one branch written twice; keep only genuinely distinct branches.
- **Name the event.** "Adding or changing a migration" fires on the work; a domain ("working with databases") fires on everything near it.
- **Cut identity the body already carries.**

## The two loads

Every document and pointer you add spends one of two budgets:

- **Context load**: always-loaded material (an `AGENTS.md` line, a skill description) spends tokens and attention every turn, whether or not it fires.
- **Cognitive load**: the cost on the human of knowing which documents exist and when to reach for each. The human is the index. Spend it where human judgement matters, remove it where it does not.

Material reached only through a pointer pays the pointer's own line; material with no pointer rides entirely on cognitive load.

## Information hierarchy

A document is built from **steps** (the ordered actions the agent performs) and **reference** (definitions, rules, facts consulted on demand), in any mix: all steps (a recipe), all reference (a review's rules, this skill), or both. The core decision is where each piece sits on the **information hierarchy**, ranked by how immediately the agent needs it:

1. **In-file step**: what the agent does, in order.
2. **In-file reference**: consulted on demand. Often a legitimately flat peer-set (every rule of a review on one rung).
3. **Disclosed reference**: a separate file reached by a context pointer, loaded only when the pointer fires. It spans a sibling file through fully external reference that any document can point at.

Push too little down and the top bloats; push too much and you hide material the agent needs.

**Progressive disclosure** is the move down the ladder, behind a pointer, so the top stays legible. It protects the hierarchy; saving tokens is secondary. Branching is the cleanest test: inline what every branch needs, and push behind a pointer what only some branches reach. In a document with steps, in-file reference that should be disclosed buries them and makes attending to them a coin-flip.

**Co-location** is the within-file companion: keep a concept's definition, rules, and caveats under one heading, so reading one part brings its neighbours. The document should read like documentation written for the agent. (Duplication repeats one meaning in two places; scattering fragments one meaning across many.)

**Sprawl** is a document simply too long, even when every line is live and unique: attention thins across the excess. The cure is the ladder: disclose reference behind pointers, and split by branch or sequence so each path carries only what it needs.

## Steps and completion criteria

Every step ends on a **completion criterion**, the condition that tells the agent the work is done. Two properties make it a lever:

- **Clarity**: can the agent tell done from not-done? A vague bound ("understanding reached") invites **premature completion**: ending the step early, attention slipping to _being done_. The visible **post-completion steps** supply the pull; the criterion's clarity is the resistance. Sharpen the bound first (local and cheap). Only if it is irreducibly fuzzy _and_ you observe the rush, hide the later steps by splitting the sequence. Hiding works only across a real context boundary (a hand-off or subagent dispatch); an inline call leaves the later steps in context.
- **Demand**: how much it requires. "Every modified model accounted for" forces thorough work where "produce a change list" does not. Demand drives **legwork**, the digging within the work, latent in the wording rather than written as its own step. It binds flat reference too: "every rule applied" gives an all-reference document an exhaustiveness bar.

The strongest criteria are both checkable and exhaustive.

## Autonomy

**Autonomy** sets where the agent stops, seeks approval, or delegates.

- **Wanted stops**: name user decisions and deliberate blockers. Diagnose ordinary errors; continue work independent of an unanswered question.
- **Approval rules**: name the action and approval scope together: "Push once the user authorizes delivery." Prepare a reviewable result before asking. A separate exception to "never push" may not override it.
- **Guardrails**: state the scope and reason, so a prohibition does not block routine work. Remove cautions whose reason has gone.
- **Delegation**: name the benefit (parallel work, bulk kept out of context, independent judgment), keep small cases inline, and give the goal, known facts, done condition, and reply format. Say what to do without subagents.

## When to split

Splitting spends one of the two loads, so split only when the cut earns it:

- **By sequence**: split a run of steps where the post-completion steps tempt the agent to rush the one in front of it. Keeping them out of view drives more legwork. Merging sequences does the reverse, exposing each step to the later steps that follow.
- **By invocation**, skill-specific: see [`SKILL-MECHANICS.md`](SKILL-MECHANICS.md).

## Leading words

A **leading word** is a compact concept already living in the model's pretraining that the agent thinks with while running the document (_lesson_, _fog of war_, _tracer bullets_). Repeated as a token, never as a sentence, it accumulates a distributed definition and anchors a region of behaviour in the fewest tokens by recruiting priors the model already holds. A coined word recruits no priors and costs definition tokens; reach for an existing word first.

It anchors twice. In the body, _execution_: the agent reaches for the same behaviour each time the word appears, and inside flat reference it focuses attention on a class of thing to look for. In a pointer, _invocation_: when the same word lives in your prompts, docs, and codebase, the agent links that shared language to the material and reaches it more reliably.

Hunt for restatements a leading word retires: a triad spelled out at three sites, a pointer spending a sentence to gesture at one idea. Each collapses into a single token, fewer tokens and a sharper hook:

- "fast, deterministic, low-overhead" → _tight_ (a _tight_ loop).
- "a loop you believe in" → _red_, turning a fuzzy gate into a binary observable state (the loop goes _red_ on the bug, or it doesn't).

**Negation** is the failure mode beside this lever: steering by prohibition drags the forbidden behaviour into context and makes it _more_ available. _Don't think of an elephant_, and the elephant is all there is. Prompt the **positive**: state the target behaviour ("write one-line comments") so the banned one is never spoken. A prohibition earns its place only as a hard guardrail you cannot phrase positively, paired with the positive target.

## Pruning

- **Single source of truth**: keep each meaning in one authoritative place, so changing the behaviour is a one-place edit. **Duplication** costs maintenance and tokens, and inflates a meaning's prominence past its rank. (A leading word repeats a token on purpose, never the meaning.)
- The **environment** is a source of truth too (`package.json` scripts, config files, directory layout, `--help` output); a document that restates it is a **cache**, earning its load only when the lookup is expensive. Cache what the agent cannot find by looking: the unwritten convention, the reason behind a choice, the gotcha no config confesses.
- Check every line for **relevance**: does it still bear on what the document does? A line loses relevance by never bearing on the task (exposition, or a branch that should be disclosed) or by going stale. Without a pruning discipline the default fate is **sediment**: stale layers that settle because adding feels safe and removing feels risky, until you must core down through them to find what is still live.
- Hunt **no-ops** sentence by sentence: an instruction the model already obeys by default pays load to say nothing. The test (does it change behaviour versus the default?) is model-relative: settle a disagreement by running the document, not by debate. Delete the whole sentence rather than trim words from it. The test also grades leading words: a word too weak to beat the default (_be thorough_) is a no-op, and the fix is a stronger word (_relentless_), not a different technique.
- Rerun that test when the model changes. A line that corrected an older model (_think step by step_, _run every test_, _delegate by default_) becomes a no-op on the next one, or over-steers it. When several models read one document, the smallest sets how explicit a step must be and the largest pays for the excess: keep the constraint and the criterion, cut the itinerary. Ask for a decision and its evidence; the reasoning stays the model's own, and some models decline to reproduce it in a reply.
