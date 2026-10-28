// Turns the names a reading note gives the stretches the reader opened back into their short forms,
// which `render` in measure.ts opens by.
import { draw } from "./measure.ts";
import { parse, stretches } from "../hooks/parse.ts";
import type { Segment } from "../hooks/parse.ts";

const hasWords = (text: string) => /[\p{L}\p{N}]/u.test(text);

/**
 * `names`, read from `reply`'s reading note, with the short form of each stretch with no words of its
 * own that one of them names. From cc-stretch 0.5.2 such a stretch, a lone period say, is named by its
 * lead-in words and its short form (`"It merged."`), as `namesOf` in hooks/layout.ts writes it. As of
 * Node 24.14.0 node cannot load hooks/layout.ts, which imports `./parse` without the `.ts` ending, so
 * such a name is matched as the end of the reply's text drawn up to the link, or up to the punctuation
 * an empty short form is glued to. A name that is some stretch's short form, as every name was before
 * 0.5.2, names that stretch only.
 */
export function shortsNamed(
  reply: string,
  names: ReadonlySet<string>,
): Set<string> {
  const shorts = new Set(names);
  const parts = parse(reply);
  const written = new Set(
    stretches(parts).map((stretch) => stretch.short.trim()),
  );
  const worded = [...names].filter(
    (name) => hasWords(name) && !written.has(name),
  );
  if (worded.length === 0) return shorts;
  const walk = (segments: Segment[]) =>
    segments.forEach((part, i) => {
      if (typeof part === "string") return;
      walk(part.long ?? []);
      const short = part.short.trim();
      if (names.has(short) || hasWords(short)) return;
      const drawn = draw(segments.slice(0, i + 1), new Set());
      const after = segments[i + 1];
      const glued = `${drawn}${typeof after === "string" ? (/^[\p{P}\p{S}]*/u.exec(after)?.[0] ?? "") : ""}`;
      const bare = drawn.trimEnd();
      if (worded.some((name) => bare.endsWith(name) || glued.endsWith(name)))
        shorts.add(short);
    });
  walk(parts);
  return shorts;
}
