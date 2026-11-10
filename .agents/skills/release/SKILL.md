---
name: release
description: Release plugins in this marketplace. Bumps versions, runs the validate gate, tags with `claude plugin tag`, publishes GitHub releases. Invoke with plugin names and an optional bump, e.g. /release ravn-core minor.
argument-hint: "<plugin>... [patch|minor|major|X.Y.Z]"
disable-model-invocation: true
---

Release the plugins named in `$ARGUMENTS`. Each name matches a plugin directory `plugins/<tier>/<p>`. A trailing `patch`, `minor`, `major`, or explicit `X.Y.Z` sets the bump. Run from the repo root.

If `$ARGUMENTS` names no plugin, list the plugins whose shipped files changed since their last version bump, ask which to release, and stop.

## Steps

1. **Find what changed.** For each plugin, find the last commit that changed its version (`git log -1 -G'"version"' -- plugins/<tier>/<p>/.claude-plugin/plugin.json plugins/<tier>/<p>/plugin.json`). List the commits and uncommitted files under `plugins/<tier>/<p>/` since then. If nothing changed, say so and skip that plugin.

2. **Pick the version.**
   - If the manifest version already differs from `HEAD`, someone has bumped it. Use it and do not bump again.
   - If the user gave a bump or version, apply it.
   - Otherwise propose one from the changes and ask once for all plugins together. Patch for wording and fixes, minor for new skills, scripts, flags, or behavior, major for removed or renamed skills and commands.

3. **Set the version.** Edit `version` in place (do not regenerate the file) in `plugins/<tier>/<p>/.claude-plugin/plugin.json`, or `plugins/<tier>/<p>/plugin.json` for `ravn-core`. Then run `pnpm sync:versions`, which copies it to the marketplace entry and, for `ravn-core`, to `package.json` and `.cursor-plugin/plugin.json`. CI fails when these differ.

4. **Run the gate.** Follow the `validate` skill in full. Stop at the first failure and show it.

5. **Report.** For each plugin, give the old and new version and the gate result.
   - Name any uncommitted changes in the tree that are not part of this release.
   - Commit or push only when the user asks. Stage only this release's version files (everything `pnpm sync:versions` wrote) plus the plugin changes the user confirmed.
   - Name the manual step that reaches users: push to GitHub, after which users run `/plugin marketplace update ravn`.

6. **Tag.** Once the user has committed the release, run `claude plugin tag plugins/<tier>/<p>` for each plugin. It creates the `<p>--v<version>` tag, checks that `plugin.json` and the marketplace entry agree, and refuses a dirty tree. Add `--push` only when the user asks to push.

7. **Publish the GitHub release.** Once the tag is on GitHub and the user asked to release, run `gh release create <p>--v<version> --verify-tag --title "<p> <version>" --notes-file <notes>` for each plugin. Write the notes for the plugin's users: what changed for them since the last tag, then `/plugin marketplace update ravn` to update. Leave out repo-only changes, such as tests and verification recipes.

A release is ready only when the gate passed.
