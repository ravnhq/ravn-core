import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, relative, sep } from "node:path";
import { z } from "zod";
import { pluginDirs } from "./plugins.ts";

const repoDir = join(import.meta.dirname, "..");

const marketplacePath = join(repoDir, ".claude-plugin", "marketplace.json");

// Each plugin manifest is the version source. Copy it into that plugin's
// Claude marketplace entry, and into package.json or .cursor-plugin/plugin.json
// only when those files already declare a version. Leave metadata.version, and
// catalogs with no version field, alone.
const versionSchema = z.string().regex(/^[0-9A-Za-z][0-9A-Za-z.+-]*$/u);

const versionFileSchema = z.object({ version: versionSchema });

const optionalVersionSchema = z.object({ version: versionSchema.optional() });

const marketplaceSchema = z.object({
  plugins: z.array(z.object({ name: z.string(), version: versionSchema })),
});

const displayPath = (path: string) =>
  relative(repoDir, path).split(sep).join("/");

const readJson = (path: string) => JSON.parse(readFileSync(path, "utf8"));

const manifestOf = (dir: string) => {
  const rootManifest = join(dir, "plugin.json");

  return existsSync(rootManifest)
    ? rootManifest
    : join(dir, ".claude-plugin", "plugin.json");
};

const versionedCopies = (dir: string) => {
  const copies: string[] = [];

  for (const path of [
    join(dir, "package.json"),
    join(dir, ".cursor-plugin", "plugin.json"),
  ]) {
    if (!existsSync(path)) continue;

    const parsed = optionalVersionSchema.safeParse(readJson(path));

    if (parsed.success && parsed.data.version !== undefined) copies.push(path);
  }

  return copies;
};

const endOfString = (text: string, open: number) => {
  for (let index = open + 1; index < text.length; index += 1) {
    const char = text[index];

    if (char === "\\") {
      index += 1;

      continue;
    }

    if (char === '"') return index;
  }

  throw new Error("Unterminated JSON string.");
};

const skipWhitespace = (text: string, index: number) => {
  let cursor = index;

  while (
    cursor < text.length &&
    (text[cursor] === " " ||
      text[cursor] === "\n" ||
      text[cursor] === "\r" ||
      text[cursor] === "\t")
  ) {
    cursor += 1;
  }

  return cursor;
};

const objectEnd = (text: string, open: number) => {
  let depth = 0;

  for (let index = open; index < text.length; index += 1) {
    const char = text[index];

    if (char === '"') {
      index = endOfString(text, index);

      continue;
    }

    if (char === "{") depth += 1;

    if (char === "}") {
      depth -= 1;

      if (depth === 0) return index + 1;
    }
  }

  throw new Error("Unterminated JSON object.");
};

const pluginObject = (text: string, name: string) => {
  const stack: number[] = [];

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (char === '"') {
      const keyEnd = endOfString(text, index);
      const key = text.slice(index + 1, keyEnd);

      if (key === "name") {
        let cursor = skipWhitespace(text, keyEnd + 1);

        if (text[cursor] === ":") {
          cursor = skipWhitespace(text, cursor + 1);

          if (text[cursor] === '"') {
            const valueEnd = endOfString(text, cursor);
            const value = JSON.parse(text.slice(cursor, valueEnd + 1));

            if (value === name) {
              const open = stack.at(-1);

              if (open === undefined) {
                throw new Error(`No object owns marketplace entry ${name}.`);
              }

              return { open, end: objectEnd(text, open) };
            }
          }
        }
      }

      index = keyEnd;

      continue;
    }

    if (char === "{") stack.push(index);

    if (char === "}") stack.pop();
  }

  throw new Error(`Marketplace entry ${name} not found.`);
};

const replaceOwnVersion = (
  text: string,
  open: number,
  end: number,
  version: string,
) => {
  let depth = 0;

  for (let index = open; index < end; index += 1) {
    const char = text[index];

    if (char === '"') {
      const keyEnd = endOfString(text, index);

      if (depth === 1 && text.slice(index + 1, keyEnd) === "version") {
        let cursor = skipWhitespace(text, keyEnd + 1);

        if (text[cursor] !== ":") throw new Error("Version is not a field.");

        cursor = skipWhitespace(text, cursor + 1);

        if (text[cursor] !== '"') throw new Error("Version is not a string.");

        const valueEnd = endOfString(text, cursor);

        return (
          text.slice(0, cursor) +
          JSON.stringify(version) +
          text.slice(valueEnd + 1)
        );
      }

      index = keyEnd;

      continue;
    }

    if (char === "{") depth += 1;

    if (char === "}") depth -= 1;
  }

  throw new Error("Missing version field.");
};

const syncVersions = (check: boolean) => {
  const problems: string[] = [];
  let marketplaceText = readFileSync(marketplacePath, "utf8");
  const marketplace = marketplaceSchema.parse(readJson(marketplacePath));
  let marketplaceChanged = false;
  const writes: { path: string; text: string }[] = [];

  for (const dir of pluginDirs(join(repoDir, "plugins"))) {
    const name = basename(dir);
    const expected = versionFileSchema.parse(readJson(manifestOf(dir))).version;
    const entry = marketplace.plugins.find((plugin) => plugin.name === name);

    if (entry === undefined) {
      throw new Error(`.claude-plugin/marketplace.json has no ${name} entry.`);
    }

    if (entry.version !== expected) {
      problems.push(
        `.claude-plugin/marketplace.json ${name}: ${entry.version} -> ${expected}`,
      );

      if (!check) {
        const span = pluginObject(marketplaceText, name);

        marketplaceText = replaceOwnVersion(
          marketplaceText,
          span.open,
          span.end,
          expected,
        );
        marketplaceChanged = true;
      }
    }

    for (const path of versionedCopies(dir)) {
      const actual = versionFileSchema.parse(readJson(path)).version;

      if (actual === expected) continue;

      problems.push(`${displayPath(path)}: ${actual} -> ${expected}`);

      if (!check) {
        const text = readFileSync(path, "utf8");

        writes.push({
          path,
          text: replaceOwnVersion(text, 0, text.length, expected),
        });
      }
    }
  }

  if (problems.length === 0) {
    console.log("Versions match.");

    return;
  }

  console[check ? "error" : "log"](problems.join("\n"));

  if (check) {
    process.exitCode = 1;

    return;
  }

  if (marketplaceChanged) writeFileSync(marketplacePath, marketplaceText);

  for (const write of writes) writeFileSync(write.path, write.text);
};

if (import.meta.main) {
  const args = process.argv.slice(2).filter((arg) => arg !== "--");

  if (args.length > 1 || (args.length === 1 && args[0] !== "--check")) {
    console.error("Usage: node scripts/sync-versions.ts [--check]");
    process.exitCode = 1;
  } else {
    try {
      syncVersions(args[0] === "--check");
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    }
  }
}
