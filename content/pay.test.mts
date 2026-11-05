import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, it, mock } from "node:test";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { POST as postInit } from "../app/api/pay/robokassa/init/route.ts";
import ContactsPage from "../app/contacts/page.tsx";
import * as failPage from "../app/pay/fail/page.tsx";
import * as invoicePage from "../app/pay/[invoiceId]/page.tsx";
import * as successPage from "../app/pay/success/page.tsx";
import * as offerPage from "../app/offer/page.tsx";
import * as oneTimePage from "../app/offer/one-time/page.tsx";
import * as refundPage from "../app/refund/page.tsx";
import * as subscriptionPage from "../app/subscription/page.tsx";
import { OneTimeOffer } from "../components/legal/OneTimeOffer.tsx";
import { RefundPolicy } from "../components/legal/RefundPolicy.tsx";
import { SubscriptionOffer } from "../components/legal/SubscriptionOffer.tsx";
import { Footer } from "../components/layout/Footer.tsx";
import { PayFailScreen, PayInvoiceScreen, PaySuccessScreen } from "../components/pay/PayScreens.tsx";
import { payPlaceholders, publishedPrice } from "./pay-placeholders.ts";
import { flags } from "./flags.ts";
import { collectionEnabled } from "../lib/collection-gate.ts";
import { loadInvoice } from "../lib/pay-invoice.ts";
import { paymentSignature } from "../lib/robokassa.ts";
import type { PayInvoice } from "../lib/pay-public.ts";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const INVOICE_ID = "previewinvoiceid000001";
const PASSWORD = "primer-parol-1";
const TOKEN = "parser-token-not-a-password";
const PAYER_EMAIL = "payer@example.com";

const envKeys = [
  "OPERATOR_FIO",
  "OPERATOR_INN",
  "SUPPORT_EMAIL",
  "VERCEL_ENV",
  "PD_COLLECTION_ENABLED",
  "ROBOKASSA_PAY_ENABLED",
  "ROBOKASSA_MERCHANT_LOGIN",
  "ROBOKASSA_PASS1",
  "ROBOKASSA_TEST_PASS1",
  "ROBOKASSA_IS_TEST",
  "ROBOKASSA_HASH",
  "ROBOKASSA_PASS2",
  "ROBOKASSA_TEST_PASS2",
  "NEXT_PUBLIC_ROBOKASSA_RECURRING",
  "PAY_INVOICE_STUB",
  "PAY_INVOICE_STUB_ID",
  "PAY_INVOICE_STUB_INV_ID",
  "PAY_INVOICE_STUB_TITLE",
  "PAY_INVOICE_STUB_AMOUNT",
  "PAY_INVOICE_STUB_STATUS",
  "PAY_INVOICE_STUB_PAYER",
  "PAY_INVOICE_STUB_PLAN",
  "PAY_INVOICE_STUB_PERIOD",
  "PAY_INVOICE_STUB_NEXT",
  "PARSER_API_BASE",
  "PARSER_API_TOKEN",
] as const;

const savedEnv = new Map(envKeys.map((key) => [key, process.env[key]]));
const savedRecurring = flags.robokassa_recurring;
const savedPrices = flags.show_prices;
const savedSiteLegal = flags.show_site_legal;

function restoreEnv() {
  for (const key of envKeys) {
    const value = savedEnv.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  flags.robokassa_recurring = savedRecurring;
  flags.show_prices = savedPrices;
  flags.show_site_legal = savedSiteLegal;
}

function clearPayEnv() {
  for (const key of envKeys) delete process.env[key];
  flags.robokassa_recurring = false;
  flags.show_prices = false;
  flags.show_site_legal = false;
}

function html(node: ReactNode): string {
  return renderToStaticMarkup(node);
}

function invoice(overrides: Partial<PayInvoice> = {}): PayInvoice {
  return {
    id: INVOICE_ID,
    invId: "450009",
    title: "Разовая проверка сайта",
    amount: "100.00",
    currency: "RUB",
    status: "open",
    payer: "person",
    subscription: null,
    ...overrides,
  };
}

function enableStub(extra: Record<string, string> = {}) {
  process.env.PAY_INVOICE_STUB = "true";
  process.env.PAY_INVOICE_STUB_ID = INVOICE_ID;
  process.env.PAY_INVOICE_STUB_INV_ID = "450009";
  process.env.PAY_INVOICE_STUB_TITLE = "Разовая проверка сайта";
  process.env.PAY_INVOICE_STUB_AMOUNT = "100.00";
  process.env.PAY_INVOICE_STUB_STATUS = "open";
  process.env.PAY_INVOICE_STUB_PAYER = "person";
  for (const [key, value] of Object.entries(extra)) process.env[key] = value;
}

function initRequest(body: unknown) {
  return new Request("http://localhost/api/pay/robokassa/init", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("robokassa draft", { concurrency: false }, () => {
  afterEach(() => {
    restoreEnv();
    mock.restoreAll();
  });

  it("keeps prices, collection and recurring off", () => {
    clearPayEnv();
    assert.equal(flags.show_prices, false);
    assert.equal(flags.show_site_legal, false);
    assert.equal(flags.robokassa_recurring, false);
    assert.equal(collectionEnabled(), false);
    for (const value of Object.values(payPlaceholders)) assert.equal(value, "");
    assert.equal(publishedPrice(false, "100.00"), null);
    assert.equal(publishedPrice(true, ""), null);
    assert.equal(publishedPrice(true, "100.00"), "100.00");
    const example = readFileSync(path.join(root, ".env.example"), "utf8");
    assert.equal(/^\s*PD_COLLECTION_ENABLED\s*=/m.test(example), false);
    assert.equal(/^\s*ROBOKASSA_PASS2\s*=/m.test(example), false);
    assert.equal(/^\s*ROBOKASSA_TEST_PASS2\s*=/m.test(example), false);
    assert.match(example, /PASS2/);
    assert.match(example, /https:\/\/api\.scanweb\.pro\/api\/pay\/robokassa\/result/);
    assert.match(example, /https:\/\/scanweb\.pro\/pay\/success/);
    assert.match(example, /https:\/\/scanweb\.pro\/pay\/fail/);
    assert.match(example, /^ROBOKASSA_MERCHANT_LOGIN=$/m);
    assert.match(example, /^ROBOKASSA_PASS1=$/m);
    assert.match(example, /^ROBOKASSA_TEST_PASS1=$/m);
    assert.match(example, /^ROBOKASSA_IS_TEST=1$/m);
    assert.equal(existsSync(path.join(root, "app/api/pay/robokassa/result/route.ts")), false);
    const sources = [
      "lib/robokassa.ts",
      "lib/pay-invoice.ts",
      "lib/pay-offer.ts",
      "lib/pay-public.ts",
      "app/api/pay/robokassa/init/route.ts",
    ]
      .map((file) => readFileSync(path.join(root, file), "utf8"))
      .join("\n");
    assert.equal(sources.includes("ROBOKASSA_PASS2"), false);
    assert.equal(sources.includes("ROBOKASSA_TEST_PASS2"), false);
    const header = readFileSync(path.join(root, "components/layout/Header.tsx"), "utf8");
    const footerNav = readFileSync(path.join(root, "content/footer-nav.ts"), "utf8");
    assert.equal(header.includes("/pay"), false);
    assert.equal(footerNav.includes("/pay"), false);
    assert.equal(footerNav.includes("/subscription"), false);
    assert.equal(footerNav.includes("/refund"), false);
    assert.equal(footerNav.includes("/contacts"), false);
  });

  it("renders legal and pay pages without TODO, prices, or a phone", () => {
    clearPayEnv();
    const pages = [
      html(SubscriptionOffer()),
      html(OneTimeOffer()),
      html(RefundPolicy()),
      html(ContactsPage()),
      html(PaySuccessScreen()),
      html(PayFailScreen({ invoiceId: null })),
    ].join("\n");
    assert.match(pages, /Оферта на подписку/);
    assert.match(pages, /Экспресс-проверка не заменяет юридическое заключение/);
    assert.match(pages, /Автоматические списания — только с отдельного согласия/);
    assert.match(pages, /Только по счёту/);
    assert.match(pages, /Отменить подписку и отвязать карту/);
    assert.match(pages, /Пользовательское соглашение и публичная оферта/);
    assert.match(pages, /не является юридической консультацией/);
    assert.match(pages, /Политика возврата денежных средств/);
    assert.match(pages, /пропорционально неиспользованным полным дням/);
    assert.match(pages, /href="\/privacy"/);
    assert.match(pages, /href="\/subscription"/);
    assert.match(pages, /href="\/offer\/one-time"/);
    assert.match(pages, /href="\/refund"/);
    assert.match(pages, /Платёж получен, подтверждение придёт на email/);
    assert.match(pages, /Оплата не прошла/);
    assert.match(pages, /Попробовать снова/);
    assert.equal(pages.includes("TODO:"), false);
    assert.equal(pages.includes("{{"), false);
    assert.equal(pages.includes("₽"), false);
    assert.equal(pages.includes("УТОЧНИТЬ"), false);
    assert.equal(pages.includes("ПРОЕКТ"), false);
    assert.equal(pages.includes("НЕ ПОДТВЕРЖДЕНО"), false);
    assert.equal(pages.includes("+7"), false);
    assert.equal(pages.includes("тел."), false);
    assert.equal(pages.includes("тариф активир"), false);
    const contacts = html(ContactsPage());
    assert.equal(contacts.includes("ИНН"), false);
    assert.equal(contacts.includes("ОГРН"), false);
    assert.equal(contacts.includes("ООО"), false);
    assert.equal(contacts.includes("ИП"), false);
    assert.equal(contacts.includes("компания"), false);
    assert.equal(contacts.includes("адрес"), false);
    assert.equal(contacts.includes("телефон"), false);
    assert.match(contacts, /href="\/privacy"/);
    const footer = html(Footer());
    assert.equal(footer.includes('href="/pay'), false);
    assert.equal(footer.includes('href="/subscription"'), false);
    assert.equal(footer.includes('href="/refund"'), false);
    assert.equal(footer.includes('href="/contacts"'), false);
    assert.equal(footer.includes('href="/offer/one-time"'), false);
    assert.deepEqual(successPage.metadata.robots, { index: false, follow: false });
    assert.deepEqual(failPage.metadata.robots, { index: false, follow: false });
    assert.deepEqual(invoicePage.metadata.robots, { index: false, follow: false });
    assert.deepEqual(offerPage.metadata.robots, { index: false, follow: false });
    assert.deepEqual(oneTimePage.metadata.robots, { index: false, follow: false });
    assert.deepEqual(refundPage.metadata.robots, { index: false, follow: false });
    assert.deepEqual(subscriptionPage.metadata.robots, { index: false, follow: false });
  });

  it("shows the invoice amount and hides recurring until the flag is on for a person", () => {
    clearPayEnv();
    const open = html(PayInvoiceScreen({ result: { ok: true, invoice: invoice() } }));
    assert.match(open, /Разовая проверка сайта/);
    assert.match(open, /100,00 ₽/);
    assert.match(open, /Принимаю/);
    assert.match(open, /оферту/);
    assert.match(open, /href="\/offer\/one-time"/);
    assert.match(open, /href="\/privacy"/);
    assert.match(open, /Оплатить/);
    assert.match(open, /name="acceptOffer"/);
    assert.match(open, /required/);
    assert.equal(open.includes("name=\"acceptRecurring\""), false);
    assert.equal(open.includes("автоматически списывать"), false);
    assert.equal(open.includes("Получатель"), false);
    assert.equal(open.includes("TODO:"), false);
    assert.equal(open.includes("9,00"), false);

    const paid = html(PayInvoiceScreen({ result: { ok: true, invoice: invoice({ status: "paid" }) } }));
    assert.match(paid, /Счёт оплачен/);
    assert.equal(paid.includes("Оплатить"), false);
    assert.equal(paid.includes("<form"), false);

    const expired = html(PayInvoiceScreen({ result: { ok: true, invoice: invoice({ status: "expired" }) } }));
    assert.match(expired, /Срок оплаты истёк/);
    assert.equal(expired.includes("Оплатить"), false);

    process.env.NEXT_PUBLIC_ROBOKASSA_RECURRING = "true";
    process.env.OPERATOR_FIO = "Пример Пример Пример";
    process.env.OPERATOR_INN = "109876543252";
    const org = html(
      PayInvoiceScreen({
        result: {
          ok: true,
          invoice: invoice({
            payer: "org",
            subscription: { planName: "Наблюдение", period: "месяц", nextChargeDate: "2026-12-05" },
          }),
        },
      }),
    );
    assert.equal(org.includes("name=\"acceptRecurring\""), false);
    assert.match(org, /Получатель: Пример Пример Пример, плательщик налога на профессиональный доход, ИНН 109876543252/);

    const person = html(
      PayInvoiceScreen({
        result: {
          ok: true,
          invoice: invoice({
            subscription: { planName: "Наблюдение", period: "месяц", nextChargeDate: "2026-12-05" },
          }),
        },
      }),
    );
    assert.match(person, /name="acceptRecurring"/);
    assert.match(person, /автоматически списывать/);
    assert.match(person, /100,00 ₽ раз в месяц/);
    assert.match(person, /подписку «Наблюдение»/);
    assert.match(person, /href="\/subscription"/);
    assert.equal(person.includes("checked"), false);
    assert.equal(person.includes("TODO:"), false);

    delete process.env.OPERATOR_FIO;
    delete process.env.OPERATOR_INN;
    const nameless = html(
      PayInvoiceScreen({
        result: {
          ok: true,
          invoice: invoice({
            subscription: { planName: "Наблюдение", period: "месяц", nextChargeDate: "2026-12-05" },
          }),
        },
      }),
    );
    assert.equal(nameless.includes("name=\"acceptRecurring\""), false);
  });

  it("builds the Robokassa signature with a numeric InvId and Shp_invoiceId", () => {
    assert.equal(
      paymentSignature({
        merchantLogin: "demo",
        outSum: "100.00",
        invId: "450009",
        password: PASSWORD,
        algorithm: "md5",
        shp: { Shp_oplata: "1", Shp_login: "Vasya" },
      }),
      "a5833f7a3ad0d0fbb43935d826865505",
    );
    assert.equal(
      paymentSignature({
        merchantLogin: "demo",
        outSum: "100.00",
        invId: "450009",
        password: PASSWORD,
        algorithm: "sha256",
        shp: { Shp_oplata: "1", Shp_login: "Vasya" },
      }),
      "52c759c5ce8aa9c345cd6da2d39b4cf12e659f763c8161ae960d78b4abe9771e",
    );
  });

  it("returns 503 disabled without keys and does not leak a password", async () => {
    clearPayEnv();
    process.env.ROBOKASSA_PASS1 = PASSWORD;
    process.env.ROBOKASSA_TEST_PASS1 = PASSWORD;
    process.env.ROBOKASSA_PASS2 = "password-two-must-stay-off-the-site";
    const request = initRequest({ invoiceId: INVOICE_ID, acceptOffer: true, amount: "9.00" });
    const response = await postInit(request);
    assert.equal(response.status, 503);
    assert.equal(request.bodyUsed, false);
    const body = await response.text();
    assert.equal(body, JSON.stringify({ error: "disabled" }));
    assert.equal(body.includes(PASSWORD), false);
    assert.equal(body.includes("password-two"), false);

    process.env.ROBOKASSA_PAY_ENABLED = "true";
    process.env.ROBOKASSA_MERCHANT_LOGIN = "demo";
    process.env.ROBOKASSA_IS_TEST = "1";
    delete process.env.ROBOKASSA_TEST_PASS1;
    const missing = await postInit(initRequest({ invoiceId: INVOICE_ID, acceptOffer: true }));
    assert.equal(missing.status, 503);
    assert.equal(await missing.text(), JSON.stringify({ error: "disabled" }));
  });

  it("signs the server invoice and ignores a client amount", async () => {
    clearPayEnv();
    process.env.ROBOKASSA_PAY_ENABLED = "true";
    process.env.ROBOKASSA_MERCHANT_LOGIN = "demo";
    process.env.ROBOKASSA_IS_TEST = "1";
    process.env.ROBOKASSA_TEST_PASS1 = PASSWORD;
    process.env.ROBOKASSA_PASS2 = "password-two-must-stay-off-the-site";
    enableStub();
    const fetchMock = mock.method(globalThis, "fetch", async () => {
      throw new Error("stub must not call the parser");
    });
    const response = await postInit(
      initRequest({
        invoiceId: INVOICE_ID,
        acceptOffer: true,
        acceptRecurring: false,
        amount: "9.00",
        outSum: "9.00",
        email: PAYER_EMAIL,
      }),
    );
    assert.equal(fetchMock.mock.calls.length, 0);
    assert.equal(response.status, 200);
    const payload = (await response.json()) as { url: string };
    const url = new URL(payload.url);
    assert.equal(url.origin, "https://auth.robokassa.ru");
    assert.equal(url.searchParams.get("OutSum"), "100.00");
    assert.equal(url.searchParams.get("InvId"), "450009");
    assert.equal(url.searchParams.get("Shp_invoiceId"), INVOICE_ID);
    assert.equal(url.searchParams.get("IsTest"), "1");
    assert.equal(url.searchParams.get("Recurring"), null);
    const base = `demo:100.00:450009:${PASSWORD}:Shp_invoiceId=${INVOICE_ID}`;
    assert.equal(url.searchParams.get("SignatureValue"), createHash("md5").update(base).digest("hex"));
    assert.equal(payload.url.includes(PASSWORD), false);
    assert.equal(payload.url.includes("password-two"), false);
    assert.equal(payload.url.includes("9.00"), false);
    assert.equal(payload.url.includes(PAYER_EMAIL), false);
  });

  it("adds recurring only for a personal subscription when the flag is on", async () => {
    clearPayEnv();
    process.env.ROBOKASSA_PAY_ENABLED = "true";
    process.env.ROBOKASSA_MERCHANT_LOGIN = "demo";
    process.env.ROBOKASSA_IS_TEST = "1";
    process.env.ROBOKASSA_TEST_PASS1 = PASSWORD;
    process.env.OPERATOR_FIO = "Пример Пример Пример";
    process.env.OPERATOR_INN = "109876543252";
    process.env.NEXT_PUBLIC_ROBOKASSA_RECURRING = "true";
    enableStub({
      PAY_INVOICE_STUB_PAYER: "org",
      PAY_INVOICE_STUB_PLAN: "Наблюдение",
      PAY_INVOICE_STUB_PERIOD: "месяц",
      PAY_INVOICE_STUB_NEXT: "2026-12-05",
    });
    const org = await postInit(initRequest({ invoiceId: INVOICE_ID, acceptOffer: true, acceptRecurring: true }));
    assert.equal(org.status, 400);
    assert.equal(await org.text(), JSON.stringify({ error: "recurring_unavailable" }));

    process.env.PAY_INVOICE_STUB_PAYER = "person";
    delete process.env.NEXT_PUBLIC_ROBOKASSA_RECURRING;
    const hidden = await postInit(initRequest({ invoiceId: INVOICE_ID, acceptOffer: true, acceptRecurring: true }));
    assert.equal(hidden.status, 400);

    process.env.NEXT_PUBLIC_ROBOKASSA_RECURRING = "true";
    const person = await postInit(initRequest({ invoiceId: INVOICE_ID, acceptOffer: true, acceptRecurring: true }));
    assert.equal(person.status, 200);
    const payload = (await person.json()) as { url: string };
    const url = new URL(payload.url);
    assert.equal(url.searchParams.get("Recurring"), "true");
    assert.equal(url.searchParams.get("OutSum"), "100.00");
    assert.equal(payload.url.includes(PASSWORD), false);

    process.env.PAY_INVOICE_STUB_STATUS = "paid";
    const paid = await postInit(initRequest({ invoiceId: INVOICE_ID, acceptOffer: true }));
    assert.equal(paid.status, 409);
    assert.equal((await paid.text()).includes("robokassa"), false);
  });

  it("reads the invoice from the parser and drops payer contacts", async () => {
    clearPayEnv();
    process.env.PARSER_API_BASE = "http://parser.test";
    process.env.PARSER_API_TOKEN = TOKEN;
    let called = "";
    let authorization: string | null = null;
    mock.method(globalThis, "fetch", async (input: unknown, init?: RequestInit) => {
      called = String(input);
      authorization = new Headers(init?.headers).get("authorization");
      return new Response(
        JSON.stringify({
          invoice_id: INVOICE_ID,
          inv_id: 450009,
          title: "Разовая проверка сайта",
          amount: "100.00",
          currency: "RUB",
          status: "open",
          payer: "person",
          email: PAYER_EMAIL,
          phone: "+79990001122",
          subscription: null,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    const loaded = await loadInvoice(INVOICE_ID);
    assert.equal(called, `http://parser.test/api/pay/invoices/${INVOICE_ID}`);
    assert.equal(authorization, `Bearer ${TOKEN}`);
    assert.equal(loaded.ok, true);
    if (!loaded.ok) return;
    assert.equal(loaded.invoice.amount, "100.00");
    assert.equal(loaded.invoice.invId, "450009");
    const dumped = JSON.stringify(loaded);
    assert.equal(dumped.includes(PAYER_EMAIL), false);
    assert.equal(dumped.includes("+79990001122"), false);
    assert.equal(dumped.includes(TOKEN), false);
  });
});
