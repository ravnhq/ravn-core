import { atom, read, update } from "claude-code";
import type { EngineInterface, InputProps, Register } from "claude-code";
import type { ElementConstructor } from "claude-code";

import { applyEntry as writeEntry } from "../lib/apply-entry.ts";
import {
  INPUT_SCHEMA,
  clipboardReaders,
  elideMarkers,
  markerNames,
  maskOf,
  normalizeLineEnds,
  parseToolArgs,
  redactSerialized,
  typedValue,
} from "../lib/entry.ts";
import type { Entry } from "../types";

const PLUGIN = "secret-entry";

const PANE = "secret-entry";

const COMMAND = "secret-entry";

const POLL_SECONDS = "0.25";

// A hook has 10 s of its own time, but time spent inside a $ call is free, so
// the hold loop waits on a short $.process.run until a button answers it.
const HOLD_LIMIT_MS = 10 * 60 * 1000;

type Elements = ReturnType<EngineInterface["ui"]["resolve"]>;

type Outcome = "write" | "cancel" | "timeout" | "interrupted" | "error";

// The entry in progress, drawn in the pane. Callbacks write it with update, so
// every change redraws; hooks read it with read.
const entryAtom = atom({ plugin: "secret-entry", key: "entry" } as const, null);

// One entry at a time: calls in a turn run in order, and a second waits. The
// flag flips with no await between its check and its claim, so two calls can't
// both get through.
let busy = false;

// The entry the hold loop reads. A hook that runs on keeps the state it read
// at its start, so the loop can't see a callback's atom write; callbacks set
// this, and mirror it into the atom only so the pane redraws.
let live: Entry | null = null;

async function setEntry(
  $: EngineInterface,
  fn: (now: Entry) => Entry,
): Promise<void> {
  if (live === null) return;
  const next = fn(live);
  live = next;
  await update($, entryAtom, () => next);
}

let interactive = false;

let uname = "";

// The narrow terminal draws the pane's content in the band above the prompt.
let inBand = false;

// The values this session wrote, by file path, so Read results are redacted.
// Kept in memory only, never in the plugin store: no copy on disk.
const written = new Map<string, string[]>();

async function readClipboard($: EngineInterface): Promise<string | null> {
  if (uname === "") {
    try {
      const probe = await $.process.run(["uname", "-s"], { timeoutMs: 3000 });
      uname = probe.exitCode === 0 ? probe.stdout.trim() : "?";
    } catch {
      uname = "?";
    }
  }

  for (const argv of clipboardReaders(uname)) {
    try {
      const run = await $.process.run(argv, { timeoutMs: 3000 });

      if (run.exitCode === 0) return run.stdout;
    } catch {
      // try the next reader
    }
  }

  return null;
}

async function applyEntry(
  $: EngineInterface,
  entry: Entry,
): Promise<{ ok: true } | { ok: false; error: string }> {
  // $.fs.write takes no mode, so a new file is created empty at 0600 and
  // checked with stat before any secret byte is written into it.
  const applied = await writeEntry(
    {
      read: (path) => $.fs.read(path),
      write: (path, text) => $.fs.write(path, text),
      exists: (path) => $.fs.exists(path),
      run: (argv) => $.process.run(argv, { timeoutMs: 3000 }),
    },
    entry,
  );

  if (!applied.ok) return applied;

  const known = written.get(entry.file) ?? [];

  for (const key of entry.keys) {
    const value = entry.values[key] ?? "";

    if (value !== "" && !known.includes(value)) known.push(value);
  }

  written.set(entry.file, known);

  return { ok: true };
}

async function runEntry(
  $: EngineInterface,
  entry: Entry,
  signal: AbortSignal | undefined,
): Promise<{ entry: Entry; outcome: Outcome }> {
  busy = true;
  let outcome: Outcome;

  try {
    live = structuredClone(entry);
    await update($, entryAtom, () => live);

    const opened = await $.ui.open({
      id: PANE,
      title: "Secret entry",
      focus: true,
      closeOnEscape: true,
      rows: 12,
    });

    inBand = !opened.isPlaced;
    $.ui.invalidate("ui.render");
    const startedAt = await $.clock.now();
    outcome = "cancel";
    // A submit hands the keyboard back to the prompt, so when the entry moves
    // to another step, the loop asks the open pane for the keyboard again and
    // seats the ring back on the field. Only the loop may: a $ call from
    // inside the Input's own chain is refused as re-entry.
    let stepSeen = -1;

    for (;;) {
      if (signal?.aborted === true) {
        outcome = "interrupted";
        break;
      }

      if ((await $.clock.now()) - startedAt > HOLD_LIMIT_MS) {
        outcome = "timeout";
        break;
      }

      const current = live;

      if (current === null || current.decision !== null) break;

      if (current.index !== stepSeen) {
        stepSeen = current.index;
        await $.ui
          .open({
            id: PANE,
            title: "Secret entry",
            focus: true,
            closeOnEscape: true,
            rows: 12,
          })
          .catch(() => undefined);
        await $.ui
          .focus({ requestId: PANE, key: "field" })
          .catch(() => undefined);
      }

      await $.process.run(["sleep", POLL_SECONDS], { timeoutMs: 5000 });
    }
  } catch {
    outcome = "error";
  }

  const settled = live ?? entry;

  if (settled.decision === "write" && outcome === "cancel") outcome = "write";
  busy = false;
  live = null;
  await update($, entryAtom, () => null);
  $.ui.invalidate("ui.render");

  try {
    await $.ui.close({ id: PANE });
  } catch {
    // the pane is already gone
  }

  return { entry: settled, outcome };
}

async function waitTurn($: EngineInterface, file: string, aborted: boolean) {
  while (busy) {
    if (aborted) {
      return {
        deny: `${PLUGIN}: the turn was interrupted before the secrets for ${file} could be entered. Ask the user before writing ${file} again.`,
      };
    }

    await $.process.run(["sleep", POLL_SECONDS], { timeoutMs: 5000 });
  }

  return null;
}

async function answerToolCall(
  $: EngineInterface,
  entry: Entry,
  signal: AbortSignal,
): Promise<{ result: unknown } | { deny: string }> {
  const done = await runEntry($, entry, signal);

  if (done.outcome !== "write") {
    return denyFor(done.entry, done.outcome, null);
  }

  const applied = await applyEntry($, done.entry);

  if (!applied.ok) return denyFor(done.entry, "error", applied.error);

  return writeResult(done.entry);
}

function namesOf(entry: Entry): string {
  return entry.keys.join(", ");
}

// A built-in tool's call is answered in that tool's own result shape. The
// result is kept in the session's transcript file, so its content is the
// template with every secret elided, and originalFile is left out.
function writeResult(entry: Entry) {
  const shown =
    entry.template === null ? "" : elideMarkers(entry.template, 4000);

  if (entry.origin === "Write") {
    return {
      result: {
        type: "create",
        filePath: entry.file,
        content: shown,
        structuredPatch: [],
        originalFile: null,
      },
    };
  }

  if (entry.origin === "Edit" && entry.edit !== null) {
    return {
      result: {
        filePath: entry.file,
        oldString: entry.edit.old,
        newString: shown,
        originalFile: null,
        structuredPatch: [],
        userModified: false,
        replaceAll: entry.edit.replaceAll,
      },
    };
  }

  return messageResult(entry);
}

function messageResult(entry: Entry) {
  const count = entry.keys.length;

  const elided =
    entry.template === null
      ? ""
      : `\n\nFile as written, secrets elided:\n\n${elideMarkers(entry.template)}`;

  return {
    result:
      `${PLUGIN}: ${entry.file} is written — ${count} secret${count === 1 ? "" : "s"} the user pasted (${namesOf(entry)}). ` +
      "The values are on disk only: they never entered this transcript, and Read results for this file are redacted for this session. Do not print the secret lines." +
      elided,
  };
}

function denyFor(entry: Entry, outcome: Outcome, error: string | null) {
  const why =
    outcome === "error"
      ? `writing it failed${error === null ? "" : `: ${error}`}`
      : outcome === "timeout"
        ? "no one answered within 10 minutes"
        : outcome === "interrupted"
          ? "the turn was interrupted"
          : "the user declined to enter the secrets";

  return {
    deny:
      `${PLUGIN}: ${entry.file} was not written — ${why}. ` +
      `Ask the user to fill the secrets themselves, or to run /${COMMAND} ${entry.file} ${namesOf(entry)}, then continue.`,
  };
}

function drawEntry(t: Elements, entry: Entry, $: EngineInterface) {
  // SAFETY: the render hooks pass mobile through before calling this, and
  // every other surface's table carries Input, so the union holds it here.
  const { Box, Text, Button, Input } = t as Elements & {
    Input: ElementConstructor<InputProps>;
  };

  const total = entry.keys.length;
  const confirming = entry.index >= total;
  const name = entry.keys[Math.min(entry.index, total - 1)] ?? "";
  const fromTool = entry.origin !== COMMAND;

  const body = (
    <Box flexDirection="column">
      {confirming ? (
        <Box flexDirection="column">
          <Text>Writing this file with:</Text>
          <Box flexDirection="column" paddingLeft={2}>
            {entry.keys.map((key) => (
              <Text key={key}>
                {`${key} — ${Array.from(entry.values[key] ?? "").length} chars`}
              </Text>
            ))}
          </Box>
        </Box>
      ) : (
        <Box flexDirection="column">
          <Text>{`Secret ${entry.index + 1} of ${total}`}</Text>
          <Text bold>{name}</Text>
        </Box>
      )}
      <Input
        key="field"
        label={confirming ? "write" : "value"}
        value={maskOf(entry.field)}
        placeholder={
          confirming
            ? "press Enter to write this file"
            : "paste the value, then press Enter"
        }
        submitLabel={confirming ? "write" : "next"}
        autoFocus={true}
        onInput={async (typed) => {
          await setEntry($, (now) =>
            now === null
              ? now
              : { ...now, field: typedValue(typed, now.field) },
          );
        }}
        onSubmit={async (typed) => {
          await setEntry($, (now) => {
            if (now === null) return now;

            // The last Enter writes: the file is filled, and this pane's whole
            // part in it is done.
            if (now.index >= now.keys.length) {
              return { ...now, decision: "write" };
            }

            const value = normalizeLineEnds(typedValue(typed, now.field));

            if (value === "") {
              return {
                ...now,
                note: "Nothing entered — paste the secret first, or press Cancel.",
              };
            }

            const key = now.keys[now.index] ?? "";

            return {
              ...now,
              values: { ...now.values, [key]: value },
              field: "",
              note: null,
              index: now.index + 1,
            };
          });
        }}
      />
    </Box>
  );

  const decide = (decision: "write" | "cancel") => async () => {
    await setEntry($, (now) => (now === null ? now : { ...now, decision }));
  };

  async function fromClipboard() {
    const text = await readClipboard($);
    await setEntry($, (now) =>
      now === null
        ? now
        : {
            ...now,
            field: text === null ? now.field : normalizeLineEnds(text),
            note:
              text === null
                ? "Couldn't read the clipboard. Paste into the field instead."
                : null,
          },
    );
  }

  const goBack = async () => {
    await setEntry($, (now) =>
      now.index <= 0
        ? now
        : {
            ...now,
            index: now.index - 1,
            field: now.values[now.keys[now.index - 1] ?? ""] ?? "",
          },
    );
  };

  const buttons = (
    <Box columnGap={2} marginTop={1}>
      {!confirming && entry.index > 0 ? (
        <Button
          key="back"
          label="Back"
          hotkey="b"
          plain={true}
          onPress={goBack}
        />
      ) : null}
      {!confirming ? (
        <Button
          key="clipboard"
          label="From clipboard"
          hotkey="p"
          plain={true}
          onPress={async () => {
            await fromClipboard();
          }}
        />
      ) : null}
      <Button
        key="cancel"
        label="Cancel"
        hotkey="c"
        plain={true}
        onPress={decide("cancel")}
      />
    </Box>
  );

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="suggestion"
      paddingX={1}
    >
      <Text bold wrap="truncate-end">
        {`🔑 secret-entry · ${entry.file}`}
      </Text>
      <Text dimColor>
        {fromTool
          ? `Claude is writing this file (${entry.origin}); it waits while you enter the secrets.`
          : `/${COMMAND}`}
      </Text>
      {body}
      {buttons}
      {entry.note === null ? null : (
        <Text italic dimColor>
          {entry.note}
        </Text>
      )}
      <Text dimColor>Values never enter the chat.</Text>
    </Box>
  );
}

export const register: Register = (on) => {
  busy = false;
  live = null;
  interactive = false;
  uname = "";
  inBand = false;
  written.clear();

  on("session.start", async ($, e, next) => {
    interactive = e.isInteractive;
    await $.command.register({
      name: COMMAND,
      description:
        "Paste secrets into a file through a masked prompt; they never enter the chat",
      argumentHint: "<file> [KEY...]",
    });
    await $.tool.register({
      name: "write",
      description:
        "Write a file that contains secrets without the secrets entering the transcript. Pass file_path as for the Write tool, and in content write {{secret:NAME}} where each secret goes. The user pastes each value into a masked prompt; the file is then written with the values filled in. Use this for .env files, tokens, and credentials instead of Write.",
      inputSchema: INPUT_SCHEMA,
    });

    return next(e);
  });

  on("tool.call", { tool: ["Write", "Edit"] }, async ($, e, next) => {
    const args = parseToolArgs(JSON.stringify(e));
    const file = args.filePath ?? null;
    const writeContent = args.content;
    const newString = args.newString;

    const target =
      e.tool === "Write" && writeContent !== undefined
        ? writeContent
        : e.tool === "Edit" && newString !== undefined
          ? newString
          : null;

    if (file === null || target === null) return next(e);
    const keys = markerNames(target);

    if (keys.length === 0) return next(e);

    if (!interactive) {
      return {
        deny:
          `${PLUGIN}: ${file} holds {{secret:NAME}} markers, and this session has no one to ask for the values. ` +
          "Write the file with placeholders such as YOUR_TOKEN and ask the user to fill it.",
      };
    }

    const queued = await waitTurn($, file, next.signal.aborted);

    if (queued !== null) return queued;

    const entry: Entry = {
      origin: e.tool,
      file,
      template: target,
      edit:
        e.tool === "Edit"
          ? {
              old: args.oldString ?? "",
              replaceAll: args.replaceAll,
            }
          : null,
      keys,
      values: {},
      index: 0,
      field: "",
      note: null,
      decision: null,
    };

    return answerToolCall($, entry, next.signal);
  }).catch(async (_$, _e, next) =>
    // A hold that fails refuses the write, so no literal marker reaches disk.
    next.called
      ? next(_e)
      : {
          deny:
            `${PLUGIN}: it hit an error while holding this write, so the file was not written (${next.error.kind}). ` +
            "Ask the user to fill the secrets themselves.",
        },
  );

  on("tool.call", { tool: "mcp__secret-entry__write" }, async ($, e, next) => {
    const args = parseToolArgs(JSON.stringify(e));
    const file = args.filePath ?? null;
    const content = args.content ?? null;

    if (file === null || content === null) {
      return { deny: `${PLUGIN}: file_path and content are required strings.` };
    }

    const keys = markerNames(content);

    if (keys.length === 0) {
      return {
        deny:
          `${PLUGIN}: content has no {{secret:NAME}} markers, so there is nothing to keep out of the transcript. ` +
          "Use the Write tool instead.",
      };
    }

    if (!interactive) {
      return {
        deny:
          `${PLUGIN}: this session has no one to ask for secrets. ` +
          "Write the file with placeholders and ask the user to fill it.",
      };
    }

    const queued = await waitTurn($, file, next.signal.aborted);

    if (queued !== null) return queued;

    const entry: Entry = {
      origin: "the secret-entry write tool",
      file,
      template: content,
      edit: null,
      keys,
      values: {},
      index: 0,
      field: "",
      note: null,
      decision: null,
    };

    return answerToolCall($, entry, next.signal);
  }).catch(async (_$, _e, next) =>
    next.called
      ? next(_e)
      : {
          deny: `${PLUGIN}: it hit an error while holding this write (${next.error.kind}), so the file was not written.`,
        },
  );

  on("command.run", { command: COMMAND }, async ($, e) => {
    const args = String(e.args ?? "")
      .trim()
      .split(/\s+/)
      .filter((word) => word !== "");

    if (args.length === 0) {
      return {
        text:
          `Usage: /${COMMAND} <file> [KEY...]\n` +
          "With KEY names, each becomes a KEY=value line (dotenv style). With only a file, every {{secret:NAME}} marker in it is filled. Values are pasted into a masked prompt and never enter the chat.",
      };
    }

    const [file = "", ...keys] = args;
    const bad = keys.find((key) => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key));

    if (bad !== undefined) {
      return { text: `${PLUGIN}: not a KEY name: ${bad}` };
    }

    let entry: Entry;

    if (keys.length > 0) {
      entry = {
        origin: COMMAND,
        file,
        template: null,
        edit: null,
        keys,
        values: {},
        index: 0,
        field: "",
        note: null,
        decision: null,
      };
    } else {
      let current: string;

      try {
        current = await $.fs.read(file);
      } catch {
        return {
          text: `${PLUGIN}: no file at ${file}. Usage: /${COMMAND} <file> [KEY...]`,
        };
      }

      const names = markerNames(current);

      if (names.length === 0) {
        return {
          text:
            `${PLUGIN}: ${file} has no {{secret:NAME}} markers to fill.\n` +
            `Usage: /${COMMAND} <file> [KEY...] sets KEY=value lines instead.`,
        };
      }

      entry = {
        origin: COMMAND,
        file,
        template: current,
        edit: null,
        keys: names,
        values: {},
        index: 0,
        field: "",
        note: null,
        decision: null,
      };
    }

    const done = await runEntry($, entry, undefined);

    if (done.outcome !== "write") {
      return { text: denyFor(done.entry, done.outcome, null).deny };
    }

    const applied = await applyEntry($, done.entry);

    if (!applied.ok) {
      return {
        text: `${PLUGIN}: ${file} was not written: ${applied.error}`,
      };
    }

    const set = done.entry.keys
      .map(
        (key) =>
          `${key} (${Array.from(done.entry.values[key] ?? "").length} chars)`,
      )
      .join(", ");

    return {
      text:
        `Wrote ${file} — set ${set}. ` +
        "The values never entered the chat; Read results for the file are redacted for this session.",
    };
  });

  on("tool.call", { tool: "Read" }, async (_$, e, next) => {
    const file = parseToolArgs(JSON.stringify(e)).filePath;
    const values = file === undefined ? undefined : written.get(file);

    if (values === undefined || values.length === 0) return next(e);

    const result = await next(e);

    if ("deny" in result) return result;

    return JSON.parse(redactSerialized(JSON.stringify(result), values));
  }).catch(async (_$, _e, next) =>
    // A redaction that fails withholds the read rather than leak it.
    next.called
      ? {
          deny: `${PLUGIN}: redaction failed (${next.error.kind}), so the read's result was withheld.`,
        }
      : next(_e),
  );

  on("ui.close", async ($, e, next) => {
    if (e.id === PANE && e.origin.kind === "person") {
      await setEntry($, (now) =>
        now === null ? now : { ...now, decision: now.decision ?? "cancel" },
      );
    }

    return next(e);
  }).catch(async (_$, _e, next) => next(_e));

  on("ui.render", { component: "Pane" }, async ($, e, next) => {
    if (e.requestId !== PANE || e.surface === "mobile") return next(e);
    const entry = await read($, entryAtom);

    if (entry === null) {
      // Between the entry settling and the pane closing, say only this.
      const { Text } = $.ui.resolve(e);

      return <Text dimColor>secret-entry</Text>;
    }

    return drawEntry($.ui.resolve(e), entry, $);
  });

  on("ui.render", { component: "AbovePrompt" }, async ($, e, next) => {
    if (!inBand || e.props.hasSurvey || e.surface === "mobile") {
      return next(e);
    }

    const entry = await read($, entryAtom);

    if (entry === null) return next(e);

    return drawEntry($.ui.resolve(e), entry, $);
  });
};
