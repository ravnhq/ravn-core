# PR screenshots

Screenshots in a PR are QA evidence. Each one shows what the real product renders at one location, framed so a reviewer who has never opened the page can tell what changed.

Capture with the agent-browser CLI. Check it with `agent-browser --version`; if the command is missing, stop and tell the user to install it with `npm install -g agent-browser` and then `agent-browser install`, or with `brew install agent-browser`. Read `agent-browser skills get core` once for the commands of the installed version. When the repo has a `verify-<app>` skill, launch, seed, and sign in through it.

## 1. List the locations

List every place in the product that the diff reaches: each page, drawer, modal, or widget that renders a changed component, found by tracing its callers and consumers. Then add the states the change affects at each of them, such as loading, error, empty, hover, selected, menu open, expanded, scrolled, narrow viewport, and light or dark theme.

Give every surface its own row: "`DataTable`, as in Orders, Invoices, and Reports" is three rows.

## 2. Capture from the real product

| Rule | Detail |
|---|---|
| Real build only | Screenshot the running app on the PR branch for "after" and on the base branch for "before". A second worktree of the base branch, served on another port, gives both at once. Screenshot a story, mock page, or harness only when the change is to that story. |
| Real code only | Leave the CSS and DOM as the code renders them; the only in-page edit is redaction (step 3). Stubbing API responses is fine. |
| Seed missing data | If a state needs data no account has, create it in a local environment. Report a location as impossible to screenshot only after seeding failed, and say exactly what failed. |
| Identical framing | Capture the same region at the same dimensions for both shots of a pair, even when one state is taller: fix the viewport with `agent-browser set viewport <w> <h>` and capture one element with `agent-browser screenshot <selector> <path>`. |
| Context | Keep the heading or label that names the thing, nearby rows or controls, and a little padding on every side. For a hover, focus, or open-menu state, keep the trigger and the overlay in one frame. When the bug only makes sense in its page, show more of the page. |
| No empty bands | Crop out browser chrome, app navigation, and regions the change does not touch. For full-width layouts, shrink the viewport instead of leaving wide blank space beside short content. |

## 3. Redact and audit

Seeded fake data needs no redaction. When real data is on screen:

1. Blur only private values: emails, usernames, customer or organization names and slugs, IDs, and internal hostnames. Keep keys, labels, and non-sensitive values readable, such as `browser.name` → `chrome`.
2. Paint over each value before blurring it, so the blur can't be reversed: in the page, before the capture, give the value's element transparent text on a light fill, then a CSS blur. Keep redaction to the values: a solid black or dark box, or a blurred whole table or row, hides what the reviewer needs.
3. Read every image before uploading it and check for credentials: tokens, auth headers, cookies, signed URLs, secret keys, and webhook endpoints. Remove real leaks. A public client key meant to ship in the browser is not a leak.

## 4. Choose the table shape

| Change | Shape |
|---|---|
| Visual change to existing UI | **Changed** table, plus an **Unchanged** table for locations the diff reaches that render the same. |
| New page or feature | No before/after. A few "after" screenshots, each introduced by a short sentence. When the new UI appears in several locations, use a `Location \| Screenshot` table instead. |
| Alternatives with no "before", such as prototype treatments or design options | `Treatment \| Screenshot` table, one row per alternative. |
| A change that differs by theme | Add a light and a dark row for each location, such as `Settings › Billing, dark`. For new UI, use `Light \| Dark` columns instead. |

Pixel-diff every before/after pair: with the "after" build open at the same location and viewport, run `agent-browser diff screenshot --baseline <before.png> -s <selector>`. Move a pair it reports as `Images match`, or whose only difference is anti-aliasing noise, to **Unchanged** with one image. Leave out a table that would be empty.

```markdown
**Changed**

| Location | Before | After |
| --- | --- | --- |
| Settings › Billing | ![Settings › Billing before](./shots/billing-before.png) | ![Settings › Billing after](./shots/billing-after.png) |
| Settings › Billing, loading | ![Settings › Billing, loading before](./shots/billing-loading-before.png) | ![Settings › Billing, loading after](./shots/billing-loading-after.png) |

**Unchanged**

| Location | Before & After |
| --- | --- |
| Checkout › Payment method | ![Checkout › Payment method](./shots/payment-method.png) |
```

Formatting rules:

- Name the first column `Location`, or `Treatment` for alternatives.
- Write each location as a `›` breadcrumb of what the reader clicks through, then a comma and the state: `Orders › order details › Refunds, loading`.
- Use only the columns shown above: the screenshots show the change, so a "What changed" or notes column adds nothing.
- Give each image alt text naming its row and side, such as `Settings › Billing before`.
- Label the tables with bold `**Changed**` and `**Unchanged**` lines, with no intro sentence about where or how the screenshots were taken.
- Use Markdown tables, because `gh --attach` rewrites only Markdown image references. Switch to an HTML table only when cells must span rows, such as a light and dark row under one location (`Location | Theme | Before | After` with `rowspan="2"` on the location cell), and leave out `align` attributes.

The tables go in the body's Evidence section; the opener carries at most one "after" screenshot.

## 5. Upload with gh

`gh pr create`, `gh pr edit`, `gh pr comment`, and the matching `gh issue` commands take `--attach '<path>#<alt text>'`. If `gh pr edit --help` lists no `--attach`, ask the user to upgrade gh. Images reach the PR only through `--attach`: no asset branches, committed images, or uploads through the browser's comment box.

Write the body file with relative Markdown image references, then pass the same paths to `--attach`. gh uploads each file and rewrites the matching reference to the uploaded URL in place:

```bash
gh pr edit 123 --body-file pr-body.md \
  --attach './shots/billing-before.png' --attach './shots/billing-after.png'
```

| Behavior | Detail |
|---|---|
| Paths | A path in a `--body-file` resolves against that file's directory, then the working directory, and must match the `--attach` path. Up to 50 files per command. |
| Partial failure | gh updates the PR with the files that uploaded, prints its URL, and exits non-zero. Read the body back and attach the rest. |
| Unreferenced attachments | Get appended to the end of the body as `![alt](url)`. |
| No body flag | `gh pr edit --attach` keeps the existing body and appends the images. |
| HTML tables | `<img src="./x.png">` is not rewritten. Attach first, copy the appended URLs into the `<img>` tags, delete the appended lines, then write the final body with `--body-file`. |

Before writing a body the user may have edited, fetch it again and compare it with the version you last read. Keep the user's wording and table edits, swap in only your rows and URLs, and keep the body's line endings. Removing an image from the body does not delete the uploaded file, and on a public repo anyone with the URL can open it.

## 6. Keep screenshots current

When a later commit changes what a screenshot shows, retake the affected pairs, re-check which pairs belong in **Changed** and **Unchanged**, and update the body without waiting to be asked.
