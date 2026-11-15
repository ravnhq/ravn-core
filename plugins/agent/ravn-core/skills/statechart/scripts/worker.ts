import { Buffer } from "node:buffer";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { inspect } from "node:util";
import { checkView } from "./frontends/view.ts";
import { isText } from "./ir.ts";
import { compile } from "./pipeline.ts";
import { check } from "./run.ts";

const [stage, specFile, configFile, viewFile] = process.argv.slice(2);

try {
  const view = checkView(
    viewFile ? await import(pathToFileURL(path.resolve(viewFile)).href) : {},
    inspect,
  );

  const { files, exit } = compile(await check(specFile, configFile), view);
  const draft = path.join(stage, "draft");
  fs.mkdirSync(draft);

  for (const [name, parts] of files) {
    const fd = fs.openSync(path.join(draft, name), "wx");

    try {
      for (const part of parts)
        fs.writeSync(fd, isText(part) ? Buffer.from(part) : part);
      fs.writeSync(fd, "\n");
    } finally {
      fs.closeSync(fd);
    }
  }

  fs.renameSync(draft, path.join(stage, "done"));
  process.exit(exit);
} catch (error) {
  // The view can throw anything. Object() boxes a primitive, so only a thrown
  // object can carry a message of its own.
  const thrown: { message?: string | number | boolean | object | null } =
    Object(error);

  console.error(
    Object(error) === error && isText(thrown.message)
      ? thrown.message
      : inspect(error),
  );
  process.exit(2);
}
