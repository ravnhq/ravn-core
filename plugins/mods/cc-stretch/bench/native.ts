// Measures replies written with cc-stretch on, and what the reader actually opened.
//   node bench/native.ts <transcript.jsonl>... > bench/out/native.jsonl
import { measure } from "./measure.ts";
import { turnsOf } from "./transcripts.ts";

for (const path of process.argv.slice(2)) {
  for (const turn of turnsOf(path)) {
    if (!/\{\{[^{}|]+\|/.test(turn.reply)) continue;
    const m = measure(turn.reply, turn.opened);
    console.log(
      JSON.stringify({
        source: "native",
        session: turn.session,
        turn: turn.index,
        ...m,
        hasNote: turn.opened !== undefined,
        opened: turn.opened ? [...turn.opened] : undefined,
      }),
    );
  }
}
