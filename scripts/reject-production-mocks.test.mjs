import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, it } from "node:test";

const script = path.resolve("scripts/reject-production-mocks.mjs");

function run(env) {
  return spawnSync(process.execPath, [script], {
    encoding: "utf8",
    env: { PATH: process.env.PATH, ...env },
  });
}

describe("production mock env", () => {
  it("fails a production build when any mock variable is set", () => {
    for (const key of ["E2E", "SUPPRESSION_MOCK", "OUTBOUND_MOCK"]) {
      const result = run({ VERCEL_ENV: "production", NODE_ENV: "production", [key]: "1" });
      assert.equal(result.status, 1, key);
      assert.match(result.stderr, new RegExp(key));
      assert.match(result.stderr, /VERCEL_ENV=production/);
      assert.match(result.stderr, /не NODE_ENV/);
    }
  });

  it("passes on preview and when VERCEL_ENV is unset", () => {
    const mocks = { E2E: "1", SUPPRESSION_MOCK: "true", OUTBOUND_MOCK: "on" };
    const preview = run({ VERCEL_ENV: "preview", NODE_ENV: "production", ...mocks });
    assert.equal(preview.status, 0);
    assert.equal(preview.stderr, "");

    const local = run({ NODE_ENV: "production", ...mocks });
    assert.equal(local.status, 0, local.stderr);
    assert.equal(local.stderr, "");

    const blank = run({
      VERCEL_ENV: "production",
      NODE_ENV: "production",
      E2E: "  ",
      SUPPRESSION_MOCK: "",
      OUTBOUND_MOCK: "",
    });
    assert.equal(blank.status, 0, blank.stderr);
  });

  it("fails when PD_DEPLOY_ENV=prod and a mock is set", () => {
    for (const key of ["E2E", "SUPPRESSION_MOCK", "OUTBOUND_MOCK"]) {
      const result = run({ PD_DEPLOY_ENV: "prod", NODE_ENV: "test", [key]: "1" });
      assert.equal(result.status, 1, key);
      assert.match(result.stderr, /PD_DEPLOY_ENV=prod/);
      assert.match(result.stderr, new RegExp(key));
      assert.match(result.stderr, /не NODE_ENV/);
    }
  });

  it("passes when PD_DEPLOY_ENV=prod and no mock is set", () => {
    const result = run({ PD_DEPLOY_ENV: "prod", NODE_ENV: "production" });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, "");
  });

  it("passes e2e with E2E=1 when production flags are unset", () => {
    const result = run({ E2E: "1", NODE_ENV: "test" });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, "");
  });
});
