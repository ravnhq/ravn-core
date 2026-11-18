import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { ProviderResponse } from "promptfoo";
import { z } from "zod";

const toolCall = z.object({
  name: z.string(),
  input: z.object({
    path: z.string().optional(),
    file_path: z.string().optional(),
    command: z.string().optional(),
  }),
  output: z.union([z.string(), z.array(z.object({ text: z.string() }))]),
  is_error: z.literal(false),
});

const commandItem = z.object({
  type: z.literal("command_execution"),
  command: z.string(),
  aggregated_output: z.string(),
});

function codexCommands(raw: string | undefined) {
  if (raw === undefined) return [];

  try {
    const turn = z
      .object({ items: z.array(z.unknown()) })
      .parse(JSON.parse(raw));

    return turn.items.flatMap((item) => {
      const parsed = commandItem.safeParse(item);

      return parsed.success ? [parsed.data] : [];
    });
  } catch {
    return [];
  }
}

// The trace must contain file contents, not just a command argument (ls,
// stat, echo, a failed read, or a reply mentioning the name isn't proof).
function shellRead(
  command: string,
  output: string,
  file: string,
  lines: string[],
) {
  const paths = command.split(/[\s'"();|&<>]+/);

  if (!paths.some((path) => path === file || path.endsWith(`/${file}`)))
    return false;

  return lines.some((line) => output.includes(line));
}

export function referenceWasRead(response: ProviderResponse, file: string) {
  const cwd = z.string().safeParse(response.metadata?.workingDir).data;

  if (cwd === undefined) return false;

  const paths = [".agents", ".claude"].map((dir) => join(dir, "skills", file));
  const calls = z.array(z.unknown()).safeParse(response.metadata?.toolCalls);
  const shellCalls = codexCommands(z.string().safeParse(response.raw).data);

  for (const call of calls.data ?? []) {
    const parsed = toolCall.safeParse(call);

    if (!parsed.success) continue;

    const { name, input, output } = parsed.data;
    const path = input.file_path ?? input.path;

    if (
      ["Read", "read"].includes(name) &&
      path &&
      paths.some((wanted) => resolve(cwd, path) === resolve(cwd, wanted))
    )
      return true;

    if (["Bash", "bash"].includes(name) && input.command) {
      shellCalls.push({
        type: "command_execution",
        command: input.command,
        aggregated_output: Array.isArray(output)
          ? output.map(({ text }) => text).join("\n")
          : output,
      });
    }
  }

  if (shellCalls.length === 0) return false;

  for (const path of paths) {
    let lines: string[];

    try {
      lines = readFileSync(join(cwd, path), "utf8")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length >= 24);
    } catch {
      continue;
    }

    if (
      shellCalls.some(({ command, aggregated_output }) =>
        shellRead(command, aggregated_output, path, lines),
      )
    )
      return true;
  }

  return false;
}
