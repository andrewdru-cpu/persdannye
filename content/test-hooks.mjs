import { existsSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const root = fileURLToPath(new URL("..", import.meta.url));

function resolveFile(abs) {
  const candidates = [abs, `${abs}.tsx`, `${abs}.ts`, `${abs}.mts`, `${abs}.js`, `${abs}.mjs`];
  return candidates.find((file) => {
    try {
      return statSync(file).isFile();
    } catch {
      return false;
    }
  });
}

function tsxModule(url) {
  return { url, shortCircuit: true, format: "module" };
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const file = resolveFile(path.join(root, specifier.slice(2)));
    if (!file) return nextResolve(specifier, context);
    if (file.endsWith(".tsx")) return tsxModule(pathToFileURL(file).href);
    return nextResolve(pathToFileURL(file).href, context);
  }
  if (specifier.startsWith(".") && specifier.endsWith(".tsx")) {
    const parent = context.parentURL ? fileURLToPath(context.parentURL) : root;
    const file = path.resolve(path.dirname(parent), specifier);
    if (existsSync(file)) return tsxModule(pathToFileURL(file).href);
  }
  if (specifier.startsWith(".") && !/\.[cm]?[jt]sx?$/.test(specifier)) {
    return nextResolve(`${specifier}.ts`, context);
  }
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? error.code : "";
    if (
      code === "ERR_MODULE_NOT_FOUND" &&
      !specifier.startsWith(".") &&
      !specifier.startsWith("/") &&
      !specifier.startsWith("@/") &&
      !specifier.startsWith("node:") &&
      !specifier.endsWith(".js")
    ) {
      return nextResolve(`${specifier}.js`, context);
    }
    throw error;
  }
}

export async function load(url, context, nextLoad) {
  if (url.startsWith("file:") && url.endsWith(".tsx")) {
    const filename = fileURLToPath(url);
    const source = readFileSync(filename, "utf8");
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: {
        jsx: ts.JsxEmit.ReactJSX,
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
      fileName: filename,
    });
    return { format: "module", source: outputText, shortCircuit: true };
  }
  return nextLoad(url, context);
}
