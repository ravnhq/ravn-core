// Mermaid flowcharts, parsed and drawn as box-and-arrow text that fits a
// given width. Pure strings: the pane calls it on every render, so a resize
// lays the chart out again.

export type Frame = "box" | "round" | "decision";

export type FlowNode = { id: string; label: string; frame: Frame };

export type FlowEdge = { from: string; to: string; label: string };

export type Flowchart = { nodes: FlowNode[]; edges: FlowEdge[] };

const HEADER = /^(?:flowchart|graph)(?:\s+(?:TD|TB|BT|LR|RL))?$/i;

// Lines that style or group a chart without adding nodes or edges.
const IGNORED =
  /^(?:subgraph|end|classDef|class|style|linkStyle|click|direction|%%)\b/;

// Longest opener first, so `((` wins over `(`.
const OPENERS: readonly (readonly [string, string, Frame])[] = [
  ["((", "))", "round"],
  ["([", "])", "round"],
  ["[(", ")]", "round"],
  ["[[", "]]", "box"],
  ["{{", "}}", "decision"],
  ["[", "]", "box"],
  ["(", ")", "round"],
  ["{", "}", "decision"],
];

// An edge between two nodes: `-- label -->`, `-->|label|`, or a bare arrow.
const LABELLED = /^\s*--\s+(.+?)\s+-->/;

const ARROW = /^\s*(?:-->|---|==>|-\.->)(?:\s*\|([^|]*)\|)?/;

const NODE_ID = /^\s*([\w-]+)/;

export function parseFlowchart(source: string): Flowchart | null {
  const statements: string[] = [];
  let quoted = false;
  let start = 0;

  for (let at = 0; at <= source.length; at += 1) {
    if (source[at] === '"') quoted = !quoted;
    if (at === source.length || (!quoted && /[\n;]/.test(source[at] ?? ""))) {
      const statement = source.slice(start, at).trim();

      if (statement !== "") statements.push(statement);
      start = at + 1;
    }
  }

  if (quoted || !HEADER.test(statements[0] ?? "")) return null;

  const nodes = new Map<string, FlowNode>();
  const edges: FlowEdge[] = [];

  for (const statement of statements.slice(1)) {
    if (!IGNORED.test(statement) && !readStatement(statement, nodes, edges))
      return null;
  }

  return nodes.size === 0 ? null : { nodes: [...nodes.values()], edges };
}

// `A[Start] --> B{Ok?} -- yes --> C`: nodes joined by edges, left to right.
function readStatement(
  statement: string,
  nodes: Map<string, FlowNode>,
  edges: FlowEdge[],
): boolean {
  let rest = statement;
  let previous: { id: string; label: string } | undefined;

  for (;;) {
    const read = readNode(rest);

    if (read === undefined) return false;

    remember(nodes, read.node);

    if (previous !== undefined)
      edges.push({
        from: previous.id,
        to: read.node.id,
        label: previous.label,
      });

    rest = read.rest;

    const edge = LABELLED.exec(rest) ?? ARROW.exec(rest);

    if (edge === null) return rest.trim() === "";

    previous = { id: read.node.id, label: cleanLabel(edge[1] ?? "") };
    rest = rest.slice(edge[0].length);
  }
}

function readNode(text: string): { node: FlowNode; rest: string } | undefined {
  const id = NODE_ID.exec(text);

  if (id === null || id[1] === undefined) return undefined;

  const after = text.slice(id[0].length);
  const frame = OPENERS.find(([open]) => after.startsWith(open));

  if (frame === undefined)
    return { node: { id: id[1], label: id[1], frame: "box" }, rest: after };

  const [open, close, kind] = frame;
  let quoted = false;
  let end = open.length;

  for (; end < after.length; end += 1) {
    if (after[end] === '"') quoted = !quoted;
    if (!quoted && after.startsWith(close, end)) break;
  }

  if (quoted || end === after.length) return undefined;

  const label = cleanLabel(after.slice(open.length, end)) || id[1];

  return {
    node: { id: id[1], label, frame: kind },
    rest: after.slice(end + close.length),
  };
}

// A node named again without a label keeps the label it was given first.
function remember(nodes: Map<string, FlowNode>, node: FlowNode): void {
  const known = nodes.get(node.id);

  if (known === undefined || known.label === known.id) nodes.set(node.id, node);
}

function cleanLabel(raw: string): string {
  return raw
    .trim()
    .replace(/^"([\s\S]*)"$/, "$1")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(
      /<\/?[a-z][a-z0-9]*(?:\s+[a-z_:][\w:.-]*(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*\s*\/?>/gi,
      "",
    )
    .replace(/\s+/g, " ")
    .trim();
}

// --- Layout ----------------------------------------------------------------

const GLYPHS: Readonly<Record<Frame, string>> = {
  box: "┌┐└┘─│",
  round: "╭╮╰╯─│",
  decision: "╔╗╚╝═║",
};

// Which ways a connector cell's lines run, as bits, and the glyph for each mix.
const UP = 1;

const DOWN = 2;

const LEFT = 4;

const RIGHT = 8;

const JOINS = new Map<number, string>([
  [UP, "│"],
  [DOWN, "│"],
  [UP | DOWN, "│"],
  [LEFT, "─"],
  [RIGHT, "─"],
  [LEFT | RIGHT, "─"],
  [DOWN | RIGHT, "┌"],
  [DOWN | LEFT, "┐"],
  [UP | RIGHT, "└"],
  [UP | LEFT, "┘"],
  [UP | DOWN | RIGHT, "├"],
  [UP | DOWN | LEFT, "┤"],
  [DOWN | LEFT | RIGHT, "┬"],
  [UP | LEFT | RIGHT, "┴"],
  [UP | DOWN | LEFT | RIGHT, "┼"],
]);

const GAP = 2;

const MAX_LABEL = 22;

const MIN_LABEL = 8;

type Placed = {
  node: FlowNode;
  lines: string[];
  x: number;
  y: number;
  width: number;
  height: number;
  row: number;
};

type Cell = { glyph: string; joins: number };

export function drawFlowchart(chart: Flowchart, width: number): string[] {
  const labelWidth = Math.max(MIN_LABEL, Math.min(MAX_LABEL, width - 4));

  const sized = new Map(
    chart.nodes.map((node) => {
      const lines = wrapLabel(node.label, labelWidth);

      return [node.id, { node, lines, width: widest(lines) + 4 }] as const;
    }),
  );

  const rows = packRows(chart, width, (id) => sized.get(id)?.width ?? 0);
  const placed = new Map<string, Placed>();
  const drawn = new Set<FlowEdge>();
  const buses: { y: number; edges: FlowEdge[] }[] = [];
  let y = 0;

  for (const [index, row] of rows.entries()) {
    const boxes = row.flatMap((node) => sized.get(node.id) ?? []);
    const span = boxes.reduce((sum, box) => sum + box.width + GAP, -GAP);
    let x = Math.max(0, Math.floor((width - span) / 2));

    for (const box of boxes) {
      placed.set(box.node.id, {
        ...box,
        x,
        y,
        height: box.lines.length + 2,
        row: index,
      });
      x += box.width + GAP;
    }

    y += Math.max(...boxes.map((box) => box.lines.length + 2));

    const next = new Set((rows[index + 1] ?? []).map((node) => node.id));
    const here = new Set(row.map((node) => node.id));

    const down = chart.edges.filter(
      (edge) => here.has(edge.from) && next.has(edge.to),
    );

    if (index < rows.length - 1) {
      buses.push({ y, edges: down });
      y += down.length > 0 ? 3 : 1;
    }
  }

  const columns = Math.max(
    width,
    ...[...placed.values()].map((box) => box.x + box.width),
  );

  const grid: Cell[][] = Array.from({ length: y }, () =>
    Array.from({ length: columns }, () => ({ glyph: " ", joins: 0 })),
  );

  for (const box of placed.values()) paintBox(grid, box);

  const crowded = paintEdges(grid, buses, placed, drawn);

  const lines = grid.map((row) =>
    row
      .map((cell) =>
        cell.glyph === " " && cell.joins !== 0
          ? (JOINS.get(cell.joins) ?? " ")
          : cell.glyph,
      )
      .join("")
      .trimEnd(),
  );

  // Edges that skip a row, point back up, or had no room for their label.
  for (const edge of chart.edges) {
    if (drawn.has(edge) && !crowded.has(edge)) continue;

    const from = placed.get(edge.from);
    const to = placed.get(edge.to);
    const isBack = from !== undefined && to !== undefined && to.row <= from.row;
    const note = edge.label === "" ? "" : `  (${edge.label})`;

    lines.push(
      clip(
        `  ${isBack ? "↺" : "⇢"} ${labelOf(from)} → ${labelOf(to)}${note}`,
        width,
      ),
    );
  }

  return lines;
}

// Each node one layer below its deepest parent, ignoring edges that close a
// cycle; a layer too wide for `width` continues on the next row.
function packRows(
  chart: Flowchart,
  width: number,
  widthOf: (id: string) => number,
): FlowNode[][] {
  const layer = layers(chart);
  const depth = Math.max(0, ...layer.values());
  const order = new Map<string, number>();
  const rows: FlowNode[][] = [];

  for (let level = 0; level <= depth; level += 1) {
    const members = chart.nodes.filter((node) => layer.get(node.id) === level);

    const centre = (node: FlowNode) => {
      const parents = chart.edges.flatMap((edge) =>
        edge.to === node.id ? (order.get(edge.from) ?? []) : [],
      );

      return parents.length === 0
        ? chart.nodes.indexOf(node)
        : parents.reduce((sum, at) => sum + at, 0) / parents.length;
    };

    members.sort((a, b) => centre(a) - centre(b));

    for (const [at, node] of members.entries()) order.set(node.id, at);

    let row: FlowNode[] = [];
    let used = 0;

    for (const node of members) {
      const needed = widthOf(node.id) + (row.length > 0 ? GAP : 0);

      if (row.length > 0 && used + needed > width) {
        rows.push(row);
        row = [];
        used = 0;
      }

      used += widthOf(node.id) + (row.length > 0 ? GAP : 0);
      row.push(node);
    }

    if (row.length > 0) rows.push(row);
  }

  return rows;
}

function layers(chart: Flowchart): Map<string, number> {
  const state = new Map<string, "open" | "done">();
  const forward: FlowEdge[] = [];

  const visit = (id: string) => {
    state.set(id, "open");

    for (const edge of chart.edges) {
      if (edge.from !== id || state.get(edge.to) === "open") continue;

      forward.push(edge);

      if (!state.has(edge.to)) visit(edge.to);
    }

    state.set(id, "done");
  };

  for (const node of chart.nodes) if (!state.has(node.id)) visit(node.id);

  const layer = new Map(chart.nodes.map((node) => [node.id, 0]));

  for (let pass = 0; pass < chart.nodes.length; pass += 1) {
    let moved = false;

    for (const edge of forward) {
      const below = (layer.get(edge.from) ?? 0) + 1;

      if ((layer.get(edge.to) ?? 0) < below) {
        layer.set(edge.to, below);
        moved = true;
      }
    }

    if (!moved) break;
  }

  return layer;
}

function paintBox(grid: Cell[][], box: Placed): void {
  const [tl, tr, bl, br, h, v] = [...GLYPHS[box.node.frame]];
  const bottom = box.y + box.height - 1;
  const right = box.x + box.width - 1;

  put(grid, box.y, box.x, tl);
  put(grid, box.y, right, tr);
  put(grid, bottom, box.x, bl);
  put(grid, bottom, right, br);

  for (let x = box.x + 1; x < right; x += 1) {
    put(grid, box.y, x, h);
    put(grid, bottom, x, h);
  }

  for (const [index, line] of box.lines.entries()) {
    const y = box.y + 1 + index;

    put(grid, y, box.x, v);
    put(grid, y, right, v);

    for (const [at, glyph] of [...line].entries())
      put(grid, y, box.x + 2 + at, glyph);
  }
}

// Each edge leaves its box's bottom, runs along the bus row under that row of
// boxes, and drops into its target. Returns the edges whose label had no room.
function paintEdges(
  grid: Cell[][],
  buses: readonly { y: number; edges: FlowEdge[] }[],
  placed: ReadonlyMap<string, Placed>,
  drawn: Set<FlowEdge>,
): Set<FlowEdge> {
  const labels: { edge: FlowEdge; y: number; x: number }[] = [];

  for (const bus of buses) {
    const routes = bus.edges.flatMap((edge) => {
      const from = placed.get(edge.from);
      const to = placed.get(edge.to);

      if (from === undefined || to === undefined) return [];

      const start = centreOf(from);
      const fromAbove = start > to.x + 1 && start < to.x + to.width - 2;
      const end = fromAbove ? start : centreOf(to);

      return [{ edge, from, start, end }];
    });
    const groups: (typeof routes)[] = [];

    for (const route of routes.sort(
      (a, b) => Math.min(a.start, a.end) - Math.min(b.start, b.end),
    )) {
      const group = groups.at(-1);

      if (
        group !== undefined &&
        group.some(
          (other) =>
            Math.max(other.start, other.end) >= Math.min(route.start, route.end),
        )
      )
        group.push(route);
      else groups.push([route]);
    }

    for (const group of groups) {
      const ambiguous = group.some((source) =>
        group.some(
          (target) =>
            !group.some(
              ({ edge }) =>
                edge.from === source.edge.from && edge.to === target.edge.to,
            ),
        ),
      );

      if (ambiguous) continue;

      for (const { edge, from, start, end } of group) {
        drawn.add(edge);
        for (let y = from.y + from.height; y <= bus.y; y += 1)
          join(grid, y, start, UP | DOWN);

        join(grid, bus.y + 1, start, UP);

        for (let x = Math.min(start, end); x < Math.max(start, end); x += 1) {
          join(grid, bus.y + 1, x, RIGHT);
          join(grid, bus.y + 1, x + 1, LEFT);
        }

        join(grid, bus.y + 1, end, DOWN);
        put(grid, bus.y + 2, end, "▼");

        if (edge.label !== "") labels.push({ edge, y: bus.y + 2, x: end + 2 });
      }
    }
  }

  // Labels go down once every arrow is drawn, so none covers another.
  const crowded = new Set<FlowEdge>();

  for (const { edge, y, x } of labels) {
    const text = clip(edge.label, 20);
    const cells = [...text].map((_, at) => grid[y]?.[x + at]);

    const isFree = cells.every(
      (cell) => cell !== undefined && cell.glyph === " " && cell.joins === 0,
    );

    if (!isFree) {
      crowded.add(edge);
      continue;
    }

    for (const [at, glyph] of [...text].entries()) put(grid, y, x + at, glyph);
  }

  return crowded;
}

function put(grid: Cell[][], y: number, x: number, glyph: string | undefined) {
  const cell = grid[y]?.[x];

  if (cell !== undefined && glyph !== undefined) cell.glyph = glyph;
}

function join(grid: Cell[][], y: number, x: number, joins: number) {
  const cell = grid[y]?.[x];

  if (cell !== undefined) cell.joins |= joins;
}

function centreOf(box: Placed): number {
  return box.x + Math.floor(box.width / 2);
}

function labelOf(box: Placed | undefined): string {
  return clip(box?.node.label ?? "?", 18);
}

// Word-wrap into at most three lines of `width` columns.
function wrapLabel(label: string, width: number): string[] {
  const lines: string[] = [];
  let line = "";

  for (const word of label.split(" ")) {
    const piece = clip(word, width);

    if (line === "") line = piece;
    else if (line.length + 1 + piece.length <= width) line += ` ${piece}`;
    else {
      lines.push(line);
      line = piece;
    }
  }

  if (line !== "") lines.push(line);

  if (lines.length > 3)
    return [...lines.slice(0, 2), clip(`${lines[2]} …`, width)];

  return lines.length === 0 ? ["?"] : lines;
}

function widest(lines: readonly string[]): number {
  return Math.max(...lines.map((line) => line.length));
}

function clip(text: string, width: number): string {
  return text.length <= width
    ? text
    : `${text.slice(0, Math.max(1, width - 1))}…`;
}
