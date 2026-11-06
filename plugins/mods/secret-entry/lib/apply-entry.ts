import { applyDotenv, applyEdit, fillMarkers } from "./entry.ts";

// What applyEntry needs of the mod runtime. $.fs.write takes a path and text
// and no mode; $.fs.stat does not report one. A new file is therefore created
// with the shell under umask 0077, and stat(1) confirms the mode.
export type EntryIo = {
  read: (path: string) => Promise<string>;
  write: (path: string, text: string) => Promise<void>;
  exists: (path: string) => Promise<boolean>;
  run: (argv: readonly string[]) => Promise<{
    exitCode: number;
    stdout: string;
    stderr: string;
  }>;
};

export type ApplyEntry = {
  file: string;
  template: string | null;
  edit: { old: string; replaceAll: boolean } | null;
  keys: string[];
  values: Record<string, string>;
};

export type ApplyResult = { ok: true } | { ok: false; error: string };

type CommandResult =
  | { ok: true; stdout: string }
  | { ok: false; error: string };

const OWNER_ONLY = 0o600;

// Creates the file empty. The umask is set in this shell before the
// redirection, so the file is owner-only from the moment it exists.
const CREATE_OWNER_ONLY =
  'mkdir -p -- "$(dirname -- "$1")" && umask 0077 && : >> "$1"';

function permissionBits(text: string): number | null {
  const trimmed = text.trim();

  if (!/^[0-7]+$/.test(trimmed)) return null;

  return Number.parseInt(trimmed, 8) & 0o777;
}

function failed(file: string, detail: string): ApplyResult {
  return {
    ok: false,
    error: `could not make ${file} owner-only (0600): ${detail}`,
  };
}

async function run(
  io: EntryIo,
  argv: readonly string[],
): Promise<CommandResult> {
  try {
    const result = await io.run(argv);

    if (result.exitCode !== 0) {
      const detail = result.stderr.trim();

      return {
        ok: false,
        error:
          detail === ""
            ? `exit ${result.exitCode}`
            : `${detail} (exit ${result.exitCode})`,
      };
    }

    return { ok: true, stdout: result.stdout };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
}

async function permissionOf(
  io: EntryIo,
  file: string,
): Promise<{ ok: true; mode: number } | { ok: false; error: string }> {
  const gnu = await run(io, ["stat", "-c", "%a", "--", file]);

  if (gnu.ok) {
    const mode = permissionBits(gnu.stdout);

    if (mode !== null) return { ok: true, mode };
  }

  const bsd = await run(io, ["stat", "-f", "%Lp", "--", file]);

  if (bsd.ok) {
    const mode = permissionBits(bsd.stdout);

    if (mode !== null) return { ok: true, mode };
  }

  const why = gnu.ok ? bsd : gnu;

  return { ok: false, error: why.ok ? "stat returned no mode" : why.error };
}

async function ensureOwnerOnly(
  io: EntryIo,
  file: string,
): Promise<ApplyResult> {
  const seen = await permissionOf(io, file);

  if (seen.ok && seen.mode === OWNER_ONLY) return { ok: true };

  const changed = await run(io, ["chmod", "600", "--", file]);

  if (!changed.ok) return failed(file, changed.error);

  const after = await permissionOf(io, file);

  if (!after.ok) return failed(file, after.error);

  if (after.mode !== OWNER_ONLY) {
    return failed(file, `stat reports mode ${after.mode.toString(8)}`);
  }

  return { ok: true };
}

async function discard(io: EntryIo, file: string): Promise<void> {
  await run(io, ["rm", "-f", "--", file]);
}

/** Writes entry into its file. A new file is mode 0600 before it holds a secret. */
export async function applyEntry(
  io: EntryIo,
  entry: ApplyEntry,
): Promise<ApplyResult> {
  let content: string;

  if (entry.edit !== null && entry.template !== null) {
    let current: string;

    try {
      current = await io.read(entry.file);
    } catch {
      return { ok: false, error: `could not read ${entry.file}` };
    }

    const applied = applyEdit(
      current,
      entry.edit.old,
      fillMarkers(entry.template, entry.values),
      entry.edit.replaceAll,
    );

    if (!applied.ok) return { ok: false, error: applied.error };
    content = applied.content;
  } else if (entry.template !== null) {
    content = fillMarkers(entry.template, entry.values);
  } else {
    let current = "";

    try {
      current = await io.read(entry.file);
    } catch {
      // a new file
    }

    content = applyDotenv(
      current,
      entry.keys.map((key) => ({ key, value: entry.values[key] ?? "" })),
    );
  }

  let isNew = false;

  try {
    isNew = !(await io.exists(entry.file));
  } catch {
    // a write that fails reports itself below
  }

  if (isNew) {
    const created = await run(io, [
      "sh",
      "-c",
      CREATE_OWNER_ONLY,
      "sh",
      entry.file,
    ]);

    if (!created.ok) {
      await discard(io, entry.file);

      return failed(entry.file, created.error);
    }

    const owned = await ensureOwnerOnly(io, entry.file);

    if (!owned.ok) {
      await discard(io, entry.file);

      return owned;
    }
  }

  try {
    await io.write(entry.file, content);
  } catch (error) {
    return {
      ok: false,
      error: `could not write ${entry.file}: ${String(error)}`,
    };
  }

  if (isNew) {
    const owned = await ensureOwnerOnly(io, entry.file);

    if (!owned.ok) {
      await discard(io, entry.file);

      return owned;
    }
  }

  return { ok: true };
}
