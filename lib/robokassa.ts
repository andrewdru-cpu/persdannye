import { createHash } from "node:crypto";

/**
 * Подпись старта оплаты Robokassa паролем №1.
 * Пароль №2 этот модуль не читает: ResultURL проверяет парсер
 * (https://api.scanweb.pro/api/pay/robokassa/result).
 *
 * Строка подписи по документации:
 * MerchantLogin:OutSum:InvId:Пароль#1:Shp_key=value
 * Shp_* сортируются по имени. Модификаторов (Receipt, ResultUrl2 и др.) нет.
 */

export const ROBOKASSA_PAY_URL = "https://auth.robokassa.ru/Merchant/Index.aspx";

export type RobokassaHash = "md5" | "sha256";

const LOGIN = /^[A-Za-z0-9_-]{1,64}$/;

export type RobokassaSigner = {
  merchantLogin: string;
  password1: string;
  isTest: boolean;
  algorithm: RobokassaHash;
};

function secret(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed || trimmed.length > 128 || /[\r\n]/.test(trimmed)) return null;
  return trimmed;
}

/** null — оплата выключена или нет логина и пароля №1 для выбранного режима. */
export function robokassaSigner(): RobokassaSigner | null {
  if (process.env.ROBOKASSA_PAY_ENABLED !== "true") return null;
  const merchantLogin = process.env.ROBOKASSA_MERCHANT_LOGIN?.trim() ?? "";
  if (!LOGIN.test(merchantLogin)) return null;
  const isTest = process.env.ROBOKASSA_IS_TEST === "1";
  const password1 = secret(isTest ? process.env.ROBOKASSA_TEST_PASS1 : process.env.ROBOKASSA_PASS1);
  if (!password1) return null;
  const hash = (process.env.ROBOKASSA_HASH?.trim().toLowerCase() || "md5") as string;
  if (hash !== "md5" && hash !== "sha256") return null;
  return { merchantLogin, password1, isTest, algorithm: hash };
}

export function paymentSignature(input: {
  merchantLogin: string;
  outSum: string;
  invId: string;
  password: string;
  algorithm: RobokassaHash;
  shp: Record<string, string>;
}): string {
  const shp = Object.keys(input.shp)
    .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0))
    .map((key) => `${key}=${input.shp[key]}`);
  const base = [input.merchantLogin, input.outSum, input.invId, input.password, ...shp].join(":");
  return createHash(input.algorithm).update(base, "utf8").digest("hex");
}

export function robokassaPaymentUrl(input: {
  merchantLogin: string;
  outSum: string;
  invId: string;
  invoiceId: string;
  description: string;
  password: string;
  algorithm: RobokassaHash;
  isTest: boolean;
  recurring: boolean;
}): string {
  const description = input.description.replace(/[\u0000-\u001F<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, 100);
  const signature = paymentSignature({
    merchantLogin: input.merchantLogin,
    outSum: input.outSum,
    invId: input.invId,
    password: input.password,
    algorithm: input.algorithm,
    shp: { Shp_invoiceId: input.invoiceId },
  });
  const url = new URL(ROBOKASSA_PAY_URL);
  url.searchParams.set("MerchantLogin", input.merchantLogin);
  url.searchParams.set("OutSum", input.outSum);
  url.searchParams.set("InvId", input.invId);
  url.searchParams.set("Description", description || "Оплата счёта");
  url.searchParams.set("SignatureValue", signature);
  url.searchParams.set("Shp_invoiceId", input.invoiceId);
  url.searchParams.set("Culture", "ru");
  url.searchParams.set("Encoding", "utf-8");
  if (input.isTest) url.searchParams.set("IsTest", "1");
  if (input.recurring) url.searchParams.set("Recurring", "true");
  return url.toString();
}
