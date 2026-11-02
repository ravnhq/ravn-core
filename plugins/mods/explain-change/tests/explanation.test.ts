import { expect, test } from "claude-code/testing";

import { parseExplanation, shuffleOptions } from "../lib/explanation.ts";

const A = { text: "A", isCorrect: true, feedback: "why A" };

const B = { text: "B", isCorrect: false, feedback: "why B" };

const C = { text: "C", isCorrect: false, feedback: "why C" };

const QUIZ = [{ question: "Which?", options: [A, B, C] }];

test("shuffling reorders options, each keeping its own feedback", () => {
  const [last] = shuffleOptions(QUIZ, () => 0.99);
  const [first] = shuffleOptions(QUIZ, () => 0);

  expect(last?.options).toEqual([C, B, A]);
  expect(first?.options).toEqual([A, B, C]);
  expect(last?.question).toBe("Which?");
});

test("shuffling leaves the parsed quiz untouched", () => {
  shuffleOptions(QUIZ, () => 0.5);

  expect(QUIZ[0]?.options).toEqual([A, B, C]);
});

// Every control character the pane must drop: C0 and C1, except tab and newline.
const CONTROLS = Array.from({ length: 0x20 }, (_, code) => code)
  .concat(Array.from({ length: 0x21 }, (_, offset) => 0x7f + offset))
  .filter((code) => code !== 0x09 && code !== 0x0a)
  .map((code) => String.fromCharCode(code))
  .join("");

test("text fields drop control characters and keep tabs, newlines, and other unicode", () => {
  const option = { text: "A", isCorrect: true, feedback: "why" };

  const parsed = parseExplanation(
    JSON.stringify({
      title: `é${CONTROLS}\t\n漢`,
      summary: "s",
      background: "b",
      intuition: "i",
      code: "c",
      quiz: [
        {
          question: "Q?",
          options: [option, { text: "B", isCorrect: false, feedback: "no" }],
        },
      ],
    }),
  );

  if (!parsed.isValid) throw new Error(parsed.error);

  expect(parsed.explanation.title).toBe("é\t\n漢");
});
