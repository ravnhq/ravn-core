// What a guide bench run is made of, frozen when it starts. A resume compares the inputs it was
// given with the run's manifest and refuses any difference before a single call, so one run folder
// never mixes answers from two writers, judges, guides, task lists, Claude Code versions, or two
// versions of what Claude is asked and shown. The revision is kept as provenance only: layout rules
// are recomputed whenever a report runs.
import { readTask, stringsOf } from "./tasks.ts";
import type { Task } from "./tasks.ts";

export type Manifest = {
  command: "run" | "tasks";
  repeats: number;
  writer: string;
  /** The model that grades, or 'none' for a run that only writes. */
  judge: string;
  /** The writer's effort flag, or 'default' when none was passed. */
  effort: string;
  /** Each arm's guide, by its SHA-256; the text itself is saved beside the manifest. */
  arms: Record<string, string>;
  /** For `tasks`: the tasks it was started with, whole: all of tasks.ts, those named with --task, or those read from --tasks. */
  tasks?: Task[];
  /** For `run`: the replies' ids and the corpus file's SHA-256. */
  corpus?: { ids: string[]; sha256: string };
  /** `claude --version`. */
  claude: string;
  /**
   * The SHA-256 of the code that decides what Claude is asked and shown, and which rewrites reach the
   * judge: grading.ts, measure.ts and hooks/parse.ts. The runner itself is not in it.
   */
  code: string;
  revision: { commit: string; isDirty: boolean };
};

/** What an error says, whatever was thrown. */
export const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

/** The fields in which `current` differs from the `frozen` manifest, leaving out the revision. */
export function differences(frozen: Manifest, current: Manifest): string[] {
  const keys = new Set(
    [...Object.keys(frozen), ...Object.keys(current)].filter(
      (key) => key !== "revision",
    ),
  );
  const paths: string[] = [];
  for (const key of [...keys].sort()) {
    const a: unknown = Reflect.get(frozen, key),
      b: unknown = Reflect.get(current, key);
    if (key === "arms" || key === "tasks") {
      const named = (value: unknown) =>
        new Map(
          Array.isArray(value)
            ? value.map((task) => [String(Reflect.get(task, "id")), task])
            : Object.entries(value ?? {}),
        );
      const before = named(a),
        after = named(b);
      for (const name of [
        ...new Set([...before.keys(), ...after.keys()]),
      ].sort()) {
        if (canonical(before.get(name)) !== canonical(after.get(name)))
          paths.push(`${key}.${name}`);
      }
    } else if (canonical(a) !== canonical(b)) paths.push(key);
  }
  return paths;
}

/** `value` as JSON with every object's keys sorted, so the order fields were written in never counts. */
function canonical(value: unknown): string {
  return JSON.stringify(value, (_, inner: unknown) =>
    typeof inner === "object" && inner !== null && !Array.isArray(inner)
      ? Object.fromEntries(
          Object.entries(inner).sort(([a], [b]) => a.localeCompare(b)),
        )
      : inner,
  );
}

/** A manifest read back from disk, or an error naming what is wrong with it. */
export function readManifest(text: string): Manifest {
  const value: unknown = JSON.parse(text);
  const get = (key: string): unknown =>
    typeof value === "object" && value !== null
      ? Reflect.get(value, key)
      : undefined;
  const [
    command,
    repeats,
    writer,
    judge,
    effort,
    arms,
    tasks,
    corpus,
    claude,
    code,
    revision,
  ] = [
    "command",
    "repeats",
    "writer",
    "judge",
    "effort",
    "arms",
    "tasks",
    "corpus",
    "claude",
    "code",
    "revision",
  ].map(get);
  const commit: unknown =
    typeof revision === "object" && revision !== null
      ? Reflect.get(revision, "commit")
      : undefined;
  const isDirty: unknown =
    typeof revision === "object" && revision !== null
      ? Reflect.get(revision, "isDirty")
      : undefined;
  const armList =
    typeof arms === "object" && arms !== null ? Object.entries(arms) : [];
  if (
    (command !== "run" && command !== "tasks") ||
    typeof repeats !== "number" ||
    !Number.isInteger(repeats) ||
    repeats < 1 ||
    typeof writer !== "string" ||
    typeof judge !== "string" ||
    typeof effort !== "string" ||
    typeof claude !== "string" ||
    typeof code !== "string" ||
    typeof commit !== "string" ||
    typeof isDirty !== "boolean" ||
    armList.length === 0 ||
    !armList.every(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    )
  ) {
    throw new Error("manifest.json is not a guide bench manifest");
  }
  const ids =
    typeof corpus === "object" && corpus !== null
      ? stringsOf(Reflect.get(corpus, "ids"))
      : undefined;
  const sha256: unknown =
    typeof corpus === "object" && corpus !== null
      ? Reflect.get(corpus, "sha256")
      : undefined;
  const replies =
    ids !== undefined && typeof sha256 === "string"
      ? { ids, sha256 }
      : undefined;
  // Each command needs its own inputs whole: a tasks run its tasks, a corpus run its replies.
  if (command === "tasks" && !Array.isArray(tasks))
    throw new Error("manifest.json holds no tasks");
  if (command === "run" && replies === undefined)
    throw new Error("manifest.json holds no corpus");

  return {
    command,
    repeats,
    writer,
    judge,
    effort,
    arms: Object.fromEntries(armList),
    ...(Array.isArray(tasks) && { tasks: tasks.map(readTask) }),
    ...(replies !== undefined && { corpus: replies }),
    claude,
    code,
    revision: { commit, isDirty },
  };
}

/**
 * The rows of a JSON Lines file. A write cut short leaves a partial last line, which is skipped and
 * reported; a malformed line anywhere else is an error.
 */
export function rowsOf(text: string): { rows: unknown[]; isCut: boolean } {
  const lines = text.split("\n");
  const rows: unknown[] = [];
  let isCut = false;
  lines.forEach((line, i) => {
    if (line.trim() === "") return;
    try {
      rows.push(JSON.parse(line));
    } catch (error) {
      if (
        i < lines.length - 1 &&
        lines.slice(i + 1).some((rest) => rest.trim() !== "")
      )
        throw new Error(`line ${i + 1} is malformed: ${messageOf(error)}`);
      isCut = true;
    }
  });
  return { rows, isCut };
}
