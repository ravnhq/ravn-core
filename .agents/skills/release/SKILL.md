---
name: release
description: Release one or more plugins in this marketplace. Sets the version in plugin.json and marketplace.json, and for ravn-core also package.json and .cursor-plugin/plugin.json, runs the full validate gate, tags each release with `claude plugin tag`, and publishes a GitHub release for each tag. Invoke with plugin names and an optional bump, e.g. /release ravn-core minor.
argument-hint: "<plugin>... [patch|minor|major|X.Y.Z]"
disable-model-invocation: true
---

Release the plugins named in `$ARGUMENTS`. Each name must match a plugin directory `plugins/<tier>/<p>`, where `<tier>` is `agent` or `mods`. A trailing `patch`, `minor`, `major`, or explicit `X.Y.Z` sets the bump. Run from the repo root.

If `$ARGUMENTS` names no plugin, list the plugins whose shipped files changed since their last version bump, ask which to release, and stop.

## Steps

1. **Find what changed.** For each plugin, find the last commit that changed its version (`git log -1 -G'"version"' -- plugins/<tier>/<p>/.claude-plugin/plugin.json plugins/<tier>/<p>/plugin.json plugins/<tier>/<p>/package.json plugins/<tier>/<p>/.cursor-plugin/plugin.json`). List the commits and uncommitted files under `plugins/<tier>/<p>/` since then. If nothing changed, say so and skip that plugin.

2. **Pick the version.**
   - If `plugin.json` already differs from `HEAD` in version, someone has bumped it. Use that version and do not bump again.
   - If the user gave a bump or version, apply it.
   - Otherwise propose one from the changes and ask once for all plugins together. Use patch for wording and fixes, minor for new skills, scripts, flags, or behavior, and major for removed or renamed skills and commands.

3. **Set the version in each manifest.** Change `version` in `plugins/<tier>/<p>/.claude-plugin/plugin.json` (`plugins/<tier>/<p>/plugin.json` for `ravn-core`) and in that plugin's entry in `.claude-plugin/marketplace.json`. For `ravn-core`, set the same `version` in `plugins/agent/ravn-core/package.json` and `plugins/agent/ravn-core/.cursor-plugin/plugin.json` in that same edit. Edit the strings in place; do not regenerate the files. CI fails when these versions differ.

4. **Run the gate.** Follow the `validate` skill in full: `pnpm check`, then `pnpm validate:plugins`. Stop at the first failure and show it.

5. **Report.** For each plugin, give the old and new version and the gate result.
   - Name any uncommitted changes in the tree that are not part of this release. Leave them out of any commit.
   - Commit or push only when the user asks. Stage only this release's files: `plugin.json`, the marketplace entry, and for `ravn-core` also `plugins/agent/ravn-core/package.json` and `plugins/agent/ravn-core/.cursor-plugin/plugin.json`, plus the plugin changes the user confirmed.
   - Name the manual step that reaches users: push to GitHub, after which users run `/plugin marketplace update ravn`.

6. **Tag.** Once the user has committed the release, run `claude plugin tag plugins/<tier>/<p>` for each plugin. It creates the `<p>--v<version>` tag and checks that `plugin.json` and the marketplace entry agree, and it refuses a dirty tree. Add `--push` only when the user asks to push.

7. **Publish the GitHub release.** Once the tag is on GitHub and the user asked to release, run `gh release create <p>--v<version> --verify-tag --title "<p> <version>" --notes-file <notes>` for each plugin. Write the notes for the plugin's users: what changed for them since the last tag, then `/plugin marketplace update ravn` to update. Leave out repo-only changes, such as tests and verification recipes.

A release is ready only when the gate passed. Never report one as ready after a failed step.
