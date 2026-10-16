import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = path.resolve(import.meta.dirname, "..");

function resolveFile(abs) {
  const candidates = [
    abs,
    `${abs}.ts`,
    `${abs}.tsx`,
    `${abs}.mts`,
    `${abs}.js`,
    `${abs}.mjs`,
    path.join(abs, "index.ts"),
    path.join(abs, "index.js"),
  ];
  return candidates.find((file) => {
    try {
      return fs.statSync(file).isFile();
    } catch {
      return false;
    }
  });
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const file = resolveFile(path.join(root, specifier.slice(2)));
    if (file) return nextResolve(pathToFileURL(file).href, context);
  }
  if (specifier.startsWith(".") && !/\.[cm]?[jt]s$/.test(specifier)) {
    return nextResolve(`${specifier}.ts`, context);
  }
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    const code = err && typeof err === "object" && "code" in err ? err.code : "";
    if (
      code === "ERR_MODULE_NOT_FOUND" &&
      !specifier.startsWith(".") &&
      !specifier.startsWith("/") &&
      !specifier.startsWith("node:") &&
      !specifier.endsWith(".js")
    ) {
      return nextResolve(`${specifier}.js`, context);
    }
    throw err;
  }
}
