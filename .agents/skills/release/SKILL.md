---
name: release
description: Release named marketplace plugins by bumping, validating, tagging, and publishing. Invoke with plugin names and an optional bump, e.g. /release ravn-core minor.
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
   - Otherwise propose one and ask once for all plugins; prepare release notes while awaiting the choice. Patch for wording and fixes, minor for new skills, scripts, flags, or behavior, major for removed or renamed skills and commands.

3. **Set the version.** Edit `version` in place (do not regenerate the file) in `plugins/<tier>/<p>/.claude-plugin/plugin.json`, or `plugins/<tier>/<p>/plugin.json` for `ravn-core`. Then run `pnpm sync:versions`, which copies it to the marketplace entry and, for `ravn-core`, to `package.json` and `.cursor-plugin/plugin.json`. CI fails when these differ.

4. **Run the gate.** Follow the `validate` skill, including its failure recovery and check-reuse rules.

5. **Report.** Lead with readiness, then each plugin's old and new version and gate result.
   - Name any uncommitted changes in the tree that are not part of this release.
   - Commit or push once the user authorizes those actions; that approval covers the named plugins for this release. Stage only its version files (everything `pnpm sync:versions` wrote) and confirmed plugin changes.
   - Name any pending push; users then run `/plugin marketplace update ravn`.

6. **Tag.** Once the release commit exists, run `claude plugin tag plugins/<tier>/<p>` for each plugin. It creates the `<p>--v<version>` tag, checks manifest/catalog agreement, and refuses a dirty tree. Add `--push` within the user's push authorization.

7. **Publish the GitHub release.** Once the tag is on GitHub and the user asked to release, run `gh release create <p>--v<version> --verify-tag --title "<p> <version>" --notes-file <notes>` for each plugin. Write the notes for the plugin's users: what changed for them since the last tag, then `/plugin marketplace update ravn` to update. Leave out repo-only changes, such as tests and verification recipes.

A release is ready when the gate passes; it is complete when every selected plugin's tag and GitHub release exist. If commit or push authorization is pending, report the prepared result and exact action awaiting approval.
