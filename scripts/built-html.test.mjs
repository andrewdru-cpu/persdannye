import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

function builtPage(name) {
  const file = path.resolve(".next/server/app", name);
  assert.equal(fs.existsSync(file), true, `${file} missing; run npm run build before this test`);
  return fs.readFileSync(file, "utf8");
}

test("built /consent-lead is noindex and does not publish the consent text", () => {
  const html = builtPage("consent-lead.html");
  assert.match(html, /noindex/);
  assert.match(html, /nofollow/);
  assert.match(html, /Текст не опубликован/);
  assert.equal(html.includes("действуя свободно"), false);
  assert.equal(html.includes("{{"), false);
});

test("built /consent-marketing is noindex and has no shortened consent text", () => {
  const html = builtPage("consent-marketing.html");
  assert.match(html, /noindex/);
  assert.match(html, /nofollow/);
  assert.match(html, /Текст не опубликован/);
  assert.equal(html.includes("действуя свободно"), false);
  assert.equal(html.includes("Согласие необязательно и не влияет"), false);
  assert.equal(html.includes("{{"), false);
});
