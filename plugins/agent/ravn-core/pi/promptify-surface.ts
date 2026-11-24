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
  readonly isIdle: () => boolean;
  readonly onAgentSettled: (task: () => void) => () => void;
}

export function createPiPromptifySurface({
  mode,
  hasUI,
  ui,
  pi,
  customType,
  isIdle,
  onAgentSettled,
}: CreatePiPromptifySurfaceInput): PromptifySurface {
  const emitWhenIdle = (draft: string) => {
    const emit = () =>
      pi.sendMessage({ customType, content: draft, display: true });

    if (isIdle()) {
      emit();

      return;
    }

    let unsubscribe = () => {};

    unsubscribe = onAgentSettled(() => {
      unsubscribe();
      emit();
    });
  };

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
        emit: emitWhenIdle,
      };
    case "json":
    case "print":
      return {
        kind: "event",
        emit: emitWhenIdle,
      };
    default: {
      const exhaustive: never = mode;

      return exhaustive;
    }
  }
}
