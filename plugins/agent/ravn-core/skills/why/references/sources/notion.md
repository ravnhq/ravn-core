# Notion Docs

Where "why" often lives in long-form before it becomes code: PRDs, specs and RFCs, ADRs, design-review meeting notes, postmortems, runbooks that explain defensive code, and strategy documents.

## How to search it

Use the Notion MCP.

1. **Keyword searches with `notion-search`**: the feature name, key symbols and class names, author handles (design docs are authored before the code lands), error strings or user-visible terms, and time-bounded queries when you know the ship date.
2. **Fetch candidate pages with `notion-fetch`.** Read the full content, not the preview; rationale is often buried mid-document.
3. **Follow backlinks and child pages**: sub-pages for alternatives considered, appendices, implementation notes.
4. **Check related databases.** `notion-query-data-sources` and `notion-query-meeting-notes` surface meetings that discussed the decision.
5. **Search the PR author's personal notebook**, if they keep one, for exploratory thinking that preceded the code.

## What good evidence looks like here

- A "Problem statement" or "Motivation" section that matches the target code's purpose
- An "Alternatives considered" or "Rejected approaches" section
- A postmortem that names the target code as the fix for a specific incident
- Meeting notes recording "we decided X because Y" within the PR author's date range
- An ADR filled out non-trivially (status, context, decision, consequences)

## Common pitfalls

- **Outdated docs.** Specs are written before implementation and rarely updated. When the doc says "we'll do X" and the code does Y, flag the divergence for the synthesizer.
- **Boilerplate "Why" sections.** Look for specificity.
- **Unlinked docs.** The most relevant doc may be linked from nowhere; broad keyword searches help.
- **Multiple drafts.** Find the finalized or most recently updated one and check dates.

## What to return

For each relevant doc: title and URL, authors and last-updated date, the motivation text as a verbatim quote with its section, relevant linked pages, and whether the doc was finalized or draft.
