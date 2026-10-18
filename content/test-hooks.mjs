import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const root = fileURLToPath(new URL("..", import.meta.url));

function fileWithExtension(abs) {
  const candidates = [
    abs,
    `${abs}.ts`,
    `${abs}.tsx`,
    `${abs}.mts`,
    `${abs}.js`,
    `${abs}.mjs`,
    path.join(abs, "index.ts"),
    path.join(abs, "index.tsx"),
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const abs = fileWithExtension(path.join(root, specifier.slice(2)));
    if (!abs) {
      throw new Error(`Не удалось разрешить ${specifier}`);
    }
    return { url: pathToFileURL(abs).href, shortCircuit: true };
  }
  if (specifier.startsWith(".") && !/\.[cm]?[jt]sx?$/.test(specifier)) {
    const parentDir = context.parentURL ? fileURLToPath(new URL(".", context.parentURL)) : root;
    const abs = fileWithExtension(path.resolve(parentDir, specifier));
    if (abs) return { url: pathToFileURL(abs).href, shortCircuit: true };
    return nextResolve(`${specifier}.ts`, context);
  }
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? error.code : "";
    if (code === "ERR_MODULE_NOT_FOUND" && !specifier.startsWith(".") && !path.extname(specifier)) {
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
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        sourceMap: false,
      },
      fileName: filename,
    });
    return { format: "module", source: outputText, shortCircuit: true };
  }
  return nextLoad(url, context);
}
