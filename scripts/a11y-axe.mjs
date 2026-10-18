import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";
import { flags } from "../content/flags.ts";

const routes = [
  "/",
  "/privacy",
  "/consent",
  "/consent-lead",
  "/consent-marketing",
  "/offer",
  "/refund",
  "/data-deletion",
  "/cookies",
  "/terms",
];

const pendingText = "Текст не опубликован";
const port = Number(process.env.A11Y_PORT || 3456);
const base = `http://127.0.0.1:${port}`;

/** Имя флага, который открывает документ. Значение берётся из content/flags.ts. */
const routeFlag = {
  "/cookies": "show_cookie_policy",
  "/terms": "show_terms",
  "/offer": "show_offer",
  "/refund": "show_refund",
  "/data-deletion": "show_data_deletion",
};

/** Опубликованы без флага. /privacy при show_site_legal=false остаётся редакцией 21.09, не заглушкой. */
const publishedRoutes = new Set(["/", "/privacy", "/consent", "/consent-lead", "/consent-marketing"]);

const axeRuns = [
  { name: "wcag-2.0-2.1-a-aa", tags: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
  { name: "best-practice", tags: ["best-practice"] },
];

function flagEnabled(name) {
  if (!(name in flags) || typeof flags[name] !== "boolean") {
    throw new Error(`В content/flags.ts нет boolean-флага ${name}`);
  }
  return flags[name];
}

function expectsNoindex(route) {
  if (Object.hasOwn(routeFlag, route)) return !flagEnabled(routeFlag[route]);
  if (publishedRoutes.has(route)) return false;
  throw new Error(`Нет правила robots для ${route}`);
}

function robotsTokens(contents) {
  return contents.flatMap((content) => content.toLowerCase().split(/[\s,]+/).filter(Boolean));
}

const buildId = fileURLToPath(new URL("../.next/BUILD_ID", import.meta.url));
if (!existsSync(buildId)) {
  console.error("Нет production-сборки. Сначала запустите next build.");
  process.exit(1);
}

const nextBin = fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url));
const server = spawn(process.execPath, [nextBin, "start", "--port", String(port)], {
  detached: true,
  stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1" },
});

let serverLog = "";
function remember(chunk) {
  serverLog += chunk.toString();
  if (serverLog.length > 12000) serverLog = serverLog.slice(-12000);
}
server.stdout.on("data", remember);
server.stderr.on("data", remember);

function stopServer() {
  if (server.exitCode !== null) return;
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {
    server.kill("SIGTERM");
  }
}

async function waitForServer() {
  const deadline = Date.now() + 30_000;
  let lastError = "";
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`next start завершился с кодом ${server.exitCode}\n${serverLog}`);
    }
    try {
      const response = await fetch(base + "/");
      if (response.ok) return;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`next start не ответил на ${base}/ (${lastError})\n${serverLog}`);
}

function expectIncludes(route, text, needle) {
  if (!text.includes(needle)) {
    throw new Error(`${route}: в тексте страницы нет «${needle}»`);
  }
}

function expectExcludes(route, text, needle) {
  if (text.includes(needle)) {
    throw new Error(`${route}: в тексте страницы есть «${needle}»`);
  }
}

async function assertRobots(page, route) {
  const contents = await page.locator('head meta[name="robots"]').evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("content") ?? ""),
  );
  const tokens = new Set(robotsTokens(contents));
  const shown = contents.length > 0 ? contents.join(" | ") : "нет meta";
  if (expectsNoindex(route)) {
    if (!tokens.has("noindex") || !tokens.has("nofollow")) {
      throw new Error(
        `${route}: флаг ${routeFlag[route]}=false, в head ожидался robots noindex, nofollow, получено ${shown}`,
      );
    }
    return `${shown} (${routeFlag[route]}=false)`;
  }
  if (tokens.has("noindex")) {
    const why = publishedRoutes.has(route) ? "страница опубликована" : `флаг ${routeFlag[route]}=true`;
    throw new Error(`${route}: ${why}, noindex в head быть не должно, получено ${shown}`);
  }
  return shown;
}

async function assertPage(page, route) {
  const robots = await assertRobots(page, route);
  const main = await page.locator("main").innerText();
  const dialog = page.getByRole("dialog", { name: "Настройки cookie" });
  await dialog.waitFor({ state: "visible" });
  const cookieHref = await dialog.locator("a", { hasText: "Политике cookie" }).getAttribute("href");
  const privacyHref = await dialog.locator("a", { hasText: "Политике обработки ПДн" }).getAttribute("href");
  if (cookieHref !== "/cookies") {
    throw new Error(`${route}: баннер cookie ведёт на ${cookieHref}, ожидался /cookies`);
  }
  if (privacyHref !== "/privacy") {
    throw new Error(`${route}: баннер cookie ведёт на ${privacyHref}, ожидался /privacy`);
  }

  const footer = await page.locator("footer").innerHTML();
  for (const [href, name] of Object.entries(routeFlag)) {
    const present = footer.includes(`href="${href}"`);
    if (flagEnabled(name) && !present) {
      throw new Error(`${route}: футер должен содержать ссылку ${href}, флаг ${name} включён`);
    }
    if (!flagEnabled(name) && present) {
      throw new Error(`${route}: футер содержит ссылку ${href} при выключенном флаге ${name}`);
    }
  }
  if (!footer.includes('href="/privacy"') || !footer.includes('href="/applicability"')) {
    throw new Error(`${route}: в футере нет ссылок на /privacy и /applicability`);
  }
  if (!footer.includes("Реквизиты не опубликованы")) {
    throw new Error(`${route}: футер не показывает, что реквизиты не опубликованы`);
  }

  for (const [href, name] of Object.entries(routeFlag)) {
    if (flagEnabled(name) || href === "/cookies") continue;
    const count = await page.locator(`a[href="${href}"]`).count();
    if (count !== 0) throw new Error(`${route}: на странице есть ссылка ${href} при выключенном флаге ${name}`);
  }
  const cookieLinks = await page.locator('a[href="/cookies"]').count();
  if (route === "/privacy" && cookieLinks < 2) {
    throw new Error(`${route}: ожидались ссылки на /cookies в баннере и в политике, найдено ${cookieLinks}`);
  }
  if (route !== "/privacy" && cookieLinks !== 1) {
    throw new Error(`${route}: ссылка на /cookies должна быть только в баннере, найдено ${cookieLinks}`);
  }

  if (route === "/") {
    expectIncludes(route, main, "Проверка сайта на 152-ФЗ");
    const lead = await page.locator('a[href="/consent-lead"]').count();
    if (lead !== 1) throw new Error(`${route}: форма заявки не ведёт на /consent-lead`);
  }
  if (route === "/privacy") {
    expectIncludes(route, main, "Редакция от 21.09.2026");
    expectIncludes(route, main, "Настоящая Политика обработки персональных данных");
    expectExcludes(route, main, pendingText);
    expectExcludes(route, main, "лица, давшие согласие через форму проверки");
    expectExcludes(
      route,
      main,
      "Сервис предназначен для организаций и ИП и их представителей старше 18 лет.",
    );
  }
  if (route === "/consent") {
    expectIncludes(route, main, "Цель: проведение автоматической проверки указанного мной сайта");
  }
  if (route === "/consent-lead") {
    expectIncludes(route, main, "Цель: рассмотрение моей заявки");
  }
  if (route === "/consent-marketing") {
    expectIncludes(route, main, "согласие на получение рекламных и информационных писем");
  }
  for (const consentRoute of ["/consent", "/consent-lead", "/consent-marketing"]) {
    if (route !== consentRoute) continue;
    expectExcludes(route, main, pendingText);
    const privacy = await page.locator("main a[href='/privacy']").count();
    if (privacy < 1) throw new Error(`${route}: нет ссылки на /privacy`);
  }
  for (const stub of ["/offer", "/refund", "/data-deletion", "/cookies", "/terms"]) {
    if (route !== stub) continue;
    expectIncludes(route, main, pendingText);
  }
  if (route === "/cookies") {
    expectExcludes(route, main, "Cookie — небольшие фрагменты данных");
    expectExcludes(route, main, "Редакция от 21.09.2026");
  }
  if (route === "/terms") {
    expectExcludes(route, main, "Настоящее соглашение является публичной офертой");
    expectExcludes(route, main, "Редакция от 21.09.2026");
  }
  return robots;
}

async function reveal(page) {
  await page.evaluate(async () => {
    const step = Math.max(window.innerHeight - 120, 240);
    const max = document.documentElement.scrollHeight;
    for (let top = 0; top <= max; top += step) {
      window.scrollTo(0, top);
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    window.scrollTo(0, 0);
  });
}

const violations = [];
let browser;

try {
  await waitForServer();
  browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);
  await page.emulateMedia({ reducedMotion: "reduce" });

  for (const route of routes) {
    const response = await page.goto(base + route, { waitUntil: "load" });
    if (!response || response.status() !== 200) {
      throw new Error(`${route}: HTTP ${response ? response.status() : "без ответа"}`);
    }
    const robots = await assertPage(page, route);
    await page.getByRole("button", { name: "Настроить" }).click();
    await reveal(page);
    for (const run of axeRuns) {
      const result = await new AxeBuilder({ page }).withTags(run.tags).analyze();
      console.log(
        `${route} ${run.name}: rules passed ${result.passes.length}, violations ${result.violations.length}`,
      );
      for (const violation of result.violations) {
        const nodes = violation.nodes
          .map((node) => `${node.target.join(" ")} ${node.html}`)
          .join(" | ");
        violations.push(`${route} ${run.name} ${violation.id} (${violation.impact}) ${violation.help} :: ${nodes}`);
      }
    }
    console.log(`${route}: robots ${robots}`);
  }
} catch (error) {
  stopServer();
  if (browser) await browser.close();
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

await browser.close();
stopServer();

if (violations.length > 0) {
  console.error(`axe: ${violations.length} violations`);
  for (const line of violations) console.error(line);
  process.exit(1);
}

console.log(
  `axe: 0 violations on ${routes.length} routes; runs ${axeRuns.map((run) => run.name).join(", ")}; port ${port}`,
);
