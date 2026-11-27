Reference for writing any document an agent consumes: a skill, an `AGENTS.md` / `CLAUDE.md`, a doc reached by a pointer. The packaging differs; the writing does not. The same levers make each one predictable, since the agent takes the same _process_ every run rather than producing the same output.

For a skill, read [`SKILL-MECHANICS.md`](../SKILL-MECHANICS.md) for frontmatter, invocation choice, and router skills.

## 1. Decide where information lives

Every line in an always-loaded document (`AGENTS.md`, a skill `description`) pays context cost on every turn, whether or not it applies.

- **Always-loaded**: include only what nearly every task needs, plus pointers to conditional material.
- **Behind a pointer (progressive disclosure)**: move branch-specific rules, workflows, and bulky reference into separate files loaded only when relevant.
- **Leave in the repo**: do not restate what the agent can read from `package.json`, config files, directory layout, or `--help` unless lookup is expensive. Document what the repo cannot confess: unwritten conventions, rationale behind choices, and non-obvious gotchas.

## 2. Write sharp pointers

A **pointer** is a short line in context that names an out-of-context file and the exact condition for reading it (a skill's `description`, or a link in `AGENTS.md`).

- **Lead with the sharpest word**: front-load the distinguishing concept.
- **One trigger per distinct branch**: list only genuinely distinct cases; cut synonyms that rename the same branch.
- **Cut redundancy**: omit details the target file already states.
- **Fix misses by sharpening first**: if an agent fails to follow a pointer to required material, tighten the trigger wording before inlining the content.

## 3. Structure for execution

- **Co-locate**: keep a concept's definition, rules, and caveats under one heading. Do not scatter one rule across sections or duplicate it in two places.
- **Keep steps clean**: in a procedural document, push bulky reference behind a pointer so it does not bury the steps.
- **Prescribe order only when it matters**: enforce a sequence only when order protects correctness or user authority.
- **Offload deterministic checks to scripts**: use a script for mechanical verification and leave judgment calls to the agent.

## 4. Set clear, demanding completion criteria

Every step or phase needs an explicit condition for "done."

- **Make it checkable**: vague bounds ("understanding reached") invite premature completion. State an observable artifact or check.
- **Make it demanding**: "every modified model accounted for" forces thorough legwork; "produce a change list" does not. In all-reference docs, state the exhaustiveness bar ("apply every rule").
- **Gate phase boundaries**: name the input, the artifact passed forward, the check that opens the next phase, and what change invalidates that check.
- **Prevent rushing**: if visible later steps tempt the agent to rush an earlier step, sharpen the completion criterion first. Split across a real context boundary (handoff or subagent) only when the criterion is irreducibly fuzzy and rushing persists.

## 5. Phrase for reliability

- **Prompt the positive**: state the target behavior ("write one-line comments") rather than negations ("don't write long comments"), which prime the forbidden behavior. Use prohibitions only for hard guardrails that cannot be phrased positively, and pair them with the positive target.
- **Prefer established, high-signal terms**: use a single standard term the model already understands instead of a multi-sentence restatement or a coined term.
  - "fast, deterministic, low-overhead" → *tight* loop
  - "a test you trust to catch the bug" → a *red* test
- **Replace weak exhortations**: generic modifiers ("be thorough", "be careful") rarely change default behavior. Replace them with concrete criteria or a stronger, specific term.

## 6. Prune ruthlessly

**Sprawl** is a document simply too long, even when every line is live and unique: attention thins across the excess. The cure is the ladder: disclose reference behind pointers, and split by branch or sequence so each path carries only what it needs.

## Steps and completion criteria

Every step ends on a **completion criterion**, the condition that tells the agent the work is done. Two properties make it a lever:

- **Clarity**: can the agent tell done from not-done? A vague bound ("understanding reached") invites **premature completion**: ending the step early, attention slipping to _being done_. The visible **post-completion steps** supply the pull; the criterion's clarity is the resistance. Sharpen the bound first (local and cheap). Only if it is irreducibly fuzzy _and_ you observe the rush, hide the later steps by splitting the sequence. Hiding works only across a real context boundary (a hand-off or subagent dispatch); an inline call leaves the later steps in context.
- **Demand**: how much it requires. "Every modified model accounted for" forces thorough work where "produce a change list" does not. Demand drives **legwork**, the digging within the work, latent in the wording rather than written as its own step. It binds flat reference too: "every rule applied" gives an all-reference document an exhaustiveness bar.

The strongest criteria are both checkable and exhaustive.

At a phase boundary, name the input, the artifact the next phase consumes, the check that opens the boundary, and what change invalidates that check. Prescribe an order only when the order protects the result or the user's authority. Use a script for a deterministic check and leave the decision that needs judgment to the agent.

## When to split

Splitting spends one of the two loads, so split only when the cut earns it:

- **By sequence**: split a run of steps where the post-completion steps tempt the agent to rush the one in front of it. Keeping them out of view drives more legwork. Merging sequences does the reverse, exposing each step to the later steps that follow.
- **By invocation**, skill-specific: see [`SKILL-MECHANICS.md`](../SKILL-MECHANICS.md).

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
