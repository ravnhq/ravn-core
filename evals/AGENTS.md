# Evals

Follow promptfoo's [Test Agent Skills](https://www.promptfoo.dev/docs/guides/test-agent-skills/) guide and its `skill-comparison` examples as closely as possible, using promptfoo's built-in assertions. Deviate only where a constraint below forces it, and record the constraint here.

**Follow promptfoo by the book.** Before changing how evals run, isolate, assert, or trace, read the promptfoo docs for that case (the guide, the provider page, and the matching directory under [`examples/`](https://github.com/promptfoo/promptfoo/tree/main/examples)) and copy their pattern. Then confirm the pinned promptfoo version ships it: the docs track `main` and can document options no release has yet. Do not invent a mechanism promptfoo already covers. Past misses: proposing a hand-rolled per-test workspace when the docs list `copy_working_dir` and extension-hook resets; recommending `copy_working_dir` before checking that 0.123.1 lacks it.

## Layout

- One TypeScript config per skill: `private/<plugin>/<skill>/promptfooconfig.ts`, exporting `skillEval(skill, cases)` from `skill-eval.ts`. `why` is the reference.
- `skill-eval.ts` is the single source of the matrix, so configs hold only cases:
  - `arms`: `current` (the working tree), `baseline` (the skill at `--baseline-ref`, default `main`), `without-skill` (no skills installed). Providers differ only in `working_dir`, so a score difference comes from the skill text.
  - `runners`: each harness and model pair. Add a model or harness there, not in a config. Runners whose model starts with `openrouter/` route through OpenRouter (Claude Code via `ANTHROPIC_BASE_URL`, Codex via a generated `config.toml` in the isolated home's `.codex-openrouter`), so they never touch first-party quota. Results and labels carry an `-or` suffix.
  - Provider labels are `<fixture>/<arm>/<harness>/<model>[-or]`.
  - `grader`: the pinned `llm-rubric` judge, `anthropic:claude-agent-sdk` with `apiKeyRequired: false`. Keep it pinned: promptfoo's default grader falls back to Codex on your real `~/.codex`.
- `run.ts` runs each config once per runner and names it in `RAVN_EVALS_RUNNER`, so comparisons stay inside one harness and model and `skillEval` builds only that runner's providers. It adds `compare.ts`, which carries `max-score`, only when more than one arm runs; single-arm cases opt out through `disableDefaultAsserts`, which `skillEval` sets for them.
- `providers/pi.ts` is our Pi provider, since promptfoo has none. Keep it to promptfoo's custom provider interface: `implements ApiProvider`, and promptfoo sets `label`.
- `providers/cursor.ts` is our Cursor provider, for the same reason. It runs `cursor-agent` (the installer's name for the `agent` binary) in print mode. `--sandbox disabled` matches Codex `danger-full-access`: the sandbox keeps `.git` read-only, and skills under test commit there. `--force` and `--trust` let a headless run edit and start without a prompt. `--disable-auto-update` keeps the binary stable for the run.
- `hooks.ts` is an extension hook, following promptfoo's `claude-agent-sdk/advanced` example: before each test it resets every workspace to its fixture's `main`, dropping other refs, reflogs, and unreachable objects so no case sees another's commits, then applies the case's `edits`. It runs in `beforeEach`, not the example's `afterEach`, because promptfoo defers `afterEach` past later tests when grading is provider-grouped (`max-score`). `skillEval` sets `maxConcurrency: 1` so resets never race. Replace it with `copy_working_dir` once the pinned promptfoo ships that option.
- Claude Code runs with `CLAUDE_CONFIG_DIR` in the isolated home, because it loads the plugins installed in its config dir: a released `ravn-core:why` stood in for the skill under test. First-party runners log in with `CLAUDE_CODE_OAUTH_TOKEN`, a token from `claude setup-token` that you export, since the login stays in your real config dir. OpenRouter runners blank it, because promptfoo passes the parent env through.
- Codex runs with `sandbox_mode: "danger-full-access"`: `workspace-write` keeps `.git` and `.agents` read-only, and skills under test commit and write handoffs there. Workspaces are temp clones.
- Cursor loads skills the way a local plugin loads. `installSkills` for the `cursor` harness writes the arm's skills into `.cursor/plugins/ravn-core` and copies `plugins/agent/ravn-core/.cursor-plugin/plugin.json` there. The provider passes that directory as `--plugin-dir` and throws when the directory is missing. Cursor also discovers `.agents/skills` and `.claude/skills`, so a Cursor workspace gets its skills only through that plugin directory. The runner's model is `composer-2.5` because that is the model a new Cursor CLI session starts on, and the run draws on Cursor quota. Authentication is `CURSOR_API_KEY`, a user API key from the Cursor dashboard. A Cursor runner throws when its provider config loads without that key, so the other runners still run. The child process `HOME` is the isolated eval home, and its environment is an allowlist plus that key. Skill use is a `SKILL.md` path in a `stream-json` tool call, the same signal Pi records, so `skill-used` applies. The explicit command is `/<skill>`, including in `--print` mode.

## Mod evals

`skill-nudge/` evaluates the `skill-nudge` mod's judgment, not a skill, so it does not use `skillEval`: the mod makes one tool-less Haiku completion, with no workspace, fixture, harness, or arm to compare. Its `promptfooconfig.ts` builds each request with the mod's own `lib/nudge.ts` (system prompt, skill listing, transcript, reply parsing) over ravn-core's real skill descriptions, sends it through the same pinned `anthropic:claude-agent-sdk` provider as `grader` with `tools: []`, and grades the parsed reply with a `javascript` assertion whose `metric` is the case kind: `fit`, `route`, or `stay-out` (no nudge is the right answer). The mod caps Haiku's reply at `MAX_TOKENS`, but the provider can't: under `CLAUDE_CODE_MAX_OUTPUT_TOKENS`, Claude Code tells the model it hit the limit and lets it continue, which skews the judgment. So the assertion cuts a reply whose completion tokens exceed the cap to the same share of its text before parsing. Run it with `pnpm eval:skill-nudge`; `run.ts` does not pick it up.

## Cases

Each skill carries these case kinds; `skillEval` turns each into its promptfoo test:

1. `quality`: every arm answers it; `skill-eval.ts` selects skill-use and outcome assertions.
2. `trigger`: the current arm must use the skill, or accept its explicit command for a user-only skill.
3. `route`: a near-miss that belongs to a model-invocable sibling skill, which must be used instead.
4. `stay-out`: a plain task where no listed skill should fire.

A case that needs work in progress sets `edits`: find-and-replace edits applied to the fixture before the run and left uncommitted.

Check what the agent changed with a `javascript` assertion that reads its workspace, as promptfoo's coding-agents guide shows, in a case of its own with no `llm-rubric` or other model-graded assertion. When tests run serially, promptfoo grades model-graded tests in a later batch, after the next test's reset has wiped the workspace. `pause-safely` splits its quality case this way.

Write each `request` the way an engineer asks inside the repo: short, vague, open-ended, naming neither the skill nor the repo. For user-only quality and trigger cases, `invoked: true` prepends the harness's skill command.

Pick questions whose answer the skill's workflow is needed for. If a comment next to the code already answers it, answering directly is correct and the case tests nothing.

Write the rubric as PASS and FAIL conditions on the outcome an engineer needs, anchored to facts the fixture's code or history proves. Grade whether the answer is right and grounded, not whether it mentions a particular detail. Cite commits through `commit(fixture, subject)`, which resolves the hash from the fixture at load time, so a re-freeze never leaves a rubric pointing at a stale hash.

## Fixtures

The per-skill configs and their fixtures derive from private Ravn code, so they live in the private `ravnhq/ravn-core-evals` repo. `pnpm eval:fetch` clones it into the gitignored `private/`; set `RAVN_EVALS_PRIVATE_URL` to clone from elsewhere. Without it, `run.ts` finds no skill configs and the tests that read them skip. Commit config and fixture changes there, and keep this repo free of anything that names or quotes them.

Fixtures are frozen history, kept as bare repos at `private/fixtures/<name>.git` under neutral names and cloned into temp workspaces by `run.ts`. Bare means no fixture source sits in a working tree, so the repo's tooling never sees it.

- Pick a slice where the answer lives in the code or history of that slice alone. For `why`, prefer rationale that only history records, such as a commit message or a code comment a later commit removed, with unrelated commits on top so the answer requires tracing past the newest one.
- To add or refresh a fixture, add its slice to `private/fixtures/freeze.ts` and run it with one `--source <fixture>=<checkout>` per fixture. The script keeps only `main`, replaces every email with `noreply@example.com`, and strips session trailers. Review the `PROVENANCE.md` diff, then commit and push the private repo.
- Browse a fixture with `git -C evals/private/fixtures/<name>.git log`.

## Running

- `pnpm eval:smoke` checks the harness wiring: every runner must load and use `smoke/skills/greet`, an eval-only skill that never ships. Run it first after changing a runner, an SDK, or `run.ts`.
- `pnpm eval` is the merge gate: the `current` arm on every runner.
- Narrow any run with `--skills <skill,...>` and `--runners <harness/model,...>`, e.g. `pnpm eval --skills pause-safely --runners pi/gpt-6-luna`. Run evals only through these scripts; they put promptfoo on `PATH`.
- Add `--jobs <n>` to run up to `n` config and runner pairs at once. Each job gets its own workspaces, OTLP port, and promptfoo database, so `maxConcurrency: 1` and the resets stay per job; its output goes to `results/<plugin>-<skill>-<harness>-<model>.log`, and `pnpm eval:view` does not see parallel runs. Every job takes a free OTLP port, and `--results <dir>` gives a run its own results dir, so two runs can go at once. Keep `n` at 8 or below: 36 parallel jobs exhausted a Claude subscription's session limit and drew Codex "model at capacity" errors.
- `pnpm eval:compare` runs all arms with `--repeat 3`; pass `--baseline-ref <ref>` to compare against another version. It exits non-zero by design, because `max-score` fails every arm but the winner.
- `pnpm eval:view` opens promptfoo's side-by-side view of the last run.
- Every run writes promptfoo's JSON results, with each assertion's pass or fail reason, to `results/<plugin>-<skill>-<harness>-<model>.json`. Read those to diagnose a failure; the CLI table truncates.

Codex runs with `HOME` pointed at a temp directory holding only a copy of your Codex login; Codex reads `$HOME/.codex`, and promptfoo passes it a minimal environment. `providers/pi.ts` gives Pi a minimal environment too, so tokens such as `GH_TOKEN` never reach it; add a variable to its allowlist only when Pi needs it.

Codex's `skill-used` counts a skill read only when the whole shell command succeeds, so on Codex runners `skillEval` asserts skill use with `trajectory:step-count` on traced `SKILL.md` reads instead, as the guide shows.

Ship's delivery cases resume an explicitly approved Step 13 instead of starting from an idea: a single eval turn cannot supply the intervening user approvals. Its additional `beforeEach` hook overlays a small delivery change on the frozen fixture, creates a local bare origin, and supplies a simulated `gh` through a command-local PATH. GitHub CI and readiness cannot be exercised safely against the frozen private history. The simulation reads the pushed head, exposes draft and ready-only checks, an external approval blocker, and a concurrent head change; JavaScript assertions verify the resulting pushed files, preserved gates, draft status, and final-head evidence. No real PR is opened. Case `metadata` selects the hook's scenario; runners and providers stay unchanged.
