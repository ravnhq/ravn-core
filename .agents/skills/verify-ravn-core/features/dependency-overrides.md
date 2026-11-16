# Dependency overrides

The `overrides` block in the root `pnpm-workspace.yaml` forces transitive dependencies onto patched or pinned versions, so a frozen install resolves them and every open Dependabot alert that has a fix is fixed in the checkout. The block is the source of truth: read it at the revision under test rather than trusting versions written here.

## Sub-features

- `deps-frozen`: `CI=1 pnpm install --frozen-lockfile` succeeds on the lockfile as committed.
- `deps-resolved`: every package named in `overrides` resolves only to versions its override allows.
- `deps-alerts`: every open Dependabot alert on `ravnhq/ravn-core` with a first patched version has that version at or below the resolved version of the same package and major line; every open alert without one is reported by number, package, and scope.

## How to get to it (user POV)

- A maintainer checks out the branch, runs `pnpm install --frozen-lockfile` in CI mode, and sees it succeed without rewriting the lockfile.
- A maintainer opens the repository's Dependabot alerts and sees whether each one still applies to the checkout.

## Driving it with pnpm and gh

Preconditions: a checkout at the revision under test with `pnpm install` done, and `gh` logged in with read access to the repo's Dependabot alerts. Run every command from the repo root.

- `deps-frozen`: `node .agents/skills/verify-ravn-core/scripts/collect.ts deps-frozen env CI=1 pnpm install --frozen-lockfile`. Expect exit 0 in `run.json`.
- `deps-resolved`: list the package names in the `overrides` block of `pnpm-workspace.yaml`, then run `node .agents/skills/verify-ravn-core/scripts/collect.ts deps-resolved pnpm ls <names...> --depth Infinity`. Expect exit 0, and check each `<name>@<version>` line against its override:
  - A range such as `^6.2.4` or an exact version such as `0.159.0` must contain every resolved version of that package. Platform builds such as `@openai/codex@0.159.0-linux-x64` count as the pinned version.
  - A selector key such as `"minimatch@>=7.0.0 <11.0.1": 11.0.1` replaces only versions inside the selector, so versions outside it, such as `minimatch@3.1.5`, pass.
  - `"-"` removes the package, so `pnpm ls` must not list it.
- `deps-alerts`: `node .agents/skills/verify-ravn-core/scripts/collect.ts deps-alerts gh api 'repos/ravnhq/ravn-core/dependabot/alerts?state=open&per_page=100' --paginate --jq '.[] | [.number, .dependency.package.name, .dependency.scope, .security_advisory.severity, .security_vulnerability.vulnerable_version_range, (.security_vulnerability.first_patched_version.identifier // "none")] | @tsv'`. For each row with a patched version, run `pnpm ls <package> --depth Infinity` and confirm every resolved version on that major line is at or above it. Report each `none` row separately with its number, package, scope, and severity: no override can fix it, so it passes only as a known, unfixable alert.

On 2026-11-15 the one open alert was #23, `deepmerge` 4.3.1 in development scope, low severity, with no patched release (GHSA-gcqx-w48m-w2h4).

## Gotchas

- Dependabot alerts describe the default branch, so alerts fixed on a PR head stay open until it merges. Compare each alert's first patched version with the resolved version in the checkout, not the alert list's state.
- Not every override is a security fix: some pin a tool version or remove an unused package. Check them all in `deps-resolved`; only `deps-alerts` ties overrides to alerts.
- `gh api` that returns 403 or 404 means the alert list is unverified, not passing. Report the feature as unverified.
- The repo has no workspace packages, so `pnpm ls` at the root covers the whole tree.
- Pass the `--jq` filter as one argument, as shown. Splitting it at a space breaks the filter.
