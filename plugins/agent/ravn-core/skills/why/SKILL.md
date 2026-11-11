---
name: why
description: >-
  Investigate design rationale, regressions, postmortems, or data-backed
  thresholds with cited evidence. Use how for runtime behavior.
disable-model-invocation: true
license: See LICENSE.txt
---

# Why

Adapted from pstack `why`, MIT License, Copyright (c) 2026 Lauren Tan. See [LICENSE.txt](LICENSE.txt).

Investigate the motivation and intent behind code. The companion `how` skill answers what the code does and how it works; `why` answers what forces led to its shape.

Each spawn below is a subagent. If your harness cannot spawn subagents, do that subagent's work yourself in turn, writing down its output before moving on. Investigators and the synthesizer may read code and call tools; they change nothing.

## Operating Posture

Separate evidence from inference using `references/epistemics.md`. Trace past the latest commit: the current shape is usually the accretion of many earlier decisions.

Diagnose transient tool failures and try another read-only route; respect withheld access and continue with reachable sources, recording inaccessible evidence as gaps.

## Step 1. Understand the Target and the Question

The **target** is a chunk of code, a pattern, a feature, or a named design decision. The **question** is its rationale, tradeoff, motivating edge case, external constraint, or history.

If the target is vague, guess from conversation context (open files, recent edits), state your interpretation briefly so the user can redirect, then proceed.

## Step 2. Establish the Code Anchor

Build the seed context for every investigator and the synthesizer: file paths and line ranges, key symbols, the last few commits touching the target, PR numbers from merge commits (pattern `(#1234)` in the subject), and linked ticket IDs.

The bundled script runs `git blame`, `git log --follow`, and `gh pr view` for each PR it finds and prints JSON, with `gaps` for anything it could not reach: `node <this-skill-dir>/scripts/anchor.ts <file> [--lines <start>,<end>]`. To dig further by hand, run `git log --follow -p -- <file>` and `gh pr view <number> --json title,body,author,createdAt,mergedAt,labels,closingIssuesReferences,comments,reviews`.

## Step 3. Spawn Parallel Investigators

Use parallel investigators for independent source searches; the simple inline case is below. The goal is a complete coverage map, including null results.

### Discovery

List the MCP servers and tools available in this session and map each to one evidence category below. Source control is always available through git and `gh`. Classify the others from the MCP name, server instructions, tool names, and resource descriptors; if an MCP fits several categories, choose its primary evidence and record the ambiguity in the coverage map.

| Category | Playbook in `references/sources/` | Example MCPs | Best at |
|---|---|---|---|
| Source control (git, `gh`, code comments, tests) | `code-archaeology.md` | git, `gh` | implementation-time rationale captured during review |
| Issue / ticket tracker | `linear.md` | Linear, Jira, GitHub Issues, Plane, Shortcut | the product or business forcing function, strongest when the why is external to engineering |
| Long-form documents | `notion.md` | Notion, Confluence, Google Docs, Coda | design rationale written out before it became code |
| Real-time team chat | `slack.md` | Slack, Discord, Microsoft Teams, Mattermost | deliberation that never reached a doc, vital when the other paper trail is thin |
| Infrastructure observability | `datadog.md` | Datadog, New Relic, Honeycomb, Grafana, Splunk | infrastructure and runtime reality behind timeouts, retries, rate limits, circuit breakers |
| Error / exception tracking | `sentry.md` | Sentry, Rollbar, Bugsnag, Airbrake | the exceptions behind catch blocks, null guards, type checks, retries |
| Product analytics warehouse | `databricks.md` | Databricks, Snowflake, BigQuery, ClickHouse, dbt, Redshift | product and data reality behind flag-gated code, experiments, migrations, "where did this number come from" |

Except for the trivial inline case below, spawn a source-control investigator using git and `gh`, plus one per other category with a matching MCP. Run them concurrently, each owning one category and its read-only tools. Wait until every investigator has returned, including any your harness runs in the background, before Step 4.

Each investigator's prompt is `references/investigator-prompt.md` filled in, plus:
- the playbook for its category, adapted when the MCP is not the example
- `references/sources/incident-postmortem.md` if the target code looks defensive (null checks, retry logic, timeout handling, rate limiting, feature flags, egress guards, OOM handlers)
- the code anchor and the user's original question

### When to skip an investigator

Only with an **explicit, written justification** in the final Sources Consulted. Two valid reasons:

- **No MCP is available for a category other than source control.** Flag it as a gap: "Real-time team chat skipped. No matching MCP available, so the conversational record was not searchable."
- **The source is provably irrelevant**, a high bar: "Error / exception tracking skipped. Target is a build-time script with no runtime code path."

For a single-commit trivial target whose PR description holds the complete answer, answer inline using the synthesis template when other category searches would be redundant; record why in Sources Consulted.

## Step 4. Synthesize

Spawn one synthesizer with the same MCP tools, since it spot-verifies citations. Its prompt is `references/synthesizer-prompt.md` filled in with the investigator findings (including null results and skipped categories with justification), the code anchor, and the user's original question. The template points it at `references/epistemics.md`.

## Step 5. Present

Present the synthesis after every category has findings, a null result, or a justified gap. Light edits for clarity or context are fine; keep its confidence language verbatim.

## Output Format

The structure is the one in `references/synthesizer-prompt.md`. Keep the confidence separation intact, and keep Sources Consulted as one line per investigator, including those that returned nothing or were skipped, with the reason.

After Sources Consulted, if the question is a precursor to changing this code, convert the lineage findings into a Preserve / Change / Avoid / Risk constraint set for planning the change.
