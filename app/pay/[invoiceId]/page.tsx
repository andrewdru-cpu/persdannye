import type { Metadata } from "next";
import { PayInvoiceScreen } from "@/components/pay/PayScreens";
import { loadInvoice } from "@/lib/pay-invoice";
import { isInvoiceId } from "@/lib/pay-public";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Оплата",
  robots: { index: false, follow: false },
};

export default async function PayInvoicePage({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  const { invoiceId } = await params;
  if (!isInvoiceId(invoiceId)) {
    return <PayInvoiceScreen result={{ ok: false, reason: "invalid" }} />;
  }
  return <PayInvoiceScreen result={await loadInvoice(invoiceId)} />;
}
