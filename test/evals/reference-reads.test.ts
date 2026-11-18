import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { referenceWasRead } from "../../evals/reference-reads.ts";

test("disclosure requires a completed read of the installed reference", () => {
  const workingDir = mkdtempSync(join(tmpdir(), "ravn-reference-"));
  const file = "example/references/options.md";
  const installed = join(".agents/skills", file);
  const contents = "Name the artifact and check the final result.";
  mkdirSync(join(workingDir, dirname(installed)), { recursive: true });
  writeFileSync(join(workingDir, installed), contents);

  try {
    const read = {
      name: "Read",
      input: { file_path: installed },
      output: contents,
      is_error: false,
    };

    const tool = (call: {
      name: string;
      input: { file_path?: string; path?: string };
      output?: string;
      is_error: boolean;
    }) =>
      referenceWasRead({ metadata: { workingDir, toolCalls: [call] } }, file);

    assert.ok(tool(read));
    assert.ok(tool({ ...read, name: "read", input: { path: installed } }));
    assert.ok(!tool({ ...read, name: "Write" }));
    assert.ok(!tool({ ...read, is_error: true }));
    assert.ok(!tool({ ...read, output: undefined }));
    assert.ok(
      !tool({
        ...read,
        input: { file_path: ".agents/skills/example/SKILL.md" },
      }),
    );

    const shell = (command: string, output: string) =>
      referenceWasRead(
        {
          raw: JSON.stringify({
            items: [
              { type: "command_execution", command, aggregated_output: output },
            ],
          }),
          metadata: { workingDir },
        },
        file,
      );

    assert.ok(shell(`cat '${installed}'`, `Output:\n${contents}`));
    assert.ok(!shell(`ls '${installed}'`, installed));
    assert.ok(!shell(`cat '${installed}.bak'`, contents));
    assert.ok(!shell(`cat '${installed}'`, "No such file or directory"));
  } finally {
    rmSync(workingDir, { recursive: true, force: true });
  }
});
