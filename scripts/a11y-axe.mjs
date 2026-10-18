import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";

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
const hiddenHrefs = ["/terms", "/offer", "/refund", "/data-deletion"];
const port = Number(process.env.A11Y_PORT || 3456);
const base = `http://127.0.0.1:${port}`;

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

async function assertPage(page, route) {
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
  for (const href of ["/cookies", ...hiddenHrefs]) {
    if (footer.includes(`href="${href}"`)) {
      throw new Error(`${route}: футер содержит ссылку ${href} при выключенном флаге`);
    }
  }
  if (!footer.includes('href="/privacy"') || !footer.includes('href="/applicability"')) {
    throw new Error(`${route}: в футере нет ссылок на /privacy и /applicability`);
  }
  if (!footer.includes("Реквизиты не опубликованы")) {
    throw new Error(`${route}: футер не показывает, что реквизиты не опубликованы`);
  }

  for (const href of hiddenHrefs) {
    const count = await page.locator(`a[href="${href}"]`).count();
    if (count !== 0) throw new Error(`${route}: на странице есть ссылка ${href}`);
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
    await assertPage(page, route);
    await page.getByRole("button", { name: "Настроить" }).click();
    await reveal(page);
    const result = await new AxeBuilder({ page }).analyze();
    for (const violation of result.violations) {
      const nodes = violation.nodes
        .map((node) => `${node.target.join(" ")} ${node.html}`)
        .join(" | ");
      violations.push(`${route} ${violation.id} (${violation.impact}) ${violation.help} :: ${nodes}`);
    }
    console.log(`${route}: axe violations ${result.violations.length}`);
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

console.log(`axe: 0 violations on ${routes.length} routes`);
