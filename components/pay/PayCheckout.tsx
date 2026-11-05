"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { monthlyRecurringCharge } from "@/content/pay-placeholders";
import { formatInvoiceAmount } from "@/lib/pay-public";
import type { RecurringConsent } from "@/lib/pay-offer";

type Props = {
  invoiceId: string;
  offerHref: string;
  recurring: RecurringConsent | null;
};

function messageFor(status: number, error: string): string {
  if (status === 503 && error === "disabled") return "Оплата сейчас недоступна";
  if (status === 409) return "Этот счёт нельзя оплатить";
  if (status === 404) return "Счёт не найден";
  if (error === "offer_required") return "Отметьте согласие с офертой";
  if (error === "recurring_unavailable") return "Автосписание для этого счёта недоступно";
  return "Не удалось перейти к оплате";
}

function recurringCharge(recurring: RecurringConsent): { phrase: string; planName: string } {
  const monthly = monthlyRecurringCharge(recurring.period);
  if (monthly) return monthly;
  return {
    phrase: `${formatInvoiceAmount(recurring.amount)} раз в ${recurring.period}`,
    planName: recurring.planName,
  };
}

export function PayCheckout({ invoiceId, offerHref, recurring }: Props) {
  const charge = recurring ? recurringCharge(recurring) : null;
  const [offer, setOffer] = useState(false);
  const [recurringOn, setRecurringOn] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!offer || pending) return;
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/pay/robokassa/init", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          invoiceId,
          acceptOffer: true,
          acceptRecurring: Boolean(recurring && recurringOn),
        }),
      });
      const payload = (await response.json()) as { url?: unknown; error?: unknown };
      if (response.ok && typeof payload.url === "string" && payload.url.startsWith("https://auth.robokassa.ru/")) {
        window.location.assign(payload.url);
        return;
      }
      const error = typeof payload.error === "string" ? payload.error : "";
      setMessage(messageFor(response.status, error));
    } catch {
      setMessage("Не удалось перейти к оплате");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-5">
      <label className="flex items-start gap-3 text-sm leading-relaxed text-white/85">
        <input
          type="checkbox"
          name="acceptOffer"
          required
          checked={offer}
          onChange={(event) => setOffer(event.target.checked)}
          className="mt-1 h-4 w-4 accent-amber-300"
        />
        <span>
          Принимаю{" "}
          <Link href={offerHref} className="text-amber-300 hover:underline">
            оферту
          </Link>
        </span>
      </label>

      {recurring ? (
        <label className="flex items-start gap-3 text-sm leading-relaxed text-white/85">
          <input
            type="checkbox"
            name="acceptRecurring"
            checked={recurringOn}
            onChange={(event) => setRecurringOn(event.target.checked)}
            className="mt-1 h-4 w-4 accent-amber-300"
          />
          <span>
            Я соглашаюсь, что {recurring.fio} (плательщик НПД, ИНН {recurring.inn}) через Робокассу будет
            автоматически списывать с моей банковской карты{" "}
            <strong className="text-white/90">{charge?.phrase}</strong> за подписку «{charge?.planName}», пока я её не
            отменю. Первое списание — сегодня, следующее — {recurring.nextChargeDate}. Я получу напоминание на e-mail не
            позднее чем за 3 дня до каждого списания. Отменить подписку и отвязать карту можно в любой момент одной
            кнопкой в кабинете («Оплата» → «Отменить подписку и отвязать карту»)
            {recurring.email ? ` или письмом на ${recurring.email}` : ""}. Условия — в{" "}
            <Link href="/subscription" className="text-amber-300 hover:underline">
              оферте на подписку
            </Link>
            .
          </span>
        </label>
      ) : null}

      <button
        type="submit"
        disabled={!offer || pending}
        className="btn-gold min-h-12 rounded-2xl px-7 py-3.5 text-base font-semibold disabled:cursor-not-allowed disabled:opacity-50"
      >
        Оплатить
      </button>
      {message ? (
        <p role="alert" className="text-sm text-white/80">
          {message}
        </p>
      ) : null}
    </form>
  );
}
