# Slack Conversations

## How to search it

Slack MCP tools vary. Check which Slack MCP is available and inspect its tool schema first.

1. **Author-bounded search.** Messages from the PR author around the PR merge date. Limits scope dramatically and often hits gold.
2. **PR URL search.** Slack often links PRs when they're reviewed or discussed. Search for the PR URL (or just `/pull/<number>`).
3. **Error string search.** If the code handles a specific error, search for the error string. Incident threads often surface.

## Common pitfalls

- **Retention cliff.** Very old messages may be gone. If you find nothing before a certain date, note that date.
- **Unsearched DMs.** Many decisions happen in DMs. Name that as a known limitation.
- **Casual remarks as "decisions."** "Lol just do the thing" isn't a decision, even if it preceded the commit. Look for considered discussion.
- **Context collapse.** A single message often reads differently than in its thread. Always fetch the thread.
