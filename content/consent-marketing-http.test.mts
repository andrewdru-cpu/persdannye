import assert from "node:assert/strict";
import { type ChildProcess, spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import { describe, it } from "node:test";
import { flags } from "./flags.ts";

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      const port = typeof address === "object" && address ? address.port : 0;
      probe.close(() => resolve(port));
    });
  });
}

async function stopServer(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([once(child, "exit"), new Promise((resolve) => setTimeout(resolve, 3000))]);
  if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
}

describe("built /consent-marketing", () => {
  it("returns 200 with noindex,nofollow while show_site_legal is off", async () => {
    assert.equal(flags.show_site_legal, false);
    assert.equal(existsSync(join(process.cwd(), ".next/BUILD_ID")), true);

    const port = await freePort();
    const child = spawn(
      process.execPath,
      ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)],
      { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"] },
    );
    let log = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      log += chunk.toString();
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      log += chunk.toString();
    });

    try {
      const url = `http://127.0.0.1:${port}/consent-marketing`;
      let response: Response | null = null;
      const deadline = Date.now() + 20_000;
      while (Date.now() < deadline) {
        if (child.exitCode !== null) break;
        try {
          const attempt = await fetch(url);
          if (attempt.status === 200) {
            response = attempt;
            break;
          }
        } catch {
          // Сервер ещё поднимается.
        }
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
      assert.ok(response, log);
      assert.equal(response.status, 200);
      const html = await response.text();
      const tag = html.match(/<meta\b[^>]*name="robots"[^>]*>/);
      assert.ok(tag, html.slice(0, 400));
      const content = tag[0].match(/content="([^"]*)"/)?.[1] ?? "";
      assert.equal(content.includes("noindex"), true);
      assert.equal(content.includes("nofollow"), true);
    } finally {
      await stopServer(child);
    }
  });
});
