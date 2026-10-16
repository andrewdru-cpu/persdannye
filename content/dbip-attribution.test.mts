import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { notFound } from "next/navigation.js";
import { DbipAttribution, renderSourcesPage } from "../components/layout/dbip-view.ts";
import { flags } from "./flags.ts";
import { visibleFooterDocuments } from "./legal-nav.ts";
import { runAxe } from "./run-axe.mjs";
import { DBIP_SOURCES_LABEL, DBIP_SOURCES_PATH } from "../lib/dbip-attribution.ts";

const verbatim =
  "Данные о стране и сети IP-адресов: IP Geolocation by DB-IP, лицензия CC BY 4.0";

const attributionHrefs = ["https://db-ip.com", "https://creativecommons.org/licenses/by/4.0/"];

function withFlag<T>(value: boolean, run: () => T): T {
  const previous = flags.show_dbip_attribution;
  flags.show_dbip_attribution = value;
  try {
    return run();
  } finally {
    flags.show_dbip_attribution = previous;
  }
}

function textOf(html: string): string {
  return html.replace(/<[^>]+>/g, "");
}

function hrefsOf(html: string): string[] {
  return [...html.matchAll(/href="([^"]*)"/g)].map((match) => match[1]);
}

function markup(node: ReactNode): string {
  return renderToStaticMarkup(node);
}

function documentsMarkup(className?: string): string {
  return renderToStaticMarkup(
    createElement(
      "ul",
      className ? { className } : null,
      visibleFooterDocuments().map((item) =>
        createElement(
          "li",
          { key: item.href },
          createElement("a", { href: item.href, className: "hover:text-amber-300" }, item.label),
        ),
      ),
    ),
  );
}

describe("DB-IP attribution flag", () => {
  it("hides the footer line and the sources link when the flag is off, and the page is a 404", () => {
    withFlag(false, () => {
      const line = markup(createElement(DbipAttribution));
      const documents = documentsMarkup();
      assert.equal(line, "");
      assert.equal(line.includes(verbatim), false);
      assert.equal(line.includes("db-ip.com"), false);
      assert.equal(documents.includes(DBIP_SOURCES_PATH), false);
      assert.equal(documents.includes(DBIP_SOURCES_LABEL), false);
      assert.equal(visibleFooterDocuments().some((item) => item.href === DBIP_SOURCES_PATH), false);
      assert.throws(
        () => renderSourcesPage(notFound),
        (error: Error & { digest?: string }) => error.digest === "NEXT_HTTP_ERROR_FALLBACK;404",
      );
    });
  });

  it("shows the footer line, the sources link, and the sources page when the flag is on", () => {
    withFlag(true, () => {
      const line = markup(createElement(DbipAttribution));
      const documents = documentsMarkup();
      const page = markup(renderSourcesPage(notFound));
      assert.equal(textOf(line), verbatim);
      assert.equal(textOf(line).endsWith("."), false);
      assert.deepEqual(hrefsOf(line), attributionHrefs);
      assert.equal(line.includes('rel="noopener noreferrer"'), true);
      assert.equal(documents.includes(`href="${DBIP_SOURCES_PATH}"`), true);
      assert.equal(documents.includes(DBIP_SOURCES_LABEL), true);
      assert.equal(page.includes(line), true);
      assert.equal(textOf(line), verbatim);
      assert.equal(page.includes("<h1"), true);
      assert.equal(page.includes(DBIP_SOURCES_LABEL), true);
      assert.deepEqual(hrefsOf(page), attributionHrefs);
    });
  });

  it("wires the footer and the sources route to the same flag", () => {
    const footer = readFileSync(new URL("../components/layout/Footer.tsx", import.meta.url), "utf8");
    const page = readFileSync(new URL("../app/sources/page.tsx", import.meta.url), "utf8");
    assert.equal(footer.includes("<DbipAttribution />"), true);
    assert.equal(footer.includes("visibleFooterDocuments()"), true);
    assert.equal(page.includes("if (!dbipAttributionEnabled()) notFound()"), true);
    assert.equal(page.includes("return sourcesArticle()"), true);
  });

  it("has no axe violations on the sources page and the footer attribution", async () => {
    const body = withFlag(true, () => {
      const article = markup(renderSourcesPage(notFound));
      const line = markup(createElement(DbipAttribution));
      const documents = documentsMarkup("text-sm text-white/80");
      return `<a class="skip-link" href="#content">К содержанию</a>
<main id="content">${article}</main>
<footer class="bg-ink-975">
  ${documents}
  <div class="mx-auto max-w-3xl space-y-3 text-left text-xs leading-relaxed text-white/70" role="note">${line}</div>
</footer>`;
    });
    const violations = await runAxe(body);
    assert.deepEqual(
      violations,
      [],
      violations.map((item: { id: string; nodes: string[] }) => `${item.id}: ${item.nodes.join(" | ")}`).join("\n"),
    );
  });
});
