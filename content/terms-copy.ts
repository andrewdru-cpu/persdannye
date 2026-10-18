import { flags } from "./flags";

/** «бесплатного» убрать, если экспресс-проверка перестанет быть бесплатной. */
export function termsSubjectSentence(input: {
  legalName: string | null;
  idLine: string | null;
  website: string | null;
}): string {
  const name = input.legalName?.trim() ?? "";
  const idLine = input.idLine?.trim() ?? "";
  const website = input.website?.trim() ?? "";
  const who = [name, idLine ? `(${idLine})` : ""].filter(Boolean).join(" ");
  const between = who ? `${who} ` : "";
  const site = website ? ` ${website}` : "";
  return `Настоящее соглашение заключается между ${between}(далее — Оператор) и пользователем и регулирует использование сайта${site} и бесплатного сервиса экспресс-проверки сайтов на признаки несоответствия требованиям 152-ФЗ и практике Роскомнадзора (далее — Сервис).`;
}

export const TERMS_LIABILITY =
  "Сервис предоставляется «как есть». В пределах, допускаемых законодательством РФ, в том числе Законом РФ «О защите прав потребителей», Оператор не отвечает за временную недоступность Сервиса, неполноту автоматической проверки, изменения на сайте пользователя после сканирования, а также за убытки, возникшие вследствие решений, принятых исключительно на основе экспресс-отчёта.";

export function scanTermsNotice(
  buttonLabel: string,
  showTerms: boolean = flags.show_terms,
): { before: string; href: "/terms"; linkText: "Пользовательское соглашение" } | null {
  if (!showTerms) return null;
  const label = buttonLabel.trim();
  if (!label) return null;
  return {
    before: `Нажимая «${label}», вы принимаете `,
    href: "/terms",
    linkText: "Пользовательское соглашение",
  };
}
