import { execFile } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const TLA2TOOLS_VERSION = "1.7.4";

const TLA2TOOLS_URL =
  "https://github.com/tlaplus/tlaplus/releases/download/v" +
  TLA2TOOLS_VERSION +
  "/tla2tools.jar";

const TLA2TOOLS_SHA256 =
  "936a262061c914694dfd669a543be24573c45d5aa0ff20a8b96b23d01e050e88";

const JAVA_MAJOR = 11;

export type Tools = { java: string; jar: string };

export function cacheDir(env: NodeJS.ProcessEnv, platform: NodeJS.Platform) {
  const home = os.homedir();

  if (platform === "win32")
    return path.join(
      env.LOCALAPPDATA ?? path.join(home, "AppData", "Local"),
      "ravn-core",
      "Cache",
      "statechart",
    );

  if (platform === "darwin")
    return path.join(home, "Library", "Caches", "ravn-core", "statechart");

  return path.join(
    env.XDG_CACHE_HOME ?? path.join(home, ".cache"),
    "ravn-core",
    "statechart",
  );
}

const sha256 = (file: string) =>
  createHash("sha256").update(fs.readFileSync(file)).digest("hex");

async function download(jar: string) {
  fs.mkdirSync(path.dirname(jar), { recursive: true });
  const partial = jar + "." + randomBytes(8).toString("hex") + ".part";

  try {
    const response = await fetch(TLA2TOOLS_URL);

    if (!response.ok) throw new Error("the server answered " + response.status);
    fs.writeFileSync(partial, Buffer.from(await response.arrayBuffer()));
    const digest = sha256(partial);

    if (digest !== TLA2TOOLS_SHA256)
      throw new Error(
        "its SHA-256 is " +
          digest +
          ", and statechart expects " +
          TLA2TOOLS_SHA256,
      );
    fs.renameSync(partial, jar);
  } catch (error) {
    throw new Error(
      "Cannot fetch tla2tools.jar " +
        TLA2TOOLS_VERSION +
        " from " +
        TLA2TOOLS_URL +
        ": " +
        (error instanceof Error ? error.message : String(error)) +
        ". Download it yourself and set TLA2TOOLS to its path.",
      { cause: error },
    );
  } finally {
    fs.rmSync(partial, { force: true });
  }
}

/** The pinned tla2tools.jar: TLA2TOOLS when set, else the per-user cache, fetched and checked on first use. */
export async function findJar(env: NodeJS.ProcessEnv) {
  if (env.TLA2TOOLS) {
    if (!fs.existsSync(env.TLA2TOOLS))
      throw new Error(
        "TLA2TOOLS is " +
          env.TLA2TOOLS +
          ", which does not exist. Set it to the path of tla2tools.jar, or unset it to use the pinned " +
          TLA2TOOLS_VERSION +
          ".",
      );

    return env.TLA2TOOLS;
  }

  const jar = path.join(
    cacheDir(env, process.platform),
    "tla2tools-" + TLA2TOOLS_VERSION + ".jar",
  );

  if (!fs.existsSync(jar) || sha256(jar) !== TLA2TOOLS_SHA256)
    await download(jar);

  return jar;
}

const javaVersion = (java: string) =>
  new Promise<string>((resolve, reject) =>
    execFile(java, ["-version"], { encoding: "utf8" }, (error, _, stderr) =>
      error ? reject(error) : resolve(stderr),
    ),
  );

/** The java to run TLC with: JAVA when set, else java on PATH, at Java 11 or later. */
export async function findJava(env: NodeJS.ProcessEnv) {
  const java = env.JAVA || "java";
  let printed: string;

  try {
    printed = await javaVersion(java);
  } catch (error) {
    throw new Error(
      "statechart needs Java " +
        JAVA_MAJOR +
        " or later to run TLC, and cannot run " +
        java +
        ". Install a JDK, such as Temurin from https://adoptium.net, so that java is on PATH, or set JAVA to a java binary.",
      { cause: error },
    );
  }

  const version = /version "(\d+)(?:\.(\d+))?/.exec(printed);

  const major =
    version && (version[1] === "1" ? Number(version[2]) : Number(version[1]));

  if (major && major < JAVA_MAJOR)
    throw new Error(
      "statechart needs Java " +
        JAVA_MAJOR +
        " or later to run TLC, and " +
        java +
        " is Java " +
        major +
        ". Put a newer JDK on PATH, or set JAVA to one.",
    );

  return java;
}

export async function findTools(env: NodeJS.ProcessEnv): Promise<Tools> {
  const java = await findJava(env);

  return { java, jar: await findJar(env) };
}
