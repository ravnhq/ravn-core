---
name: blast-radius
description: >-
  Find what a change could break outside its diff, and prove the one fact it
  is safe because of by running real code. Use for "blast radius of X", "what
  could this break", or a small diff you don't trust yet.
disable-model-invocation: true
license: See LICENSE.txt
metadata:
  proof: subjective
---

# Blast radius

Adapted from pstack `blast-radius`, MIT License, Copyright (c) 2026 Lauren Tan. See [LICENSE.txt](LICENSE.txt).

Find what a change breaks somewhere else, before it ships.

Companion to `how` and `why`. `how` tells you what the code does. `why` tells you why it's shaped that way. Blast radius tells you what it breaks somewhere else.

Listing the callers is not the job; a search finds those in a second. The job is the breakage a search won't show you.

## Prove it, don't write it up

A blast-radius writeup that sounds right is worthless: it reads as convincing whether or not it's true. Find the one or two facts the change's safety depends on and prove them by running code.

For each such fact, take it as far down this ladder as is cheap, and say where it stopped:

1. You said so. Worthless on its own.
2. You pointed at the line: a real `file:line`, or the library's own source.
3. You showed the bad case can't happen: you walked the failure step by step and it doesn't reach.
4. You ran it: a script or test that calls the real code and fails loud if you're wrong.
5. You reproduced it in the running app.

Rung 4 is usually one small script that imports the same library the app ships and calls the exact function you're worried about.

## Steps

1. **Read the change.** The diff, the symbols it adds, changes, and deletes, and what it now does differently, including the part the diff doesn't spell out. Run the anchor script from the [`why` skill](../why/SKILL.md)'s Step 2 to pull the commits and PRs.
2. **Find the one fact it's safe because of.** Most changes that look risky are safe because of a single fact, like "this call only drops cache entries that are already dead". If that fact holds, most risky cases clear at once. Spend your time here, not on a long list of maybes.
3. **Look where search stops.** Read the source of the library you call, and check its pinned version and any local patch. Work out when things run: microtasks, unmount and teardown, the framework's render and effect order. Follow what a symbol search misses: the JSON an API returns, a DB column, a wire format, another language reading the same bytes, a feature flag, code three hops downstream.
4. **Rate each risk honestly.** Give it a real chance of happening and a real cost if it does. Keep the risks you confirmed; list the ones you checked and cleared separately. Cite a real `file:line`, count a search that finds nothing as an answer, and name only callers and APIs you saw.
5. **Prove the one fact.** Write a script or test that runs the real code, run it, and paste what happened.
6. **For a big or wide change, get a second pass.** Run the investigation again independently, as a fresh subagent or on a different model if your harness offers one, and merge the findings. Independent passes catch different real bugs.

## What to hand back

- **What it does.** What changed, including the part that isn't obvious.
- **The one fact it's safe because of.** State it, name the rung you got it to, and show the proof. If you couldn't prove it, write unproven.
- **Risks.** Each names how it breaks, the `file:line`, how likely and how bad, and how to check. Paste the proof for the ones that matter.
- **Cleared.** What you checked and why it's fine.
- **Before you merge.** The cheapest test or repro that catches the real bug, including the script you wrote.

Cite real code, and strip anything private before the writeup goes anywhere public.
