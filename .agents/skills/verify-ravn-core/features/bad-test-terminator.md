# Bad test terminator

`bad-test-terminator` takes a request to make a flaky Vitest suite deterministic and vendors the guards into the package: the Oxlint plugin under `tools/oxlint/bad-test-terminator/` with a provenance record, the lint block, exact matching pins, the seven Vitest settings with a repeat run, and every finding the now-active guards raise either settled or baselined.

## Sub-features

- `btt.vendored`: `tools/oxlint/bad-test-terminator/` holds both plugins, `rules/`, `shared/` and a `UPSTREAM.md` whose six fields are filled: lint block, test file patterns, Vitest settings, repeat run, baseline, deviations.
- `btt.pins`: `package.json` adds a `lint` and a `test:repeat` script, and pins `oxlint` and `@oxlint/plugins` to one identical exact version.
- `btt.block`: `.oxlintrc.json` registers the plugin and holds the guards override with the five bundled `files` patterns.
- `btt.vitest`: the Vitest configuration carries all seven bundled settings.
- `btt.findings`: every finding the guards raise in the existing tests is reported with its rule and file and settled by the route the request names; the change-detector test is deleted or rewritten against real behavior, and the real behavior test survives.
- `btt.verify`: the transcript shows the self-check staging `test/bad-test-terminator-selfcheck/` and the renamed rules reporting the fixture counts, such as `bad-test-terminator(no-current-date) reported 1`.
- `btt.report`: the reply reports the findings with the route taken for each and says there is no CI workflow to extend, because the scratch has none.

## How to get to it (user POV)

An engineer in a Vitest package that keeps flaking on CI types the skill's invocation form and asks, in their own words, to make the suite deterministic and ban the flaky constructs. The skill is model-invocable, so the same request without the invocation may load it too.

## Driving it with scripts/scratch.ts

- Build one scratch repo per harness: `node .agents/skills/verify-ravn-core/scripts/scratch.ts bad-test-terminator /tmp/ravn-verify/$RUN_ID/bad-test-terminator-<harness>/work`. It is the `acme-pricing` package: a real `priceFor` module with one behavior test, plus `test/pricing-calls.test.ts`, a change-detector test built from `vi.mock`, call matchers and a `Date.now` timing assertion, on Vitest with no linter and no Vitest configuration. The builder installs the devDependencies, which the skill's survey needs to run the suite.
- Load the working-tree skills as the README's Harness runs say, and send one turn: `<invocation> our vitest runs keep flaking on CI in random orders and nobody can reproduce it locally - install the guards that ban flaky constructs and clean up whatever they catch. Do not ask me questions.`
- Check `btt.vendored`, `btt.pins`, `btt.block` and `btt.vitest` in the files, quoting `package.json`, `.oxlintrc.json`, the Vitest configuration and the `UPSTREAM.md` fields. Check `btt.findings` and `btt.verify` in the transcript, and `btt.report` in the final message.

## Gotchas

- The request names cleanup, so findings are settled; a run that only installs a baseline leaves the cleanup undelivered and fails `btt.findings`.
- The pins follow whatever `npm view oxlint version` prints on the day, so the two pins must match each other exactly, not a fixed version. On the 2026-11-17 pass all three harnesses pinned `1.94.0`.
- Claude Code, with the skills copied into the project's `.claude/skills/`, sees their bundled fixture tests as a suite. A run that excludes that directory from Vitest is correct only when the exclusion is recorded in the vendored `UPSTREAM.md`.
- A run that reports the flake was never reproduced locally is still a pass: the guards are what the request asked for, and the suite passing under shuffle and repeats is the evidence the suite was already sound.
