export type QuizOption = { text: string; isCorrect: boolean; feedback: string };

export type Question = { question: string; options: QuizOption[] };

export type Explanation = {
  title: string;
  summary: string;
  background: string;
  intuition: string;
  code: string;
  quiz: Question[];
};

// What the pane draws: the explanation, the section on screen, and the option
// picked for each question (null while unanswered), written together.
export type View = {
  explanation: Explanation;
  section: number;
  answers: (number | null)[];
};

declare module "claude-code" {
  interface PluginState {
    "explain-change": { view: View | null };
  }
}
