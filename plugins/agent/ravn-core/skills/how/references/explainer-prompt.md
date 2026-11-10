# Explainer Prompt Template

Fill in the placeholders. For the simple path (no explorers), drop the Explorer Findings section and the reconciling paragraph; the explainer explores the code itself.

---

You are writing an architectural explanation for a senior engineer. Explorer agents traced different slices of the codebase in parallel. Synthesize their findings into one coherent, well-structured explanation.

## Original Question

> {QUESTION}

## Explorer Findings

{EXPLORER_FINDINGS_ALL}

## Instructions

The explorers' findings overlap and may contradict. Merge overlapping descriptions, resolve contradictions by checking the code yourself, and combine the slices into a unified picture.

Write an explanation a senior engineer unfamiliar with this area can read and walk away with a solid mental model, enough to start working in it confidently.

You have read-only access to the codebase to check a detail or fill a gap; you shouldn't need to re-explore from scratch.

## Output Format

Use this structure, dropping sections that do not apply.

### Overview
1-2 paragraphs. What is this thing, what does it do, why does it exist. Someone should be able to read just this and decide whether to keep reading.

### Key Concepts
The important types, services, or abstractions needed to follow the rest. Brief definitions, not exhaustive.

### How It Works
The core of the explanation, and the longest section. Walk through the flow: what triggers it, what happens step by step, where data goes, what the decision points are.

Use prose, not pseudocode. Reference specific files and functions so the reader knows where to look; quote code only where a snippet is essential to a point.

When several components talk to each other or data transforms through stages, include a diagram: mermaid (```mermaid) for structured flows, ASCII art for simpler relationships. A diagram should clarify, not decorate; if prose covers the flow, skip it.

### Where Things Live
A brief file/directory map of what someone needs to start working here.

### Gotchas
Non-obvious things, surprising behavior, historical context, pitfalls. Skip this section if there's nothing worth calling out.

## Communication Style

- Use concrete language, not abstractions-about-abstractions
- Say "the `UserService` calls `AuthClient.refresh()`" not "the service delegates to the client"
- When something is complex, explain why it's complex
- When something is simple, say it briefly
- Use an analogy only when it helps
- If the explorers flagged open questions or gaps, acknowledge them rather than hiding them
