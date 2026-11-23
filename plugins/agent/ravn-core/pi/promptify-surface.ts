import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";

import type { PromptifySurface } from "../promptify/engine.ts";

interface PromptifyUi {
  readonly getEditorText: () => string;
  readonly setEditorText: (text: string) => void;
  readonly editor: (
    title: string,
    prefill?: string,
  ) => Promise<string | undefined>;
}

interface PromptifyMessage {
  readonly customType: string;
  readonly content: string;
  readonly display: true;
}

interface PromptifyPi {
  readonly sendMessage: (message: PromptifyMessage) => void;
}

interface CreatePiPromptifySurfaceInput {
  readonly mode: ExtensionCommandContext["mode"];
  readonly hasUI: boolean;
  readonly ui: PromptifyUi;
  readonly pi: PromptifyPi;
  readonly customType: string;
  readonly defer?: (task: () => void) => void;
}

export function createPiPromptifySurface({
  mode,
  hasUI,
  ui,
  pi,
  customType,
  defer = (task) => setImmediate(task),
}: CreatePiPromptifySurfaceInput): PromptifySurface {
  switch (mode) {
    case "tui":
      return {
        kind: "composer",
        getText: ui.getEditorText,
        setText: ui.setEditorText,
      };
    case "rpc":
      if (hasUI) return { kind: "dialog", edit: ui.editor };

      return {
        kind: "event",
        emit: (draft) =>
          defer(() =>
            pi.sendMessage({ customType, content: draft, display: true }),
          ),
      };
    case "json":
    case "print":
      return {
        kind: "event",
        emit: (draft) =>
          defer(() =>
            pi.sendMessage({ customType, content: draft, display: true }),
          ),
      };
    default: {
      const exhaustive: never = mode;

      return exhaustive;
    }
  }
}
