# Linear Tickets

Where the product and business context often lives: "customer X asked" or "this is for the Q3 compliance initiative". Issues, attached project docs (PRDs, specs), parent and sub-issue relationships, comments (scope changes, rationale), labels (`compliance`, `customer-request`, `perf`), milestones, status updates, and linked GitHub PRs.

## How to search it

Use the Linear MCP.

1. **Start with linked tickets.** Fetch the ticket IDs in the seed commits or PRs (e.g. `ENG-1234`, `[BUG-567]`) with `get_issue` and read the full issue including comments.
2. **List related issues by keyword** with `list_issues`: the feature name, key symbol, or business term, in multiple phrasings.
3. **Walk the issue tree.** Sub-issues are tactical; their parents often carry the "why". Follow duplicate-of chains back to the canonical ticket.
4. **Read project docs** via `get_project`, where specs and rationale are most often captured.
5. **Check labels and milestones.** Labels hint at the category of motivation (customer-request, incident-followup, compliance); milestones tie work to deadlines.

## What good evidence looks like here

- An issue description stating the business problem: "Customer Acme needs X because of their SOC2 audit"
- A comment recording a decision: "We decided to go with approach B because approach A would require touching the billing service"
- A parent issue titled like an initiative: "Q3 Enterprise Readiness"
- An attached PRD or spec
- Labels like `customer:acme`, `incident-followup`, `compliance`, `perf-regression`

## Common pitfalls

- **Scope drift.** A ticket may have been closed and reopened with a different scope. Read the whole history.
- **Boilerplate "Why" sections.** Generic text ("improve user experience") is probably not a real answer.
- **Stale tickets.** Check dates against the code's ship date.

## What to return

For each relevant ticket: ID and title, the problem or motivation quoted exactly (the synthesizer needs the text to cite), labels, parent issue, project, author, created and closed dates, and a link.
