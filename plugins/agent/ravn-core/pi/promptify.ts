import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { createInterface } from "node:readline";
import type {
  ExtensionAPI,
  JsonAgentSessionEvent,
} from "@earendil-works/pi-coding-agent";
import {
  getKeybindings,
  isKeyRelease,
  type TuiAltScreen,
  type TuiMainScreen,
  truncateToWidth,
} from "@earendil-works/pi-tui";

import { progress } from "./progress.ts";
import { createPiPromptifySurface } from "./promptify-surface.ts";
import { presentPromptify, rewritePrompt } from "../promptify/engine.ts";

const command = "promptify";

const timeoutMs = 20 * 60_000;

const closed = "session closed";

function invocation(): readonly [string, ...string[]] {
  const script = process.argv[1];

  if (script && !script.startsWith("/$bunfs/root/") && existsSync(script)) {
    return [process.execPath, script] as const;
  }

  const executable = /^(node|bun)(\.exe)?$/i.test(basename(process.execPath))
    ? "pi"
    : process.execPath;

  return [executable] as const;
}

export default function promptify(pi: ExtensionAPI) {
  let active: AbortController | undefined;

  pi.on("session_shutdown", () => {
    active?.abort(closed);
    active = undefined;
  });

  pi.registerCommand(`${command}-cancel`, {
    description: "Stop the Promptify helper without stopping the main turn",
    handler: async (_args, ctx) => {
      if (active) active.abort();
      else ctx.ui.notify("Promptify is not running.", "info");
    },
  });

  pi.registerCommand(command, {
    description:
      "Deepen a prompt in the background and leave it in the input box",
    handler: async (args, ctx) => {
      if (active) {
        ctx.ui.notify(
          "Promptify is already running. Press Esc or use /promptify-cancel.",
          "info",
        );

        return;
      }

      const request = args.trim();
      const sessionFile = ctx.sessionManager.getSessionFile();

      const fork =
        sessionFile && existsSync(sessionFile) ? sessionFile : undefined;

      const model = ctx.model;

      if (
        !request &&
        !ctx.sessionManager
          .getBranch()
          .some(
            (entry) =>
              entry.type === "message" && entry.message.role === "user",
          )
      ) {
        ctx.ui.notify(
          "Give Promptify a request: /promptify <prompt>",
          "warning",
        );

        return;
      }

      if (!model) {
        ctx.ui.notify(
          "Select a model with /model before running Promptify.",
          "warning",
        );

        return;
      }

      const run = new AbortController();
      active = run;

      const status = progress();
      const key = getKeybindings().getKeys("app.interrupt")[0];
      const cancel = key ? `${key} cancels` : "/promptify-cancel";
      let screen: TuiMainScreen | TuiAltScreen | undefined;
      let unsubscribe: (() => void) | undefined;

      if (ctx.mode === "tui") {
        ctx.ui.setWidget(command, (tui) => {
          // SAFETY: Pi supplies its main or alternate screen to TUI widgets.

          screen = tui as TuiMainScreen | TuiAltScreen;
          const timer = setInterval(() => tui.requestRender(), 500);

          return {
            render: (width) =>
              status.lines(cancel).map((line) => truncateToWidth(line, width)),
            invalidate() {},
            dispose: () => clearInterval(timer),
          };
        });
        unsubscribe = ctx.ui.onTerminalInput((data) => {
          if (
            run.signal.aborted ||
            isKeyRelease(data) ||
            !getKeybindings().matches(data, "app.interrupt")
          )
            return;

          // SAFETY: Only the Pi editor, checked below, has the action handlers.

          const editor = screen?.getFocusedComponent() as
            | { onEscape?: () => void }
            | null
            | undefined;

          if (!editor || !("actionHandlers" in editor)) return;

          // Let autocomplete and modal editors handle Esc before canceling.
          const original = editor.onEscape;

          const restore = () => {
            if (editor.onEscape === interrupt) editor.onEscape = original;
          };

          const interrupt = () => {
            restore();
            run.abort();
          };

          editor.onEscape = interrupt;
          queueMicrotask(restore);
        });
      }

      const finish = async () => {
        let directory: string | undefined;

        try {
          const skill = readFileSync(
            new URL("../skills/promptify/SKILL.md", import.meta.url),
            "utf8",
          );

          const result = await rewritePrompt({
            request,
            workflow: skill,
            signal: run.signal,
            run: async ({ task }) => {
              directory = fork
                ? mkdtempSync(join(tmpdir(), "ravn-promptify-"))
                : undefined;

              const [executable, ...prefix] = invocation();

              const child = spawn(
                executable,
                [
                  ...prefix,
                  "--mode",
                  "json",
                  "-p",
                  "--no-extensions",
                  "--no-mcp",
                  "--no-skills",
                  "--no-context-files",
                  "--tools",
                  "read,grep,find,ls",
                  "--model",
                  `${model.provider}/${model.id}`,
                  "--thinking",
                  ctx.thinkingLevel ?? "off",
                  ...(fork && directory
                    ? ["--fork", fork, "--session-dir", directory]
                    : ["--no-session"]),
                  "--",
                  task,
                ],
                { cwd: ctx.cwd, stdio: ["ignore", "pipe", "pipe"] },
              );

              const stop = () => child.kill();

              const timeout = setTimeout(
                () => run.abort("timed out"),
                timeoutMs,
              );

              run.signal.addEventListener("abort", stop, { once: true });
              let answer = "";
              let error = "";
              let stderr = "";
              child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
                stderr = (stderr + chunk).slice(-1024);
              });
              const lines = createInterface({ input: child.stdout });
              lines.on("line", (line) => {
                if (run.signal.aborted) return;

                try {
                  const event: JsonAgentSessionEvent = JSON.parse(line);

                  status.update(event);

                  if (
                    event.type !== "message_end" ||
                    event.message.role !== "assistant"
                  )
                    return;

                  error =
                    event.message.stopReason === "error" ||
                    event.message.stopReason === "aborted"
                      ? (event.message.errorMessage ??
                        `Request ${event.message.stopReason}`)
                      : "";
                  answer = event.message.content
                    .flatMap((part) =>
                      part.type === "text" ? [part.text] : [],
                    )
                    .join("\n");
                } catch {
                  // Print mode may emit notices alongside JSON events.
                }
              });

              try {
                await new Promise<void>((resolve, reject) => {
                  child.once("error", reject);
                  child.once("close", (code, signal) => {
                    if (code === 0 || run.signal.aborted) resolve();
                    else
                      reject(
                        new Error(
                          stderr.trim() ||
                            `Pi helper exited (${signal ?? code}).`,
                        ),
                      );
                  });
                });
              } finally {
                clearTimeout(timeout);
                run.signal.removeEventListener("abort", stop);
                lines.close();
              }

              if (run.signal.aborted) {
                if (run.signal.reason !== closed)
                  ctx.ui.notify(
                    run.signal.reason === "timed out"
                      ? "Promptify timed out. Nothing was sent."
                      : "Promptify canceled. Nothing was sent.",
                    "info",
                  );

                return answer;
              }

              if (error) throw new Error(error);

              return answer;
            },
          });

          if (run.signal.aborted) return;

          pi.appendEntry(command, result);

          await presentPromptify({
            result,
            surface: createPiPromptifySurface({
              mode: ctx.mode,
              hasUI: ctx.hasUI,
              ui: ctx.ui,
              pi,
              customType: command,
              isIdle: () => ctx.isIdle(),
              onAgentSettled: (task) => pi.on("agent_settled", () => task()),
            }),
          });

          if (ctx.mode === "tui")
            ctx.ui.notify(
              "Promptify draft is in the input box. Nothing was sent.",
              "info",
            );
        } catch (error) {
          if (!run.signal.aborted)
            ctx.ui.notify(
              `Promptify failed: ${error instanceof Error ? error.message : String(error)}`,
              "error",
            );
        } finally {
          unsubscribe?.();

          if (active === run) {
            active = undefined;

            if (ctx.mode === "tui") ctx.ui.setWidget(command, undefined);
          }

          if (directory)
            rmSync(directory, { recursive: true, force: true, maxRetries: 2 });
        }
      };

      if (ctx.mode === "tui") void finish();
      else await finish();
    },
  });
}
