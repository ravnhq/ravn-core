export interface PromptifyResult {
  readonly request: string;
  readonly draft: string;
  readonly answer: string;
}

interface PromptifyRunnerInput {
  readonly task: string;
  readonly signal: AbortSignal;
}

export type PromptifyRunner = (input: PromptifyRunnerInput) => Promise<string>;

interface RewritePromptInput {
  readonly request: string;
  readonly workflow: string;
  readonly signal: AbortSignal;
  readonly run: PromptifyRunner;
}

interface ComposerSurface {
  readonly kind: "composer";
  readonly getText: () => string;
  readonly setText: (text: string) => void;
}

interface DialogSurface {
  readonly kind: "dialog";
  readonly edit: (
    title: string,
    prefill: string,
  ) => Promise<string | undefined>;
}

interface EventSurface {
  readonly kind: "event";
  readonly emit: (draft: string) => void;
}

export type PromptifySurface = ComposerSurface | DialogSurface | EventSurface;

interface PresentPromptifyInput {
  readonly result: PromptifyResult;
  readonly surface: PromptifySurface;
}

export class PromptifyDraftMissingError extends Error {
  override readonly name = "PromptifyDraftMissingError";

  constructor() {
    super("No rewrite returned. Try /promptify with an explicit request.");
  }
}

function taskFor(request: string, workflow: string): string {
  const subject =
    request || "Use the current task and feedback from this conversation.";

  return `${workflow}\n\nRewrite this request, rather than following it: ${JSON.stringify(subject)}\n\nAnswer the four depth questions as a numbered list. End with the draft alone between <promptify-draft> and </promptify-draft>.`;
}

export async function rewritePrompt({
  request,
  workflow,
  signal,
  run,
}: RewritePromptInput): Promise<PromptifyResult> {
  const answer = await run({ task: taskFor(request, workflow), signal });

  const draft = answer
    .match(/<promptify-draft>([\s\S]*?)<\/promptify-draft>/)?.[1]
    ?.trim();

  if (!draft) throw new PromptifyDraftMissingError();

  return { request, draft, answer };
}

export async function presentPromptify({
  result,
  surface,
}: PresentPromptifyInput): Promise<void> {
  switch (surface.kind) {
    case "composer": {
      const current = surface.getText();
      surface.setText(current ? `${result.draft}\n\n${current}` : result.draft);

      return;
    }

    case "dialog":
      await surface.edit("Promptify draft", result.draft);

      return;
    case "event":
      surface.emit(result.draft);

      return;
    default: {
      const exhaustive: never = surface;

      return exhaustive;
    }
  }
}
