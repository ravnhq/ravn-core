import type { Explanation, Question, QuizOption } from "../types";

// The markdown sections, in tab order; the quiz is the tab after them.
export const PROSE = ["background", "intuition", "code"] as const;

export const SECTIONS = ["Background", "Intuition", "Code", "Quiz"] as const;

const TEXT_FIELDS = ["title", "summary", ...PROSE] as const;

const MAX_QUESTIONS = 10;

const MIN_OPTIONS = 2;

const MAX_OPTIONS = 6;

// The input schema the model reads. `parseExplanation` enforces it.
export const INPUT_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string", description: "What changed, in a few words." },
    summary: {
      type: "string",
      description: "One sentence: what the change does and why.",
    },
    background: { type: "string", description: "Markdown." },
    intuition: { type: "string", description: "Markdown." },
    code: { type: "string", description: "Markdown." },
    quiz: {
      type: "array",
      minItems: 1,
      maxItems: MAX_QUESTIONS,
      items: {
        type: "object",
        properties: {
          question: { type: "string" },
          options: {
            type: "array",
            minItems: MIN_OPTIONS,
            maxItems: MAX_OPTIONS,
            items: {
              type: "object",
              properties: {
                text: { type: "string" },
                isCorrect: { type: "boolean" },
                feedback: {
                  type: "string",
                  description: "Why this option is right or wrong.",
                },
              },
              required: ["text", "isCorrect", "feedback"],
            },
          },
        },
        required: ["question", "options"],
      },
    },
  },
  required: [...TEXT_FIELDS, "quiz"],
};

type Parsed =
  | { isValid: true; explanation: Explanation }
  | { isValid: false; error: string };

type Json = null | boolean | number | string | Json[] | JsonObject;

type JsonObject = { [key: string]: Json };

// Checks a show call's input, as JSON, against INPUT_SCHEMA, naming the first field that fails.
export function parseExplanation(source: string): Parsed {
  let input: Json;

  try {
    input = JSON.parse(source);
  } catch {
    return invalid("input must be JSON");
  }

  if (!isJsonObject(input)) return invalid("input must be an object");

  const missing = TEXT_FIELDS.find((field) => text(input[field]) === undefined);

  if (missing !== undefined)
    return invalid(`${missing} must be a non-empty string`);

  // Every text field passed the check above, so the fallback never applies.
  const field = (name: (typeof TEXT_FIELDS)[number]) => text(input[name]) ?? "";

  const { quiz } = input;

  if (!Array.isArray(quiz) || quiz.length === 0 || quiz.length > MAX_QUESTIONS)
    return invalid(`quiz must hold 1 to ${MAX_QUESTIONS} questions`);

  const questions: Question[] = [];

  for (const [index, entry] of quiz.entries()) {
    const question = parseQuestion(entry);

    if (question === undefined)
      return invalid(
        `quiz[${index}] needs a question and ${MIN_OPTIONS} to ${MAX_OPTIONS} options, each with text, isCorrect, and feedback, exactly one of them correct`,
      );

    questions.push(question);
  }

  return {
    isValid: true,
    explanation: {
      title: field("title").trim(),
      summary: field("summary").trim(),
      background: field("background"),
      intuition: field("intuition"),
      code: field("code"),
      quiz: questions,
    },
  };
}

function parseQuestion(entry: Json): Question | undefined {
  if (!isJsonObject(entry)) return undefined;

  const question = text(entry.question);
  const { options } = entry;

  if (
    question === undefined ||
    !Array.isArray(options) ||
    options.length < MIN_OPTIONS ||
    options.length > MAX_OPTIONS
  )
    return undefined;

  const parsed: QuizOption[] = [];
  let correct = 0;

  for (const option of options) {
    if (!isJsonObject(option)) return undefined;

    const label = text(option.text);
    const feedback = text(option.feedback);
    const { isCorrect } = option;

    if (
      label === undefined ||
      feedback === undefined ||
      (isCorrect !== true && isCorrect !== false)
    )
      return undefined;

    if (isCorrect) correct += 1;

    parsed.push({ text: label, isCorrect, feedback });
  }

  return correct === 1 ? { question, options: parsed } : undefined;
}

export function score(
  quiz: readonly Question[],
  answers: readonly (number | null)[],
): number {
  return quiz.filter((question, index) => {
    const picked = answers[index];

    return picked != null && question.options[picked]?.isCorrect === true;
  }).length;
}

function invalid(error: string): Parsed {
  return { isValid: false, error };
}

function isJsonObject(value: Json | undefined): value is JsonObject {
  return value === Object(value) && !Array.isArray(value);
}

function isString(value: Json | undefined): value is string {
  return value === String(value);
}

// The value as a string when it is one with something besides whitespace.
function text(value: Json | undefined): string | undefined {
  return isString(value) && value.trim() !== "" ? value : undefined;
}
