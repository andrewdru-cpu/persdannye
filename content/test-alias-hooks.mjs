import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const linkShim = pathToFileURL(join(here, "test-shims/link.mjs")).href;
const fontShim = pathToFileURL(join(here, "test-shims/font.mjs")).href;
const emptyShim = pathToFileURL(join(here, "test-shims/empty.mjs")).href;

function resolveAlias(specifier) {
  const base = join(root, specifier.slice(2));
  const files = [];
  for (const ext of ["", ".ts", ".tsx", ".mts", ".js", ".mjs"]) files.push(base + ext);
  for (const ext of [".ts", ".tsx", ".js"]) files.push(join(base, `index${ext}`));
  return files.find((file) => existsSync(file) && statSync(file).isFile()) ?? null;
}

function fileUrlFromSpecifier(specifier, context) {
  if (specifier.startsWith("file:")) return specifier;
  const parent = context.parentURL ? fileURLToPath(context.parentURL) : join(root, "package.json");
  return pathToFileURL(join(dirname(parent), specifier)).href;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "next/link") {
    return { url: linkShim, shortCircuit: true };
  }
  if (specifier === "next/font/local") {
    return { url: fontShim, shortCircuit: true };
  }
  if (specifier.endsWith(".css")) {
    return { url: emptyShim, shortCircuit: true };
  }
  if (specifier.endsWith(".tsx")) {
    return { url: fileUrlFromSpecifier(specifier, context), shortCircuit: true };
  }
  if (specifier.startsWith("@/")) {
    const file = resolveAlias(specifier);
    if (!file) {
      throw new Error(`Cannot resolve ${specifier}`);
    }
    return nextResolve(pathToFileURL(file).href, context);
  }
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (
      specifier.startsWith(".") ||
      specifier.startsWith("/") ||
      specifier.includes("://") ||
      /\.[cm]?[jt]sx?$/.test(specifier)
    ) {
      throw error;
    }
    return nextResolve(`${specifier}.js`, context);
  }
}

export async function load(url, context, nextLoad) {
  if (url.endsWith(".tsx")) {
    const source = readFileSync(fileURLToPath(url), "utf8");
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: {
        jsx: ts.JsxEmit.ReactJSX,
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
      fileName: url,
    });
    return { format: "module", source: outputText, shortCircuit: true };
  }
  return nextLoad(url, context);
}
