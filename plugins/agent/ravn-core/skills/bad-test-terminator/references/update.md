# Update an installation

The copied plugin and the configuration are the repository's own policy. An update merges incoming changes into them; local edits stay unless the user decides otherwise.

1. **Find the installation.** Locate the `bad-test-terminator` and `bad-test-terminator-effect` entries in `jsPlugins`, the directory they point to, the guards override and any baseline override. Read `UPSTREAM.md` beside the plugin for the installed bundle, the merged block, the baseline and the recorded deviations. An install that predates the rename carries `test-guards` and `test-guards-effect` entries pointing at a `tools/oxlint/test-guards/` directory, with `test-guards/*` and `test-guards-effect/*` rule names in its overrides: migrate it first, in step 2.

   Complete when the plugin path, the override and the recorded deviations are named.

2. **Migrate a legacy install.** Rename the plugin directory to `tools/oxlint/bad-test-terminator/`, change the `jsPlugins` keys to `bad-test-terminator` and `bad-test-terminator-effect` with their specifiers pointing at the renamed directory, and rewrite every `test-guards/` and `test-guards-effect/` rule name in the guards override, the baseline and any other override to `bad-test-terminator/` and `bad-test-terminator-effect/`. Then run `node <skill-directory>/scripts/verify.ts <test-directory>` and record the rename under Deviations in `UPSTREAM.md`.

   Complete when no `test-guards` name remains in the configuration, verify exits 0 or every `FAIL` is a recorded deviation, and the rename is recorded.

3. **Stage the incoming bundle** in a temporary directory outside the repository, so the working tree holds only the merge result:

   ```bash
   stage=$(mktemp -d)
   (cd "$stage" && node <skill-directory>/scripts/install.ts incoming)
   ```

   The first line the script prints names the incoming bundle. When it equals the bundle in the live `UPSTREAM.md`, the plugin has no incoming change: continue at step 5.

   Complete when the incoming files exist under `$stage/incoming` and the live directory is untouched.

4. **Merge the plugin.** Diff each incoming file against the live copy. A live file whose `shasum -a 256` equals its entry in the live `UPSTREAM.md` is as installed: replace it with the incoming file. For a file the repository changed, merge the two by hand and ask the user where they conflict. Keep local-only rules, and add incoming rules to the entry point without enabling them yet.

   Complete when every incoming difference is applied, already present, kept local on purpose, or listed as pending.

5. **Merge the configuration.** Compare the live override with the bundled block for the same variant. Add rules and options that are new in the bundle, keep the repository's `files` patterns, severities, baseline and other choices, and list each newly enabled rule for the user.

   Complete when the override contains every bundled rule or names the ones left out and why.

6. **Verify.** Run `node <skill-directory>/scripts/verify.ts <test-directory>` and `node <skill-directory>/scripts/check-vitest.ts`, then the repository's lint, typecheck, tests and `test:repeat`. A `FAIL` on a rule the repository customised on purpose is recorded as a deviation; any other `FAIL` is corrected in the configuration.

   Complete when both scripts exit 0 or every remaining `FAIL` is a recorded deviation, and the repository's checks have run.

7. **Record.** Update `UPSTREAM.md` with the incoming bundle and date, the hash table from the staged `UPSTREAM.md` for every file taken as incoming, what stayed local and what is pending, then remove the staging directory.

   Complete when the record tells the next update which differences are intentional.
