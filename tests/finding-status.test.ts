import assert from "node:assert/strict";
import test from "node:test";
import {
  findingStatusLabel,
  isRobotsPartial,
  isViolation,
  jobHasRisks,
  normalizeFindings,
  readRulesVersion,
  readStaticFallback,
  violationCount,
  visibleFineAmount,
} from "../lib/finding-status";
import { mapUpstreamScan } from "../lib/parser-client";
import { isLimitedScan, isTerminal, LIMITED_SCAN_MESSAGE } from "../lib/phases";
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
  assert.equal(readStaticFallback(true), false);
  assert.equal(readStaticFallback("true"), false);
  assert.equal(readStaticFallback("quick"), false);
  assert.equal(readStaticFallback(" static_fallback "), true);
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
    mode: "static_fallback",
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
      mode: "quick",
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
  const legacy = mapPublicCheck(
    { status: "done", findings: [{ ...text }], static_fallback: true },
    "https://shop.example",
    "old"
  );
  assert.equal(legacy.hasRisks, true);
  assert.equal(legacy.staticFallback, false);
  assert.equal(legacy.rulesVersion, null);
});

test("robots and site blocks are a manual-check outcome, not a violation or an error", () => {
  const finding = {
    ...text,
    status: "not_checked",
    reason: "robots_disallow",
    screenshot: "shot",
  };
  for (const status of ["blocked_by_robots", "BLOCKED_BY_SITE"]) {
    const pub = mapPublicCheck(
      {
        status,
        url: "https://shop.example",
        error: "timeout",
        message: "blocked",
        push: true,
        findings: [finding],
        static_fallback: true,
      },
      "https://shop.example",
      "lim"
    );
    const bff = mapUpstreamScan(
      {
        phase: status,
        url: "https://shop.example",
        error: "timeout",
        message: "blocked",
        push: true,
        findings: [finding],
        static_fallback: true,
      },
      "https://shop.example"
    );
    for (const job of [pub, bff]) {
      assert.equal(isLimitedScan(job.phase), true);
      assert.equal(isTerminal(job.phase), true);
      assert.equal(job.phaseMessage, LIMITED_SCAN_MESSAGE);
      assert.equal(job.hasRisks, false);
      assert.equal(job.error, null);
      assert.equal(job.staticFallback, false);
      assert.equal(violationCount(job.findings), 0);
      assert.equal(job.findings[0].status, "not_checked");
      assert.equal(job.findings[0].reason, "robots_disallow");
      assert.equal(isViolation(job.findings[0]), false);
    }
  }

  const unchecked = normalizeFindings([{ ...text, reason: "robots_disallow" }]);
  assert.equal(unchecked[0].reason, "robots_disallow");
  assert.equal("status" in unchecked[0], false);
  assert.equal(isViolation(unchecked[0]), false);

  const partial = mapPublicCheck(
    { status: "done", mode: "STATIC_FALLBACK", findings: [] },
    "https://shop.example",
    "part"
  );
  assert.equal(partial.staticFallback, true);
  assert.equal(partial.hasRisks, false);
  assert.equal(isLimitedScan("done"), false);
});

test("finding schema maps severity aliases, basis, disclaimer, and hides fine amounts", () => {
  const prev = process.env.NEXT_PUBLIC_SHOW_FINES;
  delete process.env.NEXT_PUBLIC_SHOW_FINES;
  try {
    const hidden = normalizeFindings([
      {
        ...text,
        severity: "S",
        status: "violation",
        status_basis: "likely",
        fine_norm: " ч. 3 ст. 13.11 КоАП ",
        fine_amount_text: "до 300 000 ₽",
        meta: { disclaimer: " Текст ", screenshot: "nope" },
      },
    ]);
    assert.equal(hidden[0].severity, "critical");
    assert.equal(hidden[0].statusBasis, "likely");
    assert.equal(hidden[0].disclaimer, "Текст");
    assert.equal(hidden[0].fineNorm, "ч. 3 ст. 13.11 КоАП");
    assert.equal("fineAmount" in hidden[0], false);
    assert.equal(JSON.stringify(hidden).includes("screenshot"), false);
    assert.equal(JSON.stringify(hidden).includes("300"), false);

    const aliases = normalizeFindings([
      { ...text, rule_id: "A", severity: "A" },
      { ...text, rule_id: "B", severity: " b " },
      { ...text, rule_id: "L", severity: "low" },
      { ...text, rule_id: "Z", severity: "unknown" },
    ]);
    assert.deepEqual(
      aliases.map((finding) => finding.severity),
      ["high", "medium", "low", "info"]
    );

    process.env.NEXT_PUBLIC_SHOW_FINES = "true";
    const shown = normalizeFindings(
      [
        { ...text, fine_amount_text: "до 300 000 ₽", fine_norm: "ч. 1 ст. 13.11 КоАП", status_basis: "proven" },
        { ...text, rule_id: "N", fine_amount_text: null },
      ],
      true
    );
    assert.equal(shown[0].fineAmount, "до 300 000 ₽");
    assert.equal(shown[0].statusBasis, "proven");
    assert.equal("fineAmount" in shown[1], false);

    process.env.NEXT_PUBLIC_SHOW_FINES = "false";
    const stillHidden = normalizeFindings([{ ...text, fine_amount_text: "до 300 000 ₽" }]);
    assert.equal("fineAmount" in stillHidden[0], false);
  } finally {
    if (prev === undefined) delete process.env.NEXT_PUBLIC_SHOW_FINES;
    else process.env.NEXT_PUBLIC_SHOW_FINES = prev;
  }
});

test("Disallow slash is a partial done result, not blocked_by_robots", () => {
  const prev = process.env.NEXT_PUBLIC_SHOW_FINES;
  delete process.env.NEXT_PUBLIC_SHOW_FINES;
  try {
    const body = {
      status: "done",
      mode: "static_fallback",
      url: "https://robots.example",
      findings: [
        {
          ...text,
          rule_id: "H01",
          severity: "S",
          status: "violation",
          status_basis: "proven",
          fine_norm: "ч. 3 ст. 13.11 КоАП",
          fine_amount_text: null,
        },
        {
          ...text,
          rule_id: "P01",
          severity: "B",
          status: "violation",
          status_basis: "LIKELY",
          fine_norm: "ч. 3 ст. 13.11 КоАП",
          fine_amount_text: "до 300 000 ₽",
          meta: { disclaimer: "Оценка юриста" },
        },
        {
          ...text,
          rule_id: "F03",
          severity: "A",
          status: "not_checked",
          reason: "robots_disallow",
        },
      ],
    };
    const pub = mapPublicCheck(body, "https://robots.example", "r");
    const bff = mapUpstreamScan({ ...body, phase: "done" }, "https://robots.example");
    for (const job of [pub, bff]) {
      assert.equal(job.phase, "done");
      assert.equal(isLimitedScan(job.phase), false);
      assert.equal(job.staticFallback, true);
      assert.equal(isRobotsPartial(job.findings), true);
      assert.equal(job.hasRisks, true);
      assert.equal(violationCount(job.findings), 2);
      assert.deepEqual(
        job.findings.map((finding) => finding.severity),
        ["critical", "medium", "high"]
      );
      assert.equal(job.findings[1].statusBasis, "likely");
      assert.equal(job.findings[1].disclaimer, "Оценка юриста");
      assert.equal(job.findings[1].fineNorm, "ч. 3 ст. 13.11 КоАП");
      assert.equal("fineAmount" in job.findings[1], false);
      assert.equal(job.findings[2].status, "not_checked");
      assert.equal(job.findings[2].reason, "robots_disallow");
      assert.equal(isViolation(job.findings[2]), false);
      assert.equal(JSON.stringify(job).includes("300"), false);
    }
  } finally {
    if (prev === undefined) delete process.env.NEXT_PUBLIC_SHOW_FINES;
    else process.env.NEXT_PUBLIC_SHOW_FINES = prev;
  }
});

test("fine amount is shown only when env, show_amounts, and text all hold", () => {
  const prev = process.env.NEXT_PUBLIC_SHOW_FINES;
  const amount = "до 300 000 ₽";
  const cases: Array<{
    env: string | undefined;
    show: unknown;
    text: unknown;
    expected: string | null;
  }> = [
    { env: "true", show: true, text: amount, expected: amount },
    { env: "true", show: true, text: "  до 100 ₽  ", expected: "до 100 ₽" },
    { env: undefined, show: true, text: amount, expected: null },
    { env: "false", show: true, text: amount, expected: null },
    { env: "1", show: true, text: amount, expected: null },
    { env: "TRUE", show: true, text: amount, expected: null },
    { env: "true", show: false, text: amount, expected: null },
    { env: "true", show: "true", text: amount, expected: null },
    { env: "true", show: 1, text: amount, expected: null },
    { env: "true", show: undefined, text: amount, expected: null },
    { env: "true", show: null, text: amount, expected: null },
    { env: "true", show: true, text: "", expected: null },
    { env: "true", show: true, text: "   ", expected: null },
    { env: "true", show: true, text: null, expected: null },
    { env: "true", show: true, text: undefined, expected: null },
    { env: undefined, show: false, text: "", expected: null },
    { env: "false", show: false, text: null, expected: null },
  ];
  try {
    for (const row of cases) {
      if (row.env === undefined) delete process.env.NEXT_PUBLIC_SHOW_FINES;
      else process.env.NEXT_PUBLIC_SHOW_FINES = row.env;
      assert.equal(visibleFineAmount(row.text, row.show), row.expected, JSON.stringify(row));
      const findings = normalizeFindings([{ ...text, fine_amount_text: row.text }], row.show);
      if (row.expected) assert.equal(findings[0].fineAmount, row.expected, JSON.stringify(row));
      else assert.equal("fineAmount" in findings[0], false, JSON.stringify(row));
    }

    process.env.NEXT_PUBLIC_SHOW_FINES = "true";
    const shown = mapPublicCheck(
      {
        status: "done",
        show_amounts: true,
        findings: [{ ...text, fine_amount_text: amount, fine_norm: "ч. 3 ст. 13.11 КоАП" }],
      },
      "https://shop.example",
      "amt"
    );
    assert.equal(shown.findings[0].fineAmount, amount);
    const hidden = mapUpstreamScan({
      phase: "done",
      show_amounts: false,
      findings: [{ ...text, fine_amount_text: amount }],
    });
    assert.equal("fineAmount" in hidden.findings[0], false);
    assert.equal(JSON.stringify(hidden).includes("300"), false);
  } finally {
    if (prev === undefined) delete process.env.NEXT_PUBLIC_SHOW_FINES;
    else process.env.NEXT_PUBLIC_SHOW_FINES = prev;
  }
});
