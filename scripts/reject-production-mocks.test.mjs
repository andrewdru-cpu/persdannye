import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, it } from "node:test";

const script = path.resolve("scripts/reject-production-mocks.mjs");
const SECRET_32 = "a".repeat(32);

function run(env) {
  return spawnSync(process.execPath, [script], {
    encoding: "utf8",
    env: { PATH: process.env.PATH, ...env },
  });
}

describe("production mock env", () => {
  it("passes a production build when no mock variables are set", () => {
    const result = run({
      VERCEL_ENV: "production",
      NODE_ENV: "production",
      PD_BFF_SIGNING_SECRET: SECRET_32,
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, "");
  });

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
      PD_BFF_SIGNING_SECRET: SECRET_32,
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
    const result = run({
      PD_DEPLOY_ENV: "prod",
      NODE_ENV: "production",
      PD_BFF_SIGNING_SECRET: SECRET_32,
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, "");
  });

  it("fails production when the signing secret is empty or shorter than 32 bytes", () => {
    for (const secret of [undefined, "", "a".repeat(31)]) {
      const env = { VERCEL_ENV: "production", NODE_ENV: "production" };
      if (secret !== undefined) env.PD_BFF_SIGNING_SECRET = secret;
      const result = run(env);
      assert.equal(result.status, 1, JSON.stringify(secret));
      assert.match(result.stderr, /PD_BFF_SIGNING_SECRET/);
      assert.match(result.stderr, /32/);
      assert.match(result.stderr, /не NODE_ENV/);
    }

    const onVps = run({
      PD_DEPLOY_ENV: "prod",
      NODE_ENV: "test",
      PD_BFF_SIGNING_SECRET: "a".repeat(31),
    });
    assert.equal(onVps.status, 1);
    assert.match(onVps.stderr, /PD_DEPLOY_ENV=prod/);
    assert.match(onVps.stderr, /PD_BFF_SIGNING_SECRET/);

    const ok = run({
      VERCEL_ENV: "production",
      PD_DEPLOY_ENV: "prod",
      NODE_ENV: "production",
      PD_BFF_SIGNING_SECRET: SECRET_32,
    });
    assert.equal(ok.status, 0, ok.stderr);
    assert.equal(ok.stderr, "");
  });

  it("fails startup when a signing secret has edge whitespace and does not print the value", () => {
    const body = "c".repeat(32);
    const cases = [
      ["PD_BFF_SIGNING_SECRET", ` ${body}`],
      ["PD_BFF_SIGNING_SECRET", `${body}\t`],
      ["PD_BFF_SIGNING_SECRET", `${body}\n`],
      ["PD_BFF_SIGNING_SECRET_PREV", `\n${body}`],
    ];
    for (const [name, value] of cases) {
      const env = { NODE_ENV: "test", PD_BFF_SIGNING_SECRET: SECRET_32 };
      env[name] = value;
      const result = run(env);
      assert.equal(result.status, 1, name);
      assert.equal(result.stderr.trim(), name);
      assert.equal(result.stderr.includes(body), false);
      assert.equal(result.stdout.includes(body), false);
    }
  });

  it("passes e2e with E2E=1 when production flags are unset", () => {
    const result = run({ E2E: "1", NODE_ENV: "test" });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, "");
  });
});
