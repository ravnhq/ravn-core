import { appendFileSync, mkdirSync, statSync } from "node:fs";
import { dirname } from "node:path";

const header = ["ts", "phase", "decision", "why", "evidence", "result"];

const usage =
  "Usage: node log.ts <logfile> <phase> <decision> <why> <evidence> <result>";

// Spreadsheets run a cell starting with one of these as a formula. Evidence
// can carry PR titles, filenames, or generated text, so neutralize it before
// a reviewer opens the log.
const formulaPrefix = /^[=+\-@]/;

function clean(cell: string): string {
  const flat = cell.replace(/[\t\n\r]/g, " ");

  return formulaPrefix.test(flat) ? `'${flat}` : flat;
}

function isEmpty(path: string): boolean {
  try {
    return statSync(path).size === 0;
  } catch {
    return true;
  }
}

const [logfile, ...cells] = process.argv.slice(2);

if (logfile === undefined || cells.length !== 5) {
  console.error(usage);
  process.exit(2);
}

mkdirSync(dirname(logfile), { recursive: true });

// Append the header too, never truncate: if the size check misfires on a
// log that exists, the cost is one stray header line, not the rows.
if (isEmpty(logfile)) {
  const headerLine = header.join("\t");

  appendFileSync(logfile, `${headerLine}\n`);
}

const ts = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

const row = [ts, ...cells.map(clean)].join("\t");

appendFileSync(logfile, `${row}\n`);
