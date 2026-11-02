# Dependency overrides

The root `pnpm-workspace.yaml` overrides pin `fast-uri`, `undici` per parent package, and `@azure/msal-node`, so a frozen install resolves patched versions and each open Dependabot alert's first patched version is at or below the version the lockfile resolves.

## Sub-features

- `deps-frozen`: `CI=1 pnpm install --frozen-lockfile` succeeds on the lockfile as committed.
- `deps-resolved`: `pnpm ls` resolves `fast-uri` to 3.1.9 only; `undici` to 6.29.1, 7.30.1, and 8.12.2; and `@azure/msal-node` to 7.1.2 only.
- `deps-alerts`: each of the open Dependabot alerts on `ravnhq/ravn-core` has a first patched version at or below the resolved version of the same package and major line.

## How to get to it (user POV)

- A maintainer checks out the branch, runs `pnpm install --frozen-lockfile` in CI mode, and sees it succeed without rewriting the lockfile.
- A maintainer opens the repository's Dependabot alerts and sees whether each one still applies to the checkout.

## Driving it with pnpm and gh

Preconditions: a checkout at the revision under test with `pnpm install` done, and `gh` logged in with read access to the repo's Dependabot alerts. Run every command from the repo root.

- `deps-frozen`: `node .agents/skills/verify-ravn-core/scripts/collect.ts deps-frozen env CI=1 pnpm install --frozen-lockfile`. Expect exit 0 in `run.json`.
- `deps-resolved`: `node .agents/skills/verify-ravn-core/scripts/collect.ts deps-resolved pnpm ls fast-uri undici @azure/msal-node --depth Infinity`. Expect exit 0 and quote the `fast-uri@`, `undici@`, and `@azure/msal-node@` lines. On the PR head, expect exactly `fast-uri@3.1.9`, `undici@6.29.1`, `undici@7.30.1`, `undici@8.12.2`, and `@azure/msal-node@7.1.2`, with no other version of each. On `main`, expect `fast-uri@3.1.8`, `undici@6.29.0`, `undici@7.30.0`, `undici@8.11.2`, `@azure/msal-node@6.0.1`, and `@azure/msal-node@7.0.1`.
- `deps-alerts`: `node .agents/skills/verify-ravn-core/scripts/collect.ts deps-alerts gh api 'repos/ravnhq/ravn-core/dependabot/alerts?state=open&per_page=100' --paginate --jq '.[] | [.number, .dependency.package.name, .security_advisory.severity, .security_vulnerability.vulnerable_version_range, (.security_vulnerability.first_patched_version.identifier // "none")] | @tsv'`. Expect 8 rows and no `none`. Compare each row with the `deps-resolved` line for its package and major line: the resolved version must be at or above the first patched version. The `fast-uri` alerts patch to 3.1.9, the 6.x `undici` alert to 6.29.1, the 7.x alert to 7.30.1, the 8.x alert to 8.12.2, and the `@azure/msal-node` alert to 7.1.0. On the PR head, every row passes. On `main`, every row fails, because each resolved version sits inside its vulnerable range.

## Gotchas

- Dependabot alerts describe the default branch, so the same 8 alerts stay open on the PR head until it merges. The comparison is between each alert's first patched version and the resolved version in the checkout, not the alert list's state.
- `gh api` that returns 403 or 404 means the alert list is unverified, not passing. Report the feature as unverified.
- The repo has no workspace packages, so `pnpm ls` at the root covers the whole tree.
- Pass the `--jq` filter as one argument, as shown. Splitting it at a space breaks the filter.
