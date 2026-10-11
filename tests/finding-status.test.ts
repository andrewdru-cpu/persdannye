import assert from "node:assert/strict";
import test from "node:test";
import {
  findingStatusLabel,
  isViolation,
  jobHasRisks,
  normalizeFindings,
  readRulesVersion,
  readStaticFallback,
  violationCount,
} from "../lib/finding-status";
import { mapUpstreamScan } from "../lib/parser-client";
import { mapPublicCheck, sanitizeFindings } from "../lib/public-api";

const text = {
  rule_id: "P01",
  title: "Политика",
  fact: "Документ не найден.",
  severity: "high",
};

test("missing status still counts as a violation", () => {
  const findings = normalizeFindings([text, { ...text, rule_id: "P02", status: "" }, { ...text, status: null }]);
  assert.equal(findings.length, 3);
  assert.equal("status" in findings[0], false);
  assert.deepEqual(Object.keys(findings[0]).sort(), ["fact", "rule_id", "severity", "title"]);
  assert.equal(violationCount(findings), 3);
  assert.equal(isViolation(findings[0]), true);
  assert.equal(findingStatusLabel(undefined), null);
});

test("needs_check, not_checked, and unknown statuses are not violations", () => {
  const findings = normalizeFindings([
    { ...text, rule_id: "A", status: "needs_check", severity: "critical" },
    { ...text, rule_id: "B", status: " NOT_CHECKED " },
    { ...text, rule_id: "C", status: "later_added" },
    { ...text, rule_id: "D", status: "<script>" },
    { ...text, rule_id: "E", status: "violation" },
    { ...text, rule_id: "F", status: "FAIL" },
    { ...text, rule_id: "G", status: "failed" },
    { ...text, rule_id: "H", status: "non_compliant" },
  ]);
  assert.deepEqual(
    findings.map((f) => f.status),
    ["needs_check", "not_checked", "later_added", "unknown", "violation", "fail", "failed", "non_compliant"]
  );
  assert.equal(violationCount(findings), 4);
  assert.equal(findingStatusLabel("needs_check"), "требует проверки");
  assert.equal(findingStatusLabel("not_checked"), "не проверено");
  assert.equal(findingStatusLabel("later_added"), "не классифицировано");
  assert.equal(findingStatusLabel("violation"), null);
  assert.equal(
    jobHasRisks({ phase: "done", push: true, findings: findings.slice(0, 4) }),
    false
  );
});

test("push stays a legacy signal only when findings have no status", () => {
  assert.equal(jobHasRisks({ phase: "done", push: true, findings: [] }), true);
  assert.equal(jobHasRisks({ phase: "done", push: false, findings: [text] }), true);
  assert.equal(jobHasRisks({ phase: "extract", push: true, findings: [] }), true);
  assert.equal(
    jobHasRisks({
      phase: "done",
      push: true,
      findings: [{ ...text, status: "needs_check" }],
    }),
    false
  );
  assert.equal(readStaticFallback(undefined), false);
  assert.equal(readStaticFallback(false), false);
  assert.equal(readStaticFallback("true"), false);
  assert.equal(readStaticFallback(true), true);
  assert.equal(readRulesVersion(undefined), null);
  assert.equal(readRulesVersion("  "), null);
  assert.equal(readRulesVersion(" 2026.10 "), "2026.10");
});

test("public and BFF mappers share status, fallback, and rules version", () => {
  const body = {
    check_id: "abc",
    phase: "done",
    url: "https://shop.example",
    score: 70,
    static_fallback: true,
    rules_version: "2026.10",
    push: true,
    findings: [
      { ...text, status: "needs_check", email: "a@b.c", screenshot: "shot" },
      { ...text, rule_id: "P02" },
    ],
    contacts: { email: "a@b.c" },
  };
  const pub = mapPublicCheck(body, "https://shop.example", "abc");
  const bff = mapUpstreamScan(body, "https://shop.example");

  for (const job of [pub, bff]) {
    assert.equal(job.staticFallback, true);
    assert.equal(job.rulesVersion, "2026.10");
    assert.equal(job.hasRisks, true);
    assert.equal(violationCount(job.findings), 1);
    assert.equal(job.findings[0].status, "needs_check");
    assert.equal("status" in job.findings[1], false);
    assert.equal(JSON.stringify(job.findings).includes("a@b.c"), false);
    assert.equal(JSON.stringify(job.findings).includes("screenshot"), false);
  }

  const quiet = mapPublicCheck(
    {
      status: "done",
      findings: [{ ...text, status: "needs_check" }],
      static_fallback: false,
      rules_version: "",
    },
    "https://shop.example",
    "quiet"
  );
  assert.equal(quiet.hasRisks, false);
  assert.equal(quiet.staticFallback, false);
  assert.equal(quiet.rulesVersion, null);
  assert.equal(violationCount(quiet.findings), 0);

  const absent = sanitizeFindings([{ ...text }]);
  assert.equal(absent[0].status, undefined);
  const legacy = mapPublicCheck({ status: "done", findings: [{ ...text }] }, "https://shop.example", "old");
  assert.equal(legacy.hasRisks, true);
  assert.equal(legacy.staticFallback, false);
  assert.equal(legacy.rulesVersion, null);
});
