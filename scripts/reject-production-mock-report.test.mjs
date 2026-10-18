import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, it } from "node:test";

const script = path.resolve("scripts/reject-production-mock-report.mjs");

function run(env) {
  return spawnSync(process.execPath, [script], {
    encoding: "utf8",
    env: { PATH: process.env.PATH, ...env },
  });
}

describe("production mock report", () => {
  it("passes a production build when PARSER_API_BASE is set", () => {
    const result = run({
      VERCEL_ENV: "production",
      NODE_ENV: "production",
      PARSER_API_BASE: "https://api.example.ru",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, "");
  });

  it("fails a production build when PARSER_API_BASE is missing", () => {
    for (const env of [
      { VERCEL_ENV: "production", NODE_ENV: "production" },
      { VERCEL_ENV: "production", NODE_ENV: "production", PARSER_API_BASE: "  " },
      { PD_DEPLOY_ENV: "prod", NODE_ENV: "test" },
    ]) {
      const result = run(env);
      assert.equal(result.status, 1, JSON.stringify(env));
      assert.match(result.stderr, /PARSER_API_BASE не задан/);
      assert.match(result.stderr, /Мок-отчёт в проде запрещён/);
      assert.match(result.stderr, /не NODE_ENV/);
    }
  });

  it("passes on preview and when production flags are unset", () => {
    const preview = run({ VERCEL_ENV: "preview", NODE_ENV: "production" });
    assert.equal(preview.status, 0, preview.stderr);
    const local = run({ NODE_ENV: "production" });
    assert.equal(local.status, 0, local.stderr);
  });

  it("passes when PD_DEPLOY_ENV=prod and PARSER_API_BASE is set", () => {
    const result = run({ PD_DEPLOY_ENV: "prod", NODE_ENV: "production", PARSER_API_BASE: "https://api.example.ru" });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, "");
  });
});
