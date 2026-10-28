// A reply is markdown in which `{{short|long}}` marks a stretch: the reader
// sees `short`, and opening it puts `long` in its place. `long` may hold
// further stretches. Code spans and fences are copied as written, so braces in
// code never open a stretch; inside a long form, a fence's closing line may
// carry the `}}` that closes the stretches around the block.

export type Segment = string | Stretch;

export type Stretch = {
  /**
   * Names the stretch by its trimmed short form, each line break in it written ↵, and
   * its parents' (`cache › key`), so a stretch added elsewhere in the reply leaves
   * every other key as it was. A short form repeated among siblings takes `~2`, `~3`.
   */
  key: string;
  short: string;
  /** Undefined when no `|` was written: then there is nothing to open, and `short` is plain text. */
  long: Segment[] | undefined;
  /** False while the reply streams and the closing braces have not arrived. */
  isClosed: boolean;
};

type Frame = { stretch: Stretch; siblings: Map<string, number> };

export const KEY_SEPARATOR = " › ";

export function isOpenable(stretch: Stretch): boolean {
  return stretch.isClosed && stretch.long !== undefined;
}

/** Whether a stretch is drawn as a link: openable, with its short form on one line, as a link cannot span lines. */
export function isLinkable(stretch: Stretch): boolean {
  return isOpenable(stretch) && !stretch.short.includes("\n");
}

/**
 * How the terminal draws a stretch: as plain text when there is nothing to open, already open when
 * its short form spans lines, otherwise as a link.
 */
export function drawnAs(stretch: Stretch): "text" | "open" | "link" {
  if (!isOpenable(stretch)) return "text";
  return isLinkable(stretch) ? "link" : "open";
}

/**
 * An open stretch's long form followed by its `closer`, after a space, or after `gap` when the long
 * form ends in a line text after it would change: a rule, which then reads as plain dashes, or a code
 * fence, which then no longer closes.
 */
export function closeAfter(long: string, closer: string, gap: string): string {
  const trimmed = long.trimEnd();
  const last = trimmed.slice(trimmed.lastIndexOf("\n") + 1);
  const fence = openingFence(last);
  const endsInBlock =
    isRule(last) || (fence !== undefined && closesFence(last, fence));

  return endsInBlock ? `${trimmed}${gap}${closer}` : `${long} ${closer}`;
}

/** Whether `line` is a rule: three or more of one of `-`, `*` and `_`, spaces between allowed. */
export function isRule(line: string): boolean {
  return /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/.test(line);
}

/** The key of the stretch holding the one keyed `key`, or '' when no stretch holds it. */
export function parentOf(key: string): string {
  return key.split(KEY_SEPARATOR).slice(0, -1).join(KEY_SEPARATOR);
}

/**
 * The code span at `i`: where it stops, past the next run of as many backticks or at the text's end,
 * and its backticks when it is still open there. `open` carries the backticks of a span opened on an
 * earlier line, whose close is then looked for from `i` on.
 */
export function codeSpan(
  text: string,
  i: number,
  open?: string,
): { stop: number; open: string | undefined } {
  const run = open ?? /^`+/.exec(text.slice(i))?.[0] ?? "`";
  const end = text.indexOf(run, open === undefined ? i + run.length : i);
  return end === -1
    ? { stop: text.length, open: run }
    : { stop: end + run.length, open: undefined };
}

export function parse(text: string): Segment[] {
  const root: Segment[] = [];
  const stack: Frame[] = [];
  const rootSiblings = new Map<string, number>();

  const write = (chunk: string) => {
    const frame = stack.at(-1);
    if (frame && frame.stretch.long === undefined) {
      frame.stretch.short += chunk;
      return;
    }
    const segments = frame?.stretch.long ?? root;
    const last = segments.at(-1);
    if (typeof last === "string") segments[segments.length - 1] = last + chunk;
    else segments.push(chunk);
  };

  let i = 0;
  while (i < text.length) {
    const frame = stack.at(-1);
    const isInShort = frame !== undefined && frame.stretch.long === undefined;
    const isInLong = frame !== undefined && !isInShort;

    const fenceStop =
      i === 0 || text[i - 1] === "\n" ? fenceEnd(text, i, isInLong) : undefined;
    if (fenceStop !== undefined) {
      write(text.slice(i, fenceStop));
      i = fenceStop;
      continue;
    }

    if (text[i] === "`") {
      const { stop } = codeSpan(text, i);
      write(text.slice(i, stop));
      i = stop;
      continue;
    }

    if (text.startsWith("{{", i) && !isInShort) {
      const stretch: Stretch = {
        key: "",
        short: "",
        long: undefined,
        isClosed: false,
      };
      (frame?.stretch.long ?? root).push(stretch);
      stack.push({ stretch, siblings: new Map() });
      i += 2;
      continue;
    }

    if (isInShort && text[i] === "|") {
      frame.stretch.key = keyOf(
        frame.stretch.short,
        stack.at(-2),
        rootSiblings,
      );
      frame.stretch.long = [];
      i += 1;
      continue;
    }

    if (frame && text.startsWith("}}", i)) {
      frame.stretch.isClosed = true;
      stack.pop();
      i += 2;
      continue;
    }

    write(text[i] ?? "");
    i += 1;
  }

  return root;
}

function keyOf(
  short: string,
  parent: Frame | undefined,
  rootSiblings: Map<string, number>,
): string {
  // A line break in a key would split the link's markup across rows in `layout`; ↵ keeps the key apart
  // from the same words on one line, which a space would not.
  const name = short.trim().replaceAll("\n", "↵");
  const siblings = parent?.siblings ?? rootSiblings;
  const seen = (siblings.get(name) ?? 0) + 1;
  siblings.set(name, seen);
  const own = seen === 1 ? name : `${name}~${seen}`;

  return parent ? `${parent.stretch.key}${KEY_SEPARATOR}${own}` : own;
}

/**
 * Where a fenced code block opening at `start` ends (past its closing line, or where the braces after
 * its closing fence begin, inside a long form), or undefined when no fence opens there.
 */
function fenceEnd(
  text: string,
  start: number,
  isInLong: boolean,
): number | undefined {
  const lineEnd = (from: number) => {
    const end = text.indexOf("\n", from);
    return end === -1 ? text.length : end;
  };
  const opening = openingFence(text.slice(start, lineEnd(start)));
  if (opening === undefined) return undefined;

  for (let at = lineEnd(start) + 1; at < text.length; at = lineEnd(at) + 1) {
    const line = text.slice(at, lineEnd(at));
    const close = fenceCloseOn(line, opening, isInLong);
    if (close === line.length) return Math.min(lineEnd(at) + 1, text.length);
    if (close !== undefined) return at + close;
  }

  return text.length;
}

/** The marker `line` opens a code fence with, such as ``` or ~~~, or undefined when it opens none. */
export function openingFence(line: string): string | undefined {
  return /^[ \t]*(`{3,}|~{3,})/.exec(line)?.[1];
}

/** Whether `line` closes the code fence `fence` opened: trimmed, it is only the fence's character, repeated at least as often. */
export function closesFence(line: string, fence: string): boolean {
  const trimmed = line.trim();
  return (
    trimmed.startsWith(fence) &&
    trimmed === fence.charAt(0).repeat(trimmed.length)
  );
}

/**
 * Where the code fence `fence` opened closes on `line`: at the line's end when the line is only the
 * fence. Inside a long form (`isInLong`) a closing fence followed by nothing but `}}`, once or more,
 * spaces between allowed, also closes it, where the braces begin, so they close the stretches around
 * the block. Undefined when the line does not close it.
 */
function fenceCloseOn(
  line: string,
  fence: string,
  isInLong: boolean,
): number | undefined {
  if (closesFence(line, fence)) return line.length;
  if (!isInLong) return undefined;
  const braces = line.indexOf("}}");
  if (braces === -1 || !/^(?:\}\}[ \t]*)+$/.test(line.slice(braces)))
    return undefined;
  return closesFence(line.slice(0, braces), fence) ? braces : undefined;
}

/** Every stretch, outermost first, in the order the reply writes them. */
export function stretches(segments: Segment[]): Stretch[] {
  return segments.flatMap((segment) =>
    typeof segment === "string"
      ? []
      : [segment, ...stretches(segment.long ?? [])],
  );
}

/**
 * Where a streaming filter stands between flushes: open stretches, an open code fence, and the
 * backticks of a code span still open, since `parse` lets a span run over line breaks.
 */
export type StreamState = {
  open: { isLong: boolean }[];
  fence: string | undefined;
  span: string | undefined;
};

/** A streaming filter's state before a reply's first flush. */
export const newStreamState = (): StreamState => ({
  open: [],
  fence: undefined,
  span: undefined,
});

/**
 * A streaming reply's newly finished lines with each stretch shown as its short form, as the
 * finished reply will first show it. `state` carries open stretches, fences and code spans from one
 * flush to the next. A line that held only long-form text is left out, so the stream does not grow
 * blank lines where hidden depth goes.
 */
export function hideLongForms(lines: string, state: StreamState): string {
  return lines
    .split("\n")
    .flatMap((line) => {
      const fence =
        state.fence === undefined && state.span === undefined
          ? openingFence(line)
          : undefined;
      // Past a closing fence followed by braces, the braces are read as outside the block.
      let start = 0;
      if (state.fence !== undefined || fence !== undefined) {
        const isShown =
          state.open.length === 0 ||
          (state.open.length === 1 && state.open[0]?.isLong === false);
        const close =
          state.fence === undefined
            ? undefined
            : fenceCloseOn(
                line,
                state.fence,
                state.open.at(-1)?.isLong === true,
              );
        if (state.fence === undefined) state.fence = fence;
        else if (close !== undefined) state.fence = undefined;
        if (close === undefined || close === line.length)
          return isShown ? [line] : [];
        start = close;
      }
      let out = "";
      for (let i = start; i < line.length; i++) {
        const top = state.open.at(-1);
        const isShown =
          state.open.length === 0 ||
          (state.open.length === 1 && top?.isLong === false);
        if (state.span !== undefined || line[i] === "`") {
          const span = codeSpan(line, i, state.span);
          state.span = span.open;
          if (isShown) out += line.slice(i, span.stop);
          i = span.stop - 1;
        } else if (line.startsWith("{{", i) && top?.isLong !== false) {
          state.open.push({ isLong: false });
          i++;
        } else if (top?.isLong === false && line[i] === "|") {
          top.isLong = true;
        } else if (top !== undefined && line.startsWith("}}", i)) {
          state.open.pop();
          i++;
        } else if (isShown) {
          out += line[i];
        }
      }
      return out.trim() === "" && line.trim() !== "" ? [] : [out];
    })
    .join("\n");
}

/** A run of the reply between blank lines, and whether it holds a stretch. */
export type Paragraph = { text: string; hasStretch: boolean };

/**
 * The reply cut at the blank lines that stand outside every stretch, code fence and code span, so a
 * paragraph holding a stretch can be drawn apart from the rest. Neighbouring paragraphs without one
 * are kept together.
 */
export function paragraphsOf(text: string): Paragraph[] {
  const pieces: string[] = [];
  let current: string[] = [];
  let depth = 0;
  let span: string | undefined;
  let fence: string | undefined;
  for (const line of text.split("\n")) {
    if (fence !== undefined) {
      const close = fenceCloseOn(line, fence, depth > 0);
      if (close !== undefined) {
        fence = undefined;
        ({ depth, span } = depthAfter(line.slice(close), depth, span));
      }
      current.push(line);
      continue;
    }
    const marker = span === undefined ? openingFence(line) : undefined;
    if (marker !== undefined) {
      fence = marker;
      current.push(line);
      continue;
    }
    if (line.trim() === "" && depth === 0 && span === undefined) {
      if (current.length > 0) pieces.push(current.join("\n"));
      current = [];
      continue;
    }
    ({ depth, span } = depthAfter(line, depth, span));
    current.push(line);
  }
  if (current.length > 0) pieces.push(current.join("\n"));

  const paragraphs: Paragraph[] = [];
  for (const piece of pieces) {
    const hasStretch = stretches(parse(piece)).length > 0;
    const last = paragraphs.at(-1);
    if (!hasStretch && last !== undefined && !last.hasStretch)
      last.text += `\n\n${piece}`;
    else paragraphs.push({ text: piece, hasStretch });
  }

  return paragraphs;
}

/**
 * How many stretches stand open after `line`, and the backticks of a code span still open, given
 * `depth` and `span` as they stood before it. Braces in a code span are skipped.
 */
function depthAfter(
  line: string,
  depth: number,
  span: string | undefined,
): { depth: number; span: string | undefined } {
  let open = depth;
  let code = span;
  for (let i = 0; i < line.length; i++) {
    if (code !== undefined || line[i] === "`") {
      const at = codeSpan(line, i, code);
      code = at.open;
      i = at.stop - 1;
    } else if (line.startsWith("{{", i)) {
      open += 1;
      i += 1;
    } else if (open > 0 && line.startsWith("}}", i)) {
      open -= 1;
      i += 1;
    }
  }

  return { depth: open, span: code };
}
