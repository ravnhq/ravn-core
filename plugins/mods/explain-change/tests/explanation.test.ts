import { expect, test } from "claude-code/testing";

import { shuffleOptions } from "../lib/explanation.ts";

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
