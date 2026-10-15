# Evaluating agent skills: trigger evals, baselines, and graders

Research date: 2026-09-30. Scope: SKILL.md skills evaluated with promptfoo 0.123.1 across Claude Code (`anthropic:claude-agent-sdk`, SDK 0.3.263), Codex (`openai:codex-sdk`), and Pi 0.99.1 (`evals/providers/pi.ts`), using CLI logins with no API keys.

How to read the citations: `pf:` means `node_modules/promptfoo/dist/src/` in this repo (promptfoo 0.123.1). The dist files are bundled chunks with hashed names, so line numbers hold only for this version. "Probe" means a throwaway config I ran under `/tmp/skilleval/` on 2026-09-30, on this machine's Claude Code and Codex logins with no `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, or `CODEX_API_KEY` set.

## Summary

- `skill-used` accepts a string, a string list (all required), or an object `{name | pattern, min, max}` with case-insensitive globs. `not-skill-used` negates it: a list passes only if none of the listed skills fired.
- Each harness detects skill use differently. Claude counts only `Skill` tool calls. Codex matches `.agents/skills/<name>/SKILL.md` in shell commands and counts a command only if it exited 0. Pi matches any tool argument that contains `SKILL.md`. The Codex rule gives false negatives: in a probe Codex read the `how` skill, but the chained command exited 2, so `skill-used: how` failed.
- A trigger set with prompts that don't name the skill is the gap in this repo's evals. In a probe, `how` triggered on Claude 3/3 for "Walk me through how withRetry in src/retry.ts works" but only 1/3 for an open-ended onboarding prompt against the same one-file fixture.
- The only baseline that works the same in all three harnesses is a second workspace with no skills. `select-best` and `max-score` exist, but each picks one winner per row and fails every other output, so neither can express "with-skill ≥ baseline". Compute the delta from `-o results.json` instead.
- CLI-login graders work. `llm-rubric`, `g-eval`, and `model-graded-closedqa` all ran on an `anthropic:claude-agent-sdk` grader with `apiKeyRequired: false`, and `llm-rubric` also ran on an `openai:codex-sdk` grader. With no API keys and a Codex `auth.json` on disk, promptfoo's *default* grader silently becomes Codex SDK.
- Vendor guidance agrees on the numbers: about 20 trigger queries (8-10 positive, 8-10 near-miss negative), 3 runs per query, a 0.5 trigger-rate threshold, a no-skill baseline, and a delta rather than an absolute score.

## 1. Trigger evals

### `skill-used` / `not-skill-used` syntax (verified in source)

Source: `pf:evaluator-DlYW7Rgb.js`, region `src/assertions/skill.ts`, lines 3843-3944.

| Value form | Meaning | Source |
| --- | --- | --- |
| `value: how` | `how` was used at least once | 3864-3867 |
| `value: [how, why]` | every listed skill was used (AND) | 3868-3871, 3891-3895 |
| `value: { name: how, min: 1, max: 1 }` | count of `how` calls is within bounds (`min` defaults to 1, or to 0 when only `max` is set) | 3872-3888, 3908-3913 |
| `value: { pattern: "ho*" }` | glob on the skill name: `*` becomes `.*`, `?` becomes `.`, anchored, case-insensitive | 3850, `matchesPattern` at 2954-2957 |
| `type: not-skill-used`, `value: [how, why]` | passes only if **none** of the listed skills was used | 3894 (`inverse ? matched.length === 0`) |
| `type: not-skill-used`, `value: { pattern: "*" }` | no skill at all was used | 3916-3918 |

- `not-` is a generic prefix. Any assertion type starting with `not-` runs inverted (`pf:evaluator-DlYW7Rgb.js:5602`, `5611`).
- The object form of `not-skill-used` rejects `min` and any `max` other than `0`: it throws "not-skill-used object assertions only support name/pattern with no count bounds, or max: 0" (3917).
- Before matching, entries with `is_error: true` are dropped (3843-3847). A failed Skill call counts as not used.
- The assertion reads only `providerResponse.metadata.skillCalls` (3844). The final text is never inspected.

Copyable trigger and non-trigger cases:

```yaml
- description: how triggers on an onboarding prompt that never names it
  vars:
    request: I'm new here and about to change the checkout retry code. Give me a mental model of how a failing gateway call moves through it.
  assert:
    - type: skill-used
      value: how
    - type: not-skill-used
      value: why

- description: editing request routes to neither skill
  vars:
    request: Add jitter to the backoff in src/retry.ts.
  assert:
    - type: not-skill-used
      value: [how, why]
```

### How each provider fills `skillCalls`

| Harness | Detection rule | Source |
| --- | --- | --- |
| Claude Code | Only tool calls named `Skill`. `name` is `input.skill`. A `Read` of `.claude/skills/how/SKILL.md` does **not** count. | `pf:claude-agent-sdk-DEURn9hl.js:120-131`, used at 796 and 812 |
| Codex | Splits each `command_execution` command on whitespace and matches tokens `.agents/skills/<name>/SKILL.md` (relative), or `<root>/skills/<name>/SKILL.md` under the working dir's `.agents`, the git root's `.agents`, `CODEX_HOME`, `/etc/codex`, or `~/.codex`. `skillCalls` keeps only commands with `status: completed` and `exit_code: 0`. Matching commands that failed go to `attemptedSkillCalls`. `source: "heuristic"`. Deduplicated by path, so `max` counts are unreliable. | `pf:codexSkillMetadata-pfrlfZNK.js:106-176`, `pf:codex-sdk-CcO9tYmZ.js:386-397`, `1170-1173` |
| Pi (ours) | Any `tool_execution_start` whose JSON args contain a token ending in `SKILL.md`. `name` is the parent directory. `is_error` comes from the matching `tool_execution_end`. | `evals/providers/pi.ts:45`, `66-83` |

The promptfoo guide confirms the Codex rule: "Its `skill-used` signal is inferred from successful reads of the matching `SKILL.md`, so keep `enable_streaming: true`" (https://www.promptfoo.dev/docs/guides/test-agent-skills/).

Pitfalls observed in probes:

- **Codex false negative.** Codex (gpt-6-luna, `ws-with` workspace) ran `cat .agents/skills/how/SKILL.md && ... && rg -n "retry|Retry" src test tests package.json`. `rg` exited 2 on the missing `test`/`tests` paths, so the item was `failed`. The result was `skillCalls` empty, `attemptedSkillCalls: [{name: "how"}]`, and `skill-used: how` failing even though Codex had read the skill and then its `references/explainer-prompt.md`. When the question is whether the skill was consulted, also count `attemptedSkillCalls`:

  ```yaml
  - type: javascript
    metric: consulted-how
    value: |
      const m = context.providerResponse?.metadata ?? {};
      return [...(m.skillCalls ?? []), ...(m.attemptedSkillCalls ?? [])].some((c) => c.name === 'how');
  ```

  On Claude this also counts `Skill` calls that errored, because the raw array still contains them.
- **Codex path prefixes.** An absolute path matches only if it starts with the resolved working dir. `run.ts` already `realpathSync`s the temp dir, which avoids a `/tmp` vs `/private/tmp` mismatch on macOS.
- **Codex without an isolated HOME reads personal state.** In the probe, which had no isolated HOME, Codex ran `rg ... ~/.codex/memories/MEMORY.md` and tried `~/.agents/skills/how/SKILL.md`. `run.ts` isolation avoids this for the agent under test, but see §3 for the default grader.

### What the vendors say a trigger set should look like

- Anthropic skill-creator: "Create 20 eval queries", 8-10 should-trigger and 8-10 should-not-trigger. Negatives should be near-misses that "share keywords or concepts with the skill but actually need something different". "Write a fibonacci function" is given as a useless negative. Queries should be realistic, with paths, backstory, typos, and casual phrasing. https://raw.githubusercontent.com/anthropics/skills/main/skills/skill-creator/SKILL.md (section "Description Optimization").
- The same file warns that "simple, one-step queries like 'read this PDF' may not trigger a skill even if the description matches perfectly", so eval queries must be "substantive enough that Claude would actually benefit from consulting a skill".
- The skill-creator trigger runner (`scripts/run_eval.py`) uses `--runs-per-query 3` and `--trigger-threshold 0.5`. It counts a trigger if Claude calls `Skill` *or* `Read`s the skill file, which is broader than promptfoo's Claude rule. https://raw.githubusercontent.com/anthropics/skills/main/skills/skill-creator/scripts/run_eval.py
- agentskills.io gives the same numbers (about 20 queries, 3 runs, 0.5 threshold) plus a fixed 60/40 train/validation split, about 5 optimization iterations, and the 1024-character description limit. https://agentskills.io/skill-creation/optimizing-descriptions
- OpenAI proposes 10-20 prompts per skill in four classes: explicit (`$skill`), implicit, contextual (noisy domain context), and at least one negative control. https://developers.openai.com/blog/eval-skills (section 4)
- The promptfoo guide recommends testing bundle routing boundaries by pairing `skill-used` for the right sibling with `not-skill-used` for the wrong one. https://www.promptfoo.dev/docs/guides/test-agent-skills/ ("Test Routing Boundaries In Bundles")

### Repeats

`promptfoo eval --repeat <n>` runs each test n times (`pf:main.js:5158`). Each repeat is graded as its own row. I found no built-in "pass if at least k of n repeats pass" option in the 0.123.1 CLI, so a trigger rate needs post-processing of `-o results.json`, or you accept per-run strictness. `assert-set` thresholds work within a single row, not across repeats.

Probe with Claude `skills: all`, `--repeat 3`, and a one-file `src/retry.ts` fixture:

| Prompt | Assertion | Passes |
| --- | --- | --- |
| "Walk me through how withRetry in src/retry.ts works." | `skill-used: how` | 3/3 |
| "I just joined this team and I'm about to touch src/retry.ts. Can you give me a mental model of how the retry logic fits together before I change anything?" | `skill-used: how` | 1/3 (plus 0/1 in an earlier single run) |
| "Someone capped maxAttempts at 3 in src/retry.ts. What was the reasoning behind picking 3?" | `not-skill-used: how` and `skill-used: why` | 3/3 |

The low open-ended rate fits Anthropic's warning about simple tasks: a 12-line file doesn't need a skill for a mental model. The sample is small (n=3).

## 2. With-skill vs without-skill baselines

### Per-harness switches

| Harness | How to remove the skill | Evidence | Caveat |
| --- | --- | --- | --- |
| Claude | Omit `skills`, or set `skills: []`. promptfoo adds `Skill` to the tool list only when `skills === "all"` or the array is non-empty. | `pf:claude-agent-sdk-DEURn9hl.js:453` | The SDK types say that omitting `skills` "is **not** 'skills off'" and that the filter "is a context filter, not a sandbox: ... files remain on disk and are reachable via Read/Bash" (`node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts:2087-2107`). Unverified: whether `skills: []` also hides the descriptions from context. |
| Codex | No skill option in the promptfoo provider. Codex discovers `.agents/skills` from CWD up to the repo root, plus `$HOME/.agents/skills`, `/etc/codex/skills`, and system skills. To disable a skill: `[[skills.config]] path = ".../SKILL.md"` with `enabled = false` in `config.toml`. To block implicit invocation only: `policy.allow_implicit_invocation: false` in `agents/openai.yaml`. | https://learn.chatgpt.com/docs/build-skills (redirect target of https://developers.openai.com/codex/skills) | `agents/openai.yaml` is outside the agent-plugins.org schema. System skills such as `skill-creator` stay present. |
| Pi | The provider already passes `--no-skills` (discovery off) and adds one `--skill <dir>` per skill. Without the `--skill` args there is no skill. | `evals/providers/pi.ts:142-158`, `pi --help` | `pi.ts:142` calls `readdirSync(<working_dir>/.agents/skills)`, which throws if the directory is missing. A baseline workspace needs an empty `.agents/skills/`, or the provider needs a guard. |

**Recommended baseline: a second workspace with the same fixture and no skills.** It is the only switch that behaves identically in all three harnesses, which VISION.md's "Every supported harness is first class" section requires. It also stops Claude from reading `.claude/skills/*` through `Read`. In a probe, Claude with `skills` omitted but pointed at the with-skills workspace ran `Grep` over the whole workspace, so the skill files were within reach.

Configuration sketch. It needs a `RAVN_EVALS_BASELINE_WORKSPACE` built by `run.ts`, which doesn't exist yet:

```yaml
providers:
  # existing claude-code / codex / pi entries unchanged
  - id: anthropic:claude-agent-sdk
    label: baseline-claude-code
    config:
      model: claude-sonnet-5-5
      apiKeyRequired: false
      working_dir: "{{ env.RAVN_EVALS_BASELINE_WORKSPACE }}"
      setting_sources: ["project"]
      append_allowed_tools: ["Bash", "Agent"]
  - id: openai:codex-sdk
    label: baseline-codex
    config:
      model: gpt-6-luna
      working_dir: "{{ env.RAVN_EVALS_BASELINE_WORKSPACE }}"
      skip_git_repo_check: true
      sandbox_mode: read-only
      enable_streaming: true
      cli_env:
        HOME: "{{ env.RAVN_EVALS_HOME }}"
        CODEX_HOME: "{{ env.RAVN_EVALS_CODEX_HOME }}"
  - id: file://providers/pi.ts
    label: baseline-pi
    config:
      model: openai-codex/gpt-6-luna
      working_dir: "{{ env.RAVN_EVALS_BASELINE_WORKSPACE }}"
```

### Scoping tests to one arm (verified)

A test's `providers:` list limits which providers run it (`pf:evaluator-DlYW7Rgb.js:8593`, `8647`). A list entry matches a provider's label or id exactly, or by prefix when it ends in `*` (`pf:util-CWZKHpaI.js:782-803`). A probe confirmed that `providers: ["baseline-*"]` ran only the `baseline-echo` provider.

```yaml
- description: how triggers (skill arms only)
  providers: [claude-code, codex, pi]
  vars: { request: ... }
  assert:
    - type: skill-used
      value: how
```

Put trigger assertions on the skill arms only. Claude Code's own eval tool does the same: it excludes `tool_used: Skill` graders from both arms' scores because they "can never pass without the plugin" and would inflate Δ (https://code.claude.com/docs/en/plugin-evals, "Score against the no-plugin baseline").

### Pairwise assertions: `select-best` and `max-score`

- `select-best` (`pf:evaluator-DlYW7Rgb.js:348-390`, `9456-9500`) sends **every output in the test row** (all providers × prompts, from `getResultsToCompare`, 9548) to the grader, which returns one index. That output passes and all others fail (`pass: false, score: 0`).
- `max-score` (392-440) averages each output's other assertion scores (weights by assertion type, optional `threshold`) and also passes only the single winner.
- Probe with 4 outputs, 2 of them identical: exactly one row passed, and the identical copy of the winning text failed.

So neither can express "with-skill ≥ baseline". With 3 harnesses and 2 arms in one row, five of six outputs fail. With `--filter-providers '^(baseline-)?claude-code$'` the row shrinks to two, but the losing arm is still marked failed, which breaks a CI gate. For a comparison run outside the gate, use this:

```yaml
- description: with-skill explanation beats baseline (comparison run only)
  assert:
    - type: select-best
      value: Which answer gives a more accurate, better-grounded explanation of the retry flow, citing real files and symbols?
```

The gate-safe alternative is to grade both arms with the same absolute rubric, keep the pass/fail gate on the skill arms, and compute Δ per test and harness from `-o results.json`. Claude Code's `claude plugin eval` reports WITH, W/OUT, and Δ the same way and "never changes the exit code" based on Δ (https://code.claude.com/docs/en/plugin-evals, "Run evals in CI").

## 3. Quality grading with a login-based grader

### Grader resolution (verified)

`getGradingProvider` (`pf:graders-CrOgZSVq.js:150-181`) checks these in order:

1. The assertion's `provider`, as a string id or `{id, config}`.
2. `defaultTest.provider`.
3. `defaultTest.options.provider.text`.
4. `defaultTest.options.provider`.
5. The built-in default.

The built-in default depends on which credentials exist (`getDefaultProviderPreferences`, 348-367; `getDefaultProviders`, 371-440). With no OpenAI, Anthropic, Google, Azure, Mistral, or xAI keys, it is `useCodexDefaults` when `~/.codex/auth.json` (or `$CODEX_HOME/auth.json`) is non-empty and `@openai/codex-sdk` resolves (`pf:remoteGeneration-DdYYGB7k.js:55-81`). That default grader is an `OpenAICodexSDKProvider` with `sandbox_mode: read-only`, `approval_policy: never`, a temp `working_dir`, and a `{pass, score, reason}` output schema for rubric grading (21-33, 82-101, 186-223). The debug log confirmed "Using Codex SDK default providers from ChatGPT/Codex credentials" on this machine.

Both SDKs are valid grader ids. `agent-rubric` requires one of them: its allowed agentic ids include `anthropic:claude-agent-sdk` and `openai:codex-sdk` (`pf:agentic-utils-0dl70U3S.js:17-27`, `pf:evaluator-DlYW7Rgb.js:1136-1139`).

### Probe results

The output under test was the fixed string "The retry helper tries 3 times with exponential backoff of 100ms." (`echo` provider). No API keys were set.

| Assertion | Grader | Result |
| --- | --- | --- |
| `llm-rubric` "States the number of attempts and the backoff strategy." | `anthropic:claude-agent-sdk`, `apiKeyRequired: false` | pass 1, with a sensible reason |
| same | `openai:codex-sdk` (read-only, temp dir) | pass 1 |
| same | none (default) | pass 1, via the Codex default |
| `llm-rubric` "Mentions a circuit breaker." | Claude SDK | fail 0 (correct negative) |
| `g-eval` "Accurately describes a retry policy." | Claude SDK | score 0.3, fail (strict but parsed correctly) |
| `model-graded-closedqa` "Mentions exponential backoff." | Claude SDK | pass |
| `select-best` (see §2) | Claude SDK via `defaultTest.options.provider` | picked the right output |

Copyable grader config:

```yaml
defaultTest:
  options:
    provider:
      id: anthropic:claude-agent-sdk
      config:
        model: claude-sonnet-5-5
        apiKeyRequired: false
```

The per-assertion override uses the same shape under `assert[].provider`. A Codex grader on the isolated login looks like this:

```yaml
provider:
  id: openai:codex-sdk
  config:
    skip_git_repo_check: true
    sandbox_mode: read-only
    cli_env:
      HOME: "{{ env.RAVN_EVALS_HOME }}"
      CODEX_HOME: "{{ env.RAVN_EVALS_CODEX_HOME }}"
```

### Pitfalls

- **Package resolution.** A config outside the repo failed at first to load `@anthropic-ai/claude-agent-sdk`, because resolution starts from the config's directory. The error text says to "run promptfoo from the project root (or point the config at that root)". This doesn't affect `evals/promptfooconfig.yaml`.
- **Tools.** A Claude grader without `working_dir` runs in a temp dir with no tools: `defaultAllowedTools` is `[]` without `working_dir` (`pf:claude-agent-sdk-DEURn9hl.js:438`), and the docs say "no tools enabled" (https://www.promptfoo.dev/docs/providers/claude-agent-sdk/). Keep it that way for `llm-rubric`. Give a grader `working_dir` and tools only for `agent-rubric`.
- **JSON output.** `llm-rubric` and `agent-rubric` parse `{pass, score, reason}` JSON from the reply (`runJsonGradingPrompt`, `pf:graders-CrOgZSVq.js:1034-1053`). `g-eval` needs a single-line `{"steps": ...}` match and then a `{...}` match. Its regexes have no `s` flag (2175, 2199), so pretty-printed multi-line JSON fails. `model-graded-closedqa` passes only when the reply ends in `Y` (2138). All of these parsed correctly with Sonnet 5.5 in the probe. `output_format` / `output_schema` can force structure if parsing becomes flaky; the Codex default grader already does this.
- **Cost.** The Claude grader carries the Claude Code system prompt. The grader probe (six assertions, seven grader calls since g-eval makes two, five of them on the Claude SDK) used about 58k prompt tokens in total, all on the login plans. Unverified: whether `custom_system_prompt` reduces this without hurting verdicts.
- **The Codex default grader is not isolated.** It uses the promptfoo process's `CODEX_HOME` (unset under `run.ts`, so `~/.codex`) and your real HOME. In the probe the unisolated Codex agent read `~/.codex/memories/MEMORY.md`. Pin an explicit grader instead of relying on the default.
- **Model warning.** `Using unknown model for Claude Agent SDK: claude-sonnet-5-5` is only a warning from promptfoo's model allowlist.
- **Judge variance.** Claude Code's eval tool counts an `llm` grader as passing on "at least two of three votes" and advises "rubrics written as concrete PASS and FAIL conditions" and short graded text (https://code.claude.com/docs/en/plugin-evals, "Grader types", "Choose graders that give a stable signal"). promptfoo makes one grader call per assertion. For stability, use `--repeat` or a stricter rubric.

## 4. Vendor guidance

| Source | Cases | Trigger / non-trigger | Baseline | Grading | Repeats |
| --- | --- | --- | --- | --- | --- |
| Anthropic skill-creator (anthropics/skills) | Start with 2-3 realistic task prompts. The trigger set has 20 queries. | 8-10 / 8-10, near-miss negatives, realistic detail | Spawn a with-skill and a baseline run "in the same turn". A new skill's baseline is no skill; an improved skill's baseline is the old snapshot. | Assertions with `text`/`passed`/`evidence`; scripts for mechanical checks; analyst pass for non-discriminating and high-variance assertions; optional blind A/B comparator | Trigger: 3 runs per query, 0.5 threshold, 60/40 train/test split, up to 5 iterations. Benchmark: mean ± stddev and delta for pass rate, time, and tokens. |
| Anthropic best practices (platform.claude.com) | "Build three scenarios" first | not specified | "Establish baseline: Measure Claude's performance without the Skill" | `expected_behavior` list per scenario | "Test with all models you plan to use" |
| `claude plugin eval` (Claude Code ≥ 2.1.269) | `init` proposes prompts that "should and shouldn't trigger" | Must-not-invoke uses `tool_used` with `min: 0`, `max: 0`, `arm: both` | Every case runs with and without the plugin; reports WITH, W/OUT, Δ; `tool_used: Skill` is excluded from the score | `regex`, `tool_used`, `tool_order`, `file_exists`, `llm` (2 of 3 judge votes), `baseline`; "no custom-code graders" | 3 runs per arm by default; `--threshold` defaults to 1.0 |
| OpenAI "Testing Agent Skills Systematically with Evals" | 10-20 prompts | explicit, implicit, contextual, and at least one negative control | not covered | Deterministic checks on `codex exec --json` `command_execution` events, then a read-only rubric pass with `--output-schema` | not specified |
| agentskills.io | 2-3 to start; about 20 for triggers | 8-10 / 8-10 near-misses | Run each case "once with the skill and once without it (or with a previous version)" | Evidence-backed PASS/FAIL, blind comparison, drop assertions that pass in both arms | 3 runs, 0.5 threshold; stddev only means something with multiple runs |

Sources:

- https://raw.githubusercontent.com/anthropics/skills/main/skills/skill-creator/SKILL.md
- https://raw.githubusercontent.com/anthropics/skills/main/skills/skill-creator/scripts/run_eval.py
- https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices ("Evaluation and iteration")
- https://code.claude.com/docs/en/plugin-evals
- https://developers.openai.com/blog/eval-skills
- https://agentskills.io/skill-creation/evaluating-skills
- https://agentskills.io/skill-creation/optimizing-descriptions

Fit of `claude plugin eval` for this repo: it is Claude-only. It reads cases from `evals/` inside the plugin directory, or from a path set by the `experimental.evals` key in `plugin.json`. Its trigger check is `tool_used` on `Skill`. VISION.md makes harness agnosticism non-negotiable, and AGENTS.md keeps tests outside `plugins/`, so it can't replace the promptfoo suite. Its design is still worth copying: two arms, Δ, skill-fired graders excluded from Δ, and 3 runs. Unverified: whether it accepts this repo's agent-plugins.org `plugin.json`.

## Unverified or open

- Whether Claude `skills: []` removes skill descriptions from the model's context, not just the `Skill` tool.
- Whether promptfoo renders `{{ env.* }}` inside a grader provider's `config`.
- Whether `claude plugin eval` accepts this repo's agent-plugins.org manifest.
- Codex and Pi trigger rates for the open-ended prompts. Only Claude was run with repeats.
- The promptfoo docs page describes SDK 0.3.278 behavior; this repo has 0.3.263. All provider claims above come from the installed source.

## Recommendations for this repo

Current state: `evals/ravn-core/how.yaml` and `why.yaml` each have one prompt that names the file and symbol, one `skill-used`, and `icontains` checks. There are no negative cases, no baseline, and no graders.

1. **Build a fixture where the skills are worth triggering.** Extend `evals/workspace-repo.ts` from one `src/retry.ts` to a small subsystem, for example a `checkout.ts` that calls a `gateway.ts` client wrapped in `withRetry`, plus a config module. Keep the existing commit history (#12, #18, #21, PAY-42) that `why` has to find. Open-ended `how` prompts only discriminate when the task isn't trivial (skill-creator, "How skill triggering works").

2. **Split each skill's YAML into trigger, quality, and routing cases.** Tag each row with `metadata.kind` so `--filter-metadata kind=trigger` can run the cheap subset.

   ```yaml
   # evals/ravn-core/how.yaml
   - description: how, onboarding mental model
     providers: [claude-code, codex, pi]
     metadata: { kind: trigger }
     vars:
       request: I'm new on this team and about to change how checkout talks to the payment gateway. Before I touch anything, how does a failing gateway call flow through the code?
     assert:
       - type: javascript
         value: |
           const m = context.providerResponse?.metadata ?? {};
           return [...(m.skillCalls ?? []), ...(m.attemptedSkillCalls ?? [])].some((c) => c.name === 'how');
       - type: not-skill-used
         value: why
   - description: how, placement question
     providers: [claude-code, codex, pi]
     metadata: { kind: trigger }
     vars:
       request: I want to add a circuit breaker around gateway calls. Does that belong next to withRetry or somewhere else in this codebase?
     assert:
       - type: skill-used
         value: how
   - description: how, casual phrasing
     providers: [claude-code, codex, pi]
     metadata: { kind: trigger }
     vars:
       request: ok so what actually happens when the gateway throws on the last retry? trace it for me end to end
     assert:
       - type: skill-used
         value: how
   ```

   More open-ended `why` prompts: "Five retries seems safer than three for checkout. Is there a reason we stopped at three?"; "I want to bump maxAttempts to 5 this sprint. Anything in the history I should know first?"; "Was there an incident behind the retry cap in the payment code?"

   Non-trigger and near-miss prompts. Each asserts `not-skill-used` on the wrong skill, and on both skills where neither applies:

   | Prompt | Expect |
   | --- | --- |
   | "What does withRetry do when call() throws on the final attempt?" | `how`; `not-skill-used: why` |
   | "Why did the last refactor extract the backoff delay into its own function?" | `why`; `not-skill-used: how` |
   | "Add jitter to the backoff in src/retry.ts." | `not-skill-used: [how, why]` |
   | "Write a unit test for withRetry that covers the third failure." | `not-skill-used: [how, why]` |
   | "Why does `pnpm test` hang on my machine?" | `not-skill-used: why` ("why" wording, but it's local debugging) |
   | "Show me the last three commits that touched src/retry.ts." | `not-skill-used: why` (raw git log, no investigation) |

   Grow each skill toward 8-10 positives and 8-10 negatives, per skill-creator and agentskills.io. Keep the existing named-file prompts as the explicit class that OpenAI describes.

3. **Add the no-skill baseline.** `run.ts` builds a second workspace, `RAVN_EVALS_BASELINE_WORKSPACE`, with the same `createWorkspaceRepo` history, no `.claude/skills`, and an empty `.agents/skills/` so `pi.ts:142` doesn't throw. Add the three `baseline-*` providers from §2. Quality cases run on all six providers. Trigger cases are scoped to the three skill arms.

4. **Pin a login-based grader** in `defaultTest.options.provider`: `anthropic:claude-agent-sdk`, `model: claude-sonnet-5-5`, `apiKeyRequired: false`, no `working_dir`, as in §3. The same judge then grades all three harnesses. It avoids the unisolated Codex default and needs no keys.

5. **Add rubric checks next to the existing `icontains`.** Write them as PASS/FAIL conditions and run them on both arms:

   ```yaml
   - type: llm-rubric
     metric: how-quality
     value: |
       PASS if the answer explains the runtime path of a failing gateway call through checkout, withRetry, and the backoff delay, and names real files and symbols from the workspace. FAIL if it invents files or functions, or only paraphrases one function.
   - type: llm-rubric
     metric: why-quality
     value: |
       PASS if the answer ties maxAttempts = 3 to the PAY-42 outage and the gateway rate limit (HTTP 429) from PR #18, separates what the record states from inference, and lists sources consulted. FAIL if it attributes the choice to #21 or gives only generic reasons for capping retries.
   ```

   For `why`, `agent-rubric` could also check citations against the repo, using a grader with `working_dir: "{{ env.RAVN_EVALS_WORKSPACE }}"` and `append_allowed_tools: ["Bash"]` and a rubric such as "every commit or PR number cited exists in `git log`". Untested: whether promptfoo renders `{{ env.* }}` in a grader's config.

6. **Measure, then gate.**
   - The merge gate is `pnpm eval` with skill-arm rows passing.
   - Trigger rate: `pnpm eval -- --repeat 3 --filter-metadata kind=trigger -o results.json`, with a small repo-tooling script (for example `evals/report.ts`) that computes each case's trigger rate (target ≥ 0.5 for positives, < 0.5 for negatives) and each quality case's Δ (skill arm minus baseline arm), per harness.
   - Leave `select-best` out of the gate; use it only in a manual comparison run filtered to one harness pair.
