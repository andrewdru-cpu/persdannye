import { appendFileSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const BLOCKING = new Set(["high", "critical"]);

function ghsaId(via) {
  const url = typeof via?.url === "string" ? via.url : "";
  const fromUrl = url.match(/GHSA-[0-9a-z-]+/i);
  if (fromUrl) return fromUrl[0];
  if (typeof via?.source === "string" && /^GHSA-/i.test(via.source)) return via.source;
  return null;
}

function severityOf(via, vuln) {
  return String(via?.severity || vuln?.severity || "").toLowerCase();
}

function upwardPaths(vulns, start) {
  const paths = [];
  const walk = (name, chain) => {
    if (chain.includes(name)) {
      paths.push(chain);
      return;
    }
    const next = [...chain, name];
    const effects = vulns[name]?.effects;
    if (!Array.isArray(effects) || effects.length === 0) {
      paths.push(next);
      return;
    }
    for (const parent of effects) walk(parent, next);
  };
  walk(start, []);
  return paths;
}

function todayString() {
  const override = process.env.AUDIT_TODAY;
  if (typeof override === "string" && /^\d{4}-\d{2}-\d{2}$/.test(override)) return override;
  return new Date().toISOString().slice(0, 10);
}

function loadAllowlist(entries) {
  if (!Array.isArray(entries)) {
    throw new Error("allowlist must be a JSON array");
  }
  return entries.map((entry) => {
    for (const key of ["id", "package", "path", "reason", "owner", "review_by"]) {
      if (typeof entry?.[key] !== "string" || entry[key].trim() === "") {
        throw new Error(`allowlist entry is missing ${key}`);
      }
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.review_by)) {
      throw new Error(`allowlist review_by must be YYYY-MM-DD (${entry.id})`);
    }
    return entry;
  });
}

function directAdvisories(vulns) {
  const found = [];
  for (const [pkg, vuln] of Object.entries(vulns)) {
    for (const via of vuln?.via || []) {
      if (!via || typeof via !== "object") continue;
      const severity = severityOf(via, vuln);
      if (!BLOCKING.has(severity)) continue;
      found.push({
        id: ghsaId(via),
        package: via.name || via.dependency || pkg,
        severity,
      });
    }
  }
  return found;
}

function reachesAccepted(name, accepted, vulns, seen = new Set()) {
  if (accepted.has(name)) return true;
  if (seen.has(name)) return false;
  seen.add(name);
  for (const via of vulns[name]?.via || []) {
    if (typeof via === "string" && reachesAccepted(via, accepted, vulns, seen)) return true;
  }
  return false;
}

export function evaluateAudit(report, allowlist, today = todayString()) {
  const entries = loadAllowlist(allowlist);
  const vulns = report?.vulnerabilities && typeof report.vulnerabilities === "object" ? report.vulnerabilities : null;
  if (!vulns) {
    return { ok: false, warnings: [], errors: ["npm audit JSON has no vulnerabilities object"] };
  }

  const warnings = [];
  const errors = [];
  const accepted = new Set();

  for (const advisory of directAdvisories(vulns)) {
    if (!advisory.id) {
      errors.push(`${advisory.package} is ${advisory.severity} without a GHSA id`);
      continue;
    }
    const entry = entries.find((item) => item.id === advisory.id && item.package === advisory.package);
    if (!entry) {
      errors.push(`${advisory.severity} advisory ${advisory.id} (${advisory.package}) is not allowlisted`);
      continue;
    }
    if (today > entry.review_by) {
      errors.push(
        `${entry.id} (${entry.package}) expired on ${entry.review_by}; owner ${entry.owner} must review`,
      );
      continue;
    }
    const paths = upwardPaths(vulns, advisory.package);
    const blocked = paths.filter((segments) => !segments.includes(entry.path));
    if (paths.length === 0 || blocked.length > 0) {
      errors.push(
        `${entry.id} (${entry.package}) is not only reached through ${entry.path}`,
      );
      continue;
    }
    accepted.add(advisory.package);
    warnings.push(
      `${entry.id} (${entry.package}) через ${entry.path} разрешён до ${entry.review_by}: ${entry.reason}. Владелец: ${entry.owner}.`,
    );
  }

  for (const [name, vuln] of Object.entries(vulns)) {
    if (!BLOCKING.has(String(vuln?.severity || "").toLowerCase())) continue;
    const hasDirect = (vuln.via || []).some((via) => via && typeof via === "object" && BLOCKING.has(severityOf(via, vuln)));
    if (hasDirect) continue;
    if (!reachesAccepted(name, accepted, vulns)) {
      errors.push(`${name} is ${vuln.severity} without an allowlisted advisory`);
    }
  }

  return { ok: errors.length === 0, warnings, errors };
}

function isCli() {
  const entry = process.argv[1];
  return Boolean(entry) && import.meta.url === pathToFileURL(entry).href;
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

if (isCli()) {
  try {
    const allowlistPath = process.argv[2]
      ? process.argv[2]
      : new URL("../.github/audit-allowlist.json", import.meta.url);
    const allowlist = JSON.parse(readFileSync(allowlistPath, "utf8"));
    const raw = await readStdin();
    const report = JSON.parse(raw);
    const result = evaluateAudit(report, allowlist);
    for (const warning of result.warnings) {
      console.log(`::warning::${warning}`);
      if (process.env.GITHUB_STEP_SUMMARY) {
        appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${warning}\n`);
      }
    }
    for (const error of result.errors) console.error(error);
    process.exit(result.ok ? 0 : 1);
  } catch (err) {
    console.error(err instanceof Error ? err.message : "audit allowlist failed");
    process.exit(1);
  }
}
