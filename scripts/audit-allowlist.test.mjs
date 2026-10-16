import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

const script = path.resolve("scripts/audit-allowlist.mjs");
const allowlistPath = path.resolve(".github/audit-allowlist.json");
const allowlist = JSON.parse(readFileSync(allowlistPath, "utf8"));

const bracesAdvisory = {
  name: "braces",
  dependency: "braces",
  severity: "high",
  url: "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm",
};

function devTree() {
  return {
    vulnerabilities: {
      braces: {
        severity: "high",
        effects: ["micromatch"],
        via: [bracesAdvisory],
      },
      micromatch: { severity: "high", effects: ["fast-glob"], via: ["braces"] },
      "fast-glob": { severity: "high", effects: ["@next/eslint-plugin-next"], via: ["micromatch"] },
      "@next/eslint-plugin-next": { severity: "high", effects: ["eslint-config-next"], via: ["fast-glob"] },
      "eslint-config-next": { severity: "high", effects: [], via: ["@next/eslint-plugin-next"] },
    },
  };
}

function run(report, { today = "2026-10-16", allow = allowlist } = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), "audit-allow-"));
  const listPath = path.join(dir, "allowlist.json");
  const summary = path.join(dir, "summary.md");
  writeFileSync(listPath, JSON.stringify(allow));
  writeFileSync(summary, "");
  const result = spawnSync(process.execPath, [script, listPath], {
    input: JSON.stringify(report),
    encoding: "utf8",
    env: {
      PATH: process.env.PATH,
      AUDIT_TODAY: today,
      GITHUB_STEP_SUMMARY: summary,
    },
  });
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    summary: readFileSync(summary, "utf8"),
  };
}

describe("audit allowlist", () => {
  it("accepts an audit with no high or critical advisories", () => {
    const result = run({
      vulnerabilities: {
        lodash: {
          severity: "moderate",
          effects: [],
          via: [
            {
              name: "lodash",
              severity: "moderate",
              url: "https://github.com/advisories/GHSA-0000-0000-0000",
            },
          ],
        },
      },
    });
    assert.equal(result.status, 0);
    assert.equal(result.stdout.includes("::warning::"), false);
    assert.equal(result.summary, "");
  });

  it("allows the braces advisory only through eslint-config-next and warns", () => {
    const result = run(devTree());
    assert.equal(result.status, 0);
    assert.match(result.stdout, /::warning::GHSA-vfj7-8cjw-p6xm/);
    assert.match(result.stdout, /только dev-дерево eslint-config-next, фикса нет/);
    assert.match(result.stdout, /Сайт 152/);
    assert.match(result.summary, /GHSA-vfj7-8cjw-p6xm/);
    assert.match(result.summary, /Сайт 152/);
  });

  it("fails on a different high advisory", () => {
    const result = run({
      vulnerabilities: {
        "left-pad": {
          severity: "high",
          effects: [],
          via: [
            {
              name: "left-pad",
              severity: "high",
              url: "https://github.com/advisories/GHSA-1111-2222-3333",
            },
          ],
        },
      },
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /GHSA-1111-2222-3333/);
    assert.equal(result.stdout.includes("::warning::"), false);
  });

  it("fails when the same GHSA is also reached outside eslint-config-next", () => {
    const report = devTree();
    report.vulnerabilities.braces.effects = ["micromatch", "left-pad"];
    report.vulnerabilities["left-pad"] = {
      severity: "high",
      effects: [],
      via: ["braces"],
    };
    const result = run(report);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /not only reached through eslint-config-next/);
    assert.equal(result.stdout.includes("::warning::"), false);
  });

  it("fails after review_by", () => {
    const result = run(devTree(), { today: "2026-11-17" });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /expired on 2026-11-16/);
    assert.equal(result.stdout.includes("::warning::"), false);
  });
});
