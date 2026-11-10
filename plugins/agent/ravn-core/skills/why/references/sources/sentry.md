# Sentry Error History

## How to search it

Use the Sentry MCP.

1. **Orient.** Without the project slug and organization, run `find_organizations` and `find_projects`.
2. **Search issues with `search_issues`** in natural language ("errors in PaymentService timeout"), built from the exception class names the target handles, its function or class name, the error message strings it checks for, and its file path.
3. **Narrow with `search_issue_events`** (release, time, environment, trace ID, tags) and `get_issue_tag_values` (distribution across versions, users, environments). For a suspected issue, check **first seen** and **last seen** (does the stop line up with the target's ship date?), the **affected releases** (which saw it, which was the fix?), and the **frequency trajectory** (spike, then resolved?).
4. **Pull the full event with `get_sentry_resource`** (a Sentry URL or type+ID). Does the stack trace pass through the target code? Do the tags and breadcrumbs match the conditions the target defends against?
5. **Check releases near the target** with `find_releases`, cross-referencing release version with the PR's merge date.
6. **Seer (`analyze_issue_with_seer`) is a hypothesis generator.** Treat its root-cause analyses as inference; the actual events and stack traces are the primary evidence.

## What to return

For each relevant issue: ID and title, project and organization, first and last seen, event count (and sampling rate if known), affected releases, a verbatim stack-trace excerpt showing relevance to the target, the first/last-seen correlation with the target's ship date, the link, and any author comments or resolution notes.
