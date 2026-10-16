import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const chromeBins = ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"];

/** Цвета как в app/globals.css, чтобы axe считал контраст так же, как на сайте. */
const documentCss = `
  body { background: #08090d; color: #f7f1e6; font-size: 16px; line-height: 1.5; }
  a { color: inherit; text-decoration: inherit; }
  .text-white { color: #fff; }
  .text-white\\/80 { color: rgba(255, 255, 255, 0.8); }
  .text-white\\/70 { color: rgba(255, 255, 255, 0.7); }
  .text-amber-200 { color: #e7d3a1; }
  .underline { text-decoration-line: underline; }
  .bg-ink-975 { background: #05060a; }
  .text-xs { font-size: 12px; line-height: 1.625; }
  .text-sm { font-size: 14px; line-height: 1.5; }
  .skip-link {
    position: absolute;
    left: 1rem;
    top: 1rem;
    transform: translateY(-150%);
    background: #f3e6c4;
    color: #1a140c;
    padding: 0.6rem 1rem;
    font-weight: 600;
  }
`;

function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  for (const bin of chromeBins) {
    const found = spawnSync("bash", ["-lc", `command -v ${bin}`], { encoding: "utf8" });
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim();
  }
  throw new Error(`Не найден Chrome (${chromeBins.join(", ")}). Задайте CHROME_PATH.`);
}

/**
 * Прогон axe-core (уже есть в дереве зависимостей) в системном Chrome.
 * Новых пакетов не ставит. Возвращает violations стандартного axe.run().
 */
export async function runAxe(bodyHtml) {
  const chromeBin = findChrome();
  const dir = await mkdtemp(path.join(tmpdir(), "dbip-axe-"));
  const htmlPath = path.join(dir, "page.html");
  const axeHref = pathToFileURL(path.resolve("node_modules/axe-core/axe.js")).href;
  const html = `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <title>Источники данных</title>
  <style>${documentCss}</style>
</head>
<body>
${bodyHtml}
<script src="${axeHref}"></script>
</body>
</html>`;
  await writeFile(htmlPath, html);

  const chrome = spawn(
    chromeBin,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--allow-file-access-from-files",
      "--no-first-run",
      "--remote-debugging-port=0",
      `--user-data-dir=${path.join(dir, "profile")}`,
      "about:blank",
    ],
    { detached: true, stdio: ["ignore", "ignore", "pipe"] },
  );

  let stderr = "";
  const exitPromise = new Promise((resolve) => {
    chrome.once("exit", (code) => resolve(code));
  });
  const wsReady = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Chrome не открыл DevTools.\n${stderr}`)), 15000);
    chrome.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    chrome.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      const match = stderr.match(/DevTools listening on (ws:\/\/\S+)/);
      if (match) {
        clearTimeout(timer);
        resolve(match[1]);
      }
    });
    exitPromise.then((code) => {
      clearTimeout(timer);
      reject(new Error(`Chrome завершился с кодом ${code} до DevTools.\n${stderr}`));
    });
  });

  try {
    const browserWs = await wsReady;
    const ws = new WebSocket(browserWs);
    await new Promise((resolve, reject) => {
      ws.addEventListener("open", resolve, { once: true });
      ws.addEventListener("error", () => reject(new Error("WebSocket DevTools не открылся")), { once: true });
    });

    let nextId = 0;
    const pending = new Map();
    const waiters = [];
    ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id && pending.has(message.id)) {
        const job = pending.get(message.id);
        pending.delete(message.id);
        if (message.error) job.reject(new Error(JSON.stringify(message.error)));
        else job.resolve(message.result);
        return;
      }
      for (let index = waiters.length - 1; index >= 0; index -= 1) {
        if (waiters[index].match(message)) {
          const waiter = waiters.splice(index, 1)[0];
          clearTimeout(waiter.timer);
          waiter.resolve(message);
        }
      }
    });

    function send(method, params = {}, sessionId) {
      const id = ++nextId;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params, sessionId }));
      });
    }

    function waitFor(match, timeoutMs) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("Таймаут события Chrome")), timeoutMs);
        waiters.push({ match, resolve, timer });
      });
    }

    const { targetId } = await send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
    await send("Page.enable", {}, sessionId);
    const loaded = waitFor(
      (message) => message.method === "Page.loadEventFired" && message.sessionId === sessionId,
      10000,
    );
    await send("Page.navigate", { url: pathToFileURL(htmlPath).href }, sessionId);
    await loaded;
    const evaluated = await send(
      "Runtime.evaluate",
      {
        expression:
          "typeof axe === 'undefined' ? 'NO_AXE' : axe.run(document).then((result) => JSON.stringify(result.violations.map((item) => ({ id: item.id, impact: item.impact, help: item.help, nodes: item.nodes.map((node) => node.html) }))))",
        awaitPromise: true,
        returnByValue: true,
      },
      sessionId,
    );
    ws.close();
    if (!evaluated.result || evaluated.result.value === "NO_AXE") {
      throw new Error("axe-core не загрузился в документ");
    }
    if (evaluated.exceptionDetails) {
      throw new Error(JSON.stringify(evaluated.exceptionDetails));
    }
    return JSON.parse(evaluated.result.value);
  } finally {
    if (chrome.exitCode === null) {
      try {
        process.kill(-chrome.pid, "SIGKILL");
      } catch {
        chrome.kill("SIGKILL");
      }
    }
    await exitPromise;
    await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}
