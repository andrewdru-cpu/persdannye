import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { company, privacyContactLabel, PRIVACY_CONTACT_TODO } from "../lib/company";

const root = path.resolve(import.meta.dirname, "..");
const forbidden = ["dpo@", "persdannye.ru"].join("");

function sourceFiles(dir: string, found: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next" || entry.name === ".git") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, found);
    else if (/\.(ts|tsx|js|mjs|md|json|example|html|txt)$/.test(entry.name)) found.push(full);
  }
  return found;
}

test("privacy contact is one empty config value and the placeholder address is gone", () => {
  assert.equal(company.privacy_contact_email, "");
  assert.equal("dpoEmail" in company, false);
  assert.equal(privacyContactLabel("", "production"), null);
  assert.equal(privacyContactLabel("", "development"), null);
  assert.equal(privacyContactLabel("", undefined), null);
  assert.equal(privacyContactLabel("  ", "preview"), PRIVACY_CONTACT_TODO);
  assert.equal(privacyContactLabel("", "preview"), "TODO: privacy_contact_email");
  assert.equal(privacyContactLabel(" privacy@example.com ", "production"), "privacy@example.com");

  const hits = sourceFiles(root).filter((file) => fs.readFileSync(file, "utf8").includes(forbidden));
  assert.deepEqual(hits, []);
});
