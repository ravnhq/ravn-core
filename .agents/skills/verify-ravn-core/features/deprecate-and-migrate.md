# Deprecate and migrate

`deprecate-and-migrate` takes a request to remove or replace an API that still has callers. It inventories the callers with its bundled script, moves them to the replacement, and keeps the old API until the callers it cannot see are measured at zero, with an expand, migrate, contract plan for the rest.

## Sub-features

- `migrate.inventory`: the transcript shows the agent running `scripts/inventory.ts` for `formatPrice`, and the reply names the callers in `src/cart.ts`, `src/invoice.ts`, and `src/receipt.ts`.
- `migrate.callers`: `git grep -nw formatPrice -- src test` lists only `src/money.ts` and `src/index.ts`; every caller now uses `formatMoney`, and `npm test` passes.
- `migrate.kept`: `formatPrice` is still defined in `src/money.ts`, marked deprecated, and still exported from `src/index.ts`, because the package is published and its outside callers are unmeasured.
- `migrate.plan`: the reply lays out expand, migrate, and contract, says this change ends at migrate, and opens contract on a measured condition such as the next major version after usage drops to zero, not on a date alone.

## How to get to it (user POV)

An engineer in a repo with a deprecated function types the skill's invocation form and asks, in their own words, to get off it and remove it. The skill is model-invocable, so the same request without the invocation may load it too.

## Driving it with scripts/scratch.ts

- Build one scratch repo per harness: `node scripts/scratch.ts deprecate-and-migrate /tmp/ravn-verify/$RUN_ID/migrate-<harness>/work`. It is the public `@acme/money` package: `formatPrice` is deprecated in favor of `formatMoney` and called from three source files.
- Load the working-tree skills as the README's Harness runs say, and send one turn: `<invocation> formatPrice is deprecated, move everything to formatMoney and get rid of it. Don't ask me questions.`
- Check `migrate.inventory` and `migrate.plan` from the transcript's commands and the final message, quoting both.
- Check `migrate.callers` and `migrate.kept`: quote `git grep -nw formatPrice`, `git diff --stat`, and `npm test`.

## Gotchas

- `formatMoney` takes `{ cents, currency }`, so each caller needs `currency: "USD"`; the test pins the output strings, which match for positive amounts.
- A reply that deletes `formatPrice` fails `migrate.kept` even when every in-repo caller moved: the package's `exports` reach code outside the repo. Removing it after a measured zero in a later major version is the pass.
- Without the invocation form, Claude Code and Pi loaded the skill on this request but Codex did not, and all three deleted `formatPrice` because the request said to. The invocation form makes the skill the user's chosen workflow, so its contract gate holds against "get rid of it".
