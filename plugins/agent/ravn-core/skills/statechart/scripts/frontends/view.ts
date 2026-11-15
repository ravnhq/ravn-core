import {
  type CheckedView,
  checked,
  defaultState,
  type Hidden,
  isText,
  list,
  type Place,
  stateText,
  type Value,
  type Vars,
  isAtom,
} from "../ir.ts";

export type Json = boolean | number | string | Json[] | { [key: string]: Json };

/** The variables of one model state, as the view sees them. */
export type JsonVars = { [name: string]: Json };

const projected = new WeakMap<object, Json>();

export const json = (v: Value): Json => {
  if (isAtom(v)) return v;

  if (v.kind === "model") return v.name;
  let j = projected.get(v);

  if (j === undefined) {
    if (v.kind === "interval") {
      const members: Json[] = [];

      for (let k = v.lo; k <= v.hi; k++) members.push(k);
      j = members;
    } else if (v.kind === "set") {
      const members: Json[] = [];

      for (const m of v.members) members.push(json(m));
      j = members;
    } else {
      const fields: [string, Json][] = [];

      for (let i = 0; i < v.keys.length; i++) {
        const k = json(v.keys[i]);
        fields.push([
          Object(k) === k ? JSON.stringify(k) : String(k),
          json(v.values[i]),
        ]);
      }

      j = Object.fromEntries(fields);
    }

    projected.set(v, j);
  }

  return j;
};

const projectedVars = new WeakMap<Vars, JsonVars>();

const jsonVars = (vars: Vars) => {
  let j = projectedVars.get(vars);

  if (j === undefined) {
    const fields: [string, Json][] = [];

    for (const [name, v] of Object.entries(vars)) fields.push([name, json(v)]);
    j = Object.fromEntries(fields);
    projectedVars.set(vars, j);
  }

  return j;
};

const THEME_COLORS = [
  "blue",
  "orange",
  "purple",
  "yellow",
  "teal",
  "tan",
  "pink",
];

/**
 * What a view's function returns, and each value a view module exports. The
 * view is the user's code, so these types say what the command accepts, not
 * what it gets: every guard below also holds for symbols, bigints, and
 * functions, and placeOf, stepLabel, and checkView reject what fails them.
 */
type Answer = Json | null | undefined;

type StateFunction = (vars: JsonVars) => Answer;

type StepFunction = (action: string, from: JsonVars, to: JsonVars) => Answer;

export type ViewModule = {
  state?: StateFunction | Answer;
  step?: StepFunction | Answer;
  group?: StateFunction | Answer;
  colors?: Answer;
  title?: Answer;
};

type Exported = Answer | StateFunction | StepFunction;

type JsonObject = { [key: string]: Json };

const isPlainObject = (v: Exported): v is JsonObject => {
  if (
    v === null ||
    v === undefined ||
    Object(v) !== v ||
    v instanceof Function ||
    Array.isArray(v)
  )
    return false;
  const proto = Object.getPrototypeOf(v);

  return proto === Object.prototype || proto === null;
};

const isString = (v: Exported): v is string =>
  v !== null && v !== undefined && Object(v) !== v && isText(v);

const isLabel = (l: Answer): l is string =>
  isString(l) && l !== "" && !/\bundefined\b|\bNaN\b|\[object Object\]/.test(l);

const placeOf = (returned: Answer, vars: Vars): Place => {
  function fail(): never {
    throw new Error(
      "The view's state() returned " +
        (JSON.stringify(returned) ?? "undefined") +
        " for the state " +
        stateText(vars) +
        ". Return a string, an array of strings, or an object of those.",
    );
  }

  const path = (p: Answer) => {
    const labels: string[] = [];

    for (const l of Array.isArray(p) ? p : [p]) {
      if (!isLabel(l)) fail();
      labels.push(l);
    }

    if (!labels.length) fail();

    return labels;
  };

  const regions: [string, Answer][] = isPlainObject(returned)
    ? Object.entries(returned)
    : [["", returned]];

  const pairs: [string, string[]][] = [];

  for (const [k, v] of regions) pairs.push([k, path(v)]);

  return pairs.length ? Object.fromEntries(pairs) : fail();
};

const stepLabel = (label: Answer, action: string): string | Hidden => {
  if (label === null || isLabel(label)) return label;
  throw new Error(
    "The view's step() returned " +
      (JSON.stringify(label) ?? "undefined") +
      " for the step " +
      action +
      ".",
  );
};

const VIEW_EXPORTS = ["state", "step", "group", "colors", "title"];

type Inspect = (value: Exported, options: { breakLength: number }) => string;

export function checkView(view: ViewModule, inspect: Inspect): CheckedView {
  const literal = (v: Exported) =>
    isString(v) ? JSON.stringify(v) : inspect(v, { breakLength: Infinity });

  const extra: string[] = [];

  for (const name of Object.keys(view))
    if (!VIEW_EXPORTS.includes(name)) extra.push(name);

  if (extra.length)
    throw new Error(
      "The view exports " +
        list(extra) +
        ", which the command does not read. Export only " +
        list(VIEW_EXPORTS) +
        ".",
    );
  const wrong: string[] = [];

  const fn = <F extends StateFunction | StepFunction>(
    name: string,
    v: F | Answer,
  ) => {
    if (v === undefined || v instanceof Function) return v;
    wrong.push(name + " must be a function");

    return undefined;
  };

  const state = fn("state", view.state);
  const step = fn("step", view.step);
  const group = fn("group", view.group);
  const exported = isPlainObject(view.colors) ? view.colors : undefined;

  if (view.colors !== undefined && exported === undefined)
    wrong.push("colors must be a plain object");
  const title = isString(view.title) ? view.title : undefined;

  if (view.title !== undefined && title === undefined)
    wrong.push("title must be a string");

  if (wrong.length) throw new Error("The view's " + list(wrong) + ".");

  if (group !== undefined && exported === undefined)
    throw new Error(
      "The view exports group() but no colors. Give each group a color in colors.",
    );
  const colors: { [group: string]: string } = Object.create(null);
  const bad: string[] = [];

  for (const [name, color] of Object.entries(exported ?? {})) {
    if (isString(color) && THEME_COLORS.includes(color)) colors[name] = color;
    else bad.push(JSON.stringify(name) + " the color " + literal(color));
  }

  if (bad.length)
    throw new Error(
      "The view's colors give " +
        list(bad) +
        ". Give each group " +
        list(THEME_COLORS, "or") +
        ".",
    );

  const named =
    group &&
    ((vars: Vars) => {
      const g = group(jsonVars(vars));

      if (g === undefined) return undefined;

      const name =
        g instanceof Symbol || Object(g) instanceof Symbol
          ? undefined
          : String(g);

      if (name === undefined || !Object.hasOwn(colors, name))
        throw new Error(
          "The view's group() returned " +
            literal(g) +
            ", which colors does not name. Give each group a color in colors.",
        );

      return name;
    });

  return {
    state: (vars: Vars) =>
      placeOf(state ? state(jsonVars(vars)) : defaultState(vars), vars),
    step: (action: string, from: Vars, to: Vars) =>
      stepLabel(
        step ? step(action, jsonVars(from), jsonVars(to)) : action,
        action,
      ),
    group: named,
    colors,
    title,
    [checked]: true,
  };
}
