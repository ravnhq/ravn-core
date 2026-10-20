import { atom, read, update } from "claude-code";
import type { EngineInterface, Register } from "claude-code";

import {
  INPUT_SCHEMA,
  PROSE,
  SECTIONS,
  parseExplanation,
  score,
} from "../lib/explanation.ts";
import { DIAGRAM_LANGUAGES, segments } from "../lib/markdown.ts";
import { drawFlowchart, parseFlowchart } from "../lib/flowchart.ts";
import type { Segment } from "../lib/markdown.ts";
import type { Question, QuizOption } from "../types";

const PANE = "explain-change";

const TOOL = "show";

const COMMAND = "explain-change-pane";

const TITLE = "Explain change";

const view = atom({ plugin: "explain-change", key: "view" } as const, null);

type Elements = ReturnType<EngineInterface["ui"]["resolve"]>;

function openPane($: EngineInterface) {
  return $.ui.open({ id: PANE, title: TITLE, focus: true });
}

// A section opens at its top, wherever the person had scrolled the last one.
// The scroll is cosmetic: where no surface holds the pane, the switch still lands.
async function showSection($: EngineInterface, section: number) {
  await update($, view, (now) => now && { ...now, section });
  await $.ui.scroll({ to: "start", in: PANE }).catch(() => undefined);
}

export const register: Register = (on) => {
  on("session.start", async ($, e, next) => {
    await Promise.all([
      $.tool.register({
        name: TOOL,
        description:
          "Show an explanation of a code change in the explain-change pane: background, intuition, a code walkthrough (markdown, text diagrams in fences), and a multiple-choice quiz.",
        inputSchema: INPUT_SCHEMA,
      }),
      $.command.register({
        name: COMMAND,
        description: "Reopen the explain-change pane",
      }),
    ]);

    return next(e);
  });

  on("tool.call", { tool: "mcp__explain-change__show" }, async ($, e) => {
    // The tool's arguments arrive spread beside `tool` and `tool_use_id`.
    const parsed = parseExplanation(JSON.stringify(e));

    if (!parsed.isValid) return { deny: `Not shown: ${parsed.error}.` };

    const { explanation } = parsed;
    await update($, view, () => ({
      explanation,
      section: 0,
      answers: explanation.quiz.map(() => null),
    }));

    // Where the pane sits is the render's to say; the result says only whether it shows.
    const { isPlaced } = await openPane($);

    return {
      result: isPlaced
        ? `Shown in the explain-change pane. /${COMMAND} reopens it.`
        : `Saved; the pane opens once the terminal has room, or with /${COMMAND}.`,
    };
  }).catch(() => ({ deny: "Not shown: the explain-change pane failed." }));

  on("command.run", { command: COMMAND }, async ($) => {
    if ((await read($, view)) === null)
      return { text: "No explanation yet. Ask Claude to explain a change." };

    await openPane($);

    return { text: "Explain-change pane opened." };
  }).catch(() => ({ text: "The explain-change pane failed to open." }));

  on("ui.render", { component: "Pane", requestId: PANE }, async ($, e) => {
    const ui = $.ui.resolve(e);
    const { Box, Text, Button } = ui;
    const shown = await read($, view);

    if (shown === null)
      return (
        <Text dimColor>
          No explanation yet. Ask Claude to explain a change.
        </Text>
      );

    const { explanation, section, answers } = shown;
    const field = PROSE[section];

    return (
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="column">
          <Text bold color="claude">
            {explanation.title}
          </Text>
          <Text dimColor>{explanation.summary}</Text>
          {e.props.placement === "inline" && (
            <Text dimColor>Run /tui fullscreen to show this as a sidebar.</Text>
          )}
        </Box>
        <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
          {SECTIONS.map((name, index) => (
            <Button
              key={`section-${index}`}
              label={name}
              hotkey={String(index + 1)}
              variant={index === section ? "primary" : "secondary"}
              onPress={() => showSection($, index)}
            />
          ))}
        </Box>
        {field === undefined
          ? quizView(ui, explanation.quiz, answers, (q, o) =>
              update(
                $,
                view,
                (now) =>
                  now && {
                    ...now,
                    answers: now.answers.map((one, at) => (at === q ? o : one)),
                  },
              ),
            )
          : sectionView(ui, explanation[field], e.props.bodyColumns)}
      </Box>
    );
  });
};

// Prose draws as markdown; source fences are highlighted, diff sketches
// coloured line by line, mermaid flowcharts laid out to the pane's width, and
// text diagrams drawn in an accent. A resize redraws, so flowcharts refit.
function sectionView(ui: Elements, text: string, width: number) {
  const { Box } = ui;

  return (
    <Box flexDirection="column" gap={1}>
      {segments(text).map((segment, index) =>
        segmentView(ui, segment, index, width),
      )}
    </Box>
  );
}

function segmentView(
  { Box, Text, Markdown, Code }: Elements,
  segment: Segment,
  index: number,
  width: number,
) {
  if (segment.kind === "prose")
    return <Markdown key={`prose-${index}`} text={segment.text} />;

  if (segment.language === "diff")
    return (
      <Box key={`diff-${index}`} flexDirection="column">
        {segment.source.split("\n").map((line, at) => (
          <Text key={`diff-${index}-${at}`} color={diffColor(line)}>
            {line === "" ? " " : line}
          </Text>
        ))}
      </Box>
    );

  const graph =
    segment.language === "mermaid" ? parseFlowchart(segment.source) : null;

  if (graph !== null)
    return (
      <Text key={`flow-${index}`} color="suggestion">
        {drawFlowchart(graph, width).join("\n")}
      </Text>
    );

  // A hand-drawn diagram keeps its layout: a narrow pane cuts it, never rewraps it.
  if (DIAGRAM_LANGUAGES.has(segment.language))
    return (
      <Text key={`diagram-${index}`} color="suggestion" wrap="truncate-end">
        {segment.source}
      </Text>
    );

  return (
    <Code
      key={`code-${index}`}
      source={segment.source}
      language={segment.language}
    />
  );
}

function diffColor(line: string): string | undefined {
  if (line.startsWith("+")) return "success";

  if (line.startsWith("-")) return "error";

  return undefined;
}

function quizView(
  { Box, Text, Button, Markdown }: Elements,
  quiz: readonly Question[],
  picked: readonly (number | null)[],
  onPick: (question: number, option: number) => void,
) {
  const answered = picked.filter((one) => one !== null).length;

  return (
    <Box flexDirection="column" gap={1}>
      {answered === quiz.length ? (
        <Text bold color="success">
          {`${score(quiz, picked)} of ${quiz.length} correct.`}
        </Text>
      ) : (
        <Text dimColor>
          {`${answered} of ${quiz.length} answered. Pick an option to see why it's right or wrong.`}
        </Text>
      )}
      {quiz.map((question, q) => {
        const choice = picked[q] ?? null;
        const chosen = choice === null ? undefined : question.options[choice];

        return (
          <Box key={`question-${q}`} flexDirection="column">
            <Text bold>
              <Text color="claude">{q + 1}.</Text> {question.question}
            </Text>
            {question.options.map((option, o) => {
              if (chosen === undefined)
                return (
                  <Button
                    key={`answer-${q}-${o}`}
                    plain
                    label={`${letter(o)}) ${option.text}`}
                    onPress={() => onPick(q, o)}
                  />
                );

              const { glyph, color } = badge(option, o === choice);

              return (
                <Text
                  key={`answer-${q}-${o}`}
                  dimColor={color === undefined}
                  color={color}
                >
                  {`${glyph} ${letter(o)}) ${option.text}`}
                </Text>
              );
            })}
            {chosen && (
              <Box flexDirection="column">
                <Text bold color={chosen.isCorrect ? "success" : "error"}>
                  {chosen.isCorrect ? "Correct" : "Not quite"}
                </Text>
                <Markdown text={chosen.feedback} />
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
}

function letter(index: number): string {
  return String.fromCharCode(97 + index);
}

// How an answered question marks one option: the right one, the wrong pick, or neither.
function badge(option: QuizOption, isPicked: boolean) {
  if (option.isCorrect) return { glyph: "✓", color: "success" };

  return isPicked
    ? { glyph: "✗", color: "error" }
    : { glyph: " ", color: undefined };
}
