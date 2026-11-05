import Link from "next/link";
import { PayCheckout } from "@/components/pay/PayCheckout";
import { offerHref, recurringConsent } from "@/lib/pay-offer";
import { formatInvoiceAmount, type InvoiceLoad } from "@/lib/pay-public";
import { configuredRequisites, npdNameAndInn } from "@/lib/requisites-guard";
import { publicContactEmail } from "@/lib/support-email";

const linkClass = "text-amber-300 hover:underline";

function recipientLine(): string | null {
  const identity = npdNameAndInn(configuredRequisites());
  if (!identity) return null;
  return `${identity.legalName}, плательщик налога на профессиональный доход, ИНН ${identity.inn}`;
}

export function PayInvoiceScreen({ result }: { result: InvoiceLoad }) {
  if (!result.ok) {
    const text =
      result.reason === "not_found"
        ? "Счёт не найден"
        : result.reason === "invalid"
          ? "Ссылка на счёт недействительна"
          : "Счёт сейчас недоступен";
    return (
      <article className="mx-auto max-w-3xl px-4 py-14 md:px-6 md:py-20">
        <h1 className="text-3xl font-semibold text-white md:text-4xl">Оплата</h1>
        <p className="mt-4 text-sm leading-relaxed text-white/80">{text}</p>
      </article>
    );
  }

  const { invoice } = result;
  const recipient = recipientLine();
  const href = offerHref(invoice);
  const payable = invoice.status === "open";

  return (
    <article className="mx-auto max-w-3xl px-4 py-14 md:px-6 md:py-20">
      <h1 className="text-3xl font-semibold text-white md:text-4xl">Оплата счёта</h1>
      <p className="mt-6 text-lg text-white">{invoice.title}</p>
      <p className="mt-2 text-sm text-white/80">Сумма: {formatInvoiceAmount(invoice.amount)}</p>
      {recipient ? <p className="mt-4 text-sm text-white/80">Получатель: {recipient}</p> : null}
      <p className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <Link href={href} className={linkClass}>
          Оферта
        </Link>
        <Link href="/privacy" className={linkClass}>
          Политика обработки ПДн
        </Link>
      </p>
      {invoice.status === "paid" ? <p className="mt-8 text-sm text-white/80">Счёт оплачен</p> : null}
      {invoice.status === "expired" ? <p className="mt-8 text-sm text-white/80">Срок оплаты истёк</p> : null}
      {payable ? (
        <PayCheckout invoiceId={invoice.id} offerHref={href} recurring={recurringConsent(invoice)} />
      ) : null}
    </article>
  );
}

export function PaySuccessScreen() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-14 md:px-6 md:py-20">
      <h1 className="text-3xl font-semibold text-white md:text-4xl">Платёж получен, подтверждение придёт на email</h1>
    </article>
  );
}

export function PayFailScreen({ invoiceId }: { invoiceId: string | null }) {
  const email = publicContactEmail();
  return (
    <article className="mx-auto max-w-3xl px-4 py-14 md:px-6 md:py-20">
      <h1 className="text-3xl font-semibold text-white md:text-4xl">Оплата не прошла</h1>
      {invoiceId ? (
        <p className="mt-6 text-sm">
          <Link href={`/pay/${invoiceId}`} className={linkClass}>
            Попробовать снова
          </Link>
        </p>
      ) : (
        <p className="mt-6 text-sm leading-relaxed text-white/80">
          Попробовать снова можно по ссылке на счёт из письма.
        </p>
      )}
      <p className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        {email ? (
          <a className={linkClass} href={`mailto:${email}`}>
            {email}
          </a>
        ) : null}
        <Link href="/contacts" className={linkClass}>
          Контакты
        </Link>
        <Link href="/privacy" className={linkClass}>
          Политика обработки ПДн
        </Link>
      </p>
    </article>
  );
}
