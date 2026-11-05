import type { Metadata } from "next";
import { PayFailScreen } from "@/components/pay/PayScreens";
import { isInvoiceId } from "@/lib/pay-public";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Оплата не прошла",
  robots: { index: false, follow: false },
};

function first(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !isInvoiceId(raw)) return null;
  return raw;
}

export default async function PayFailPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  return <PayFailScreen invoiceId={first(params.Shp_invoiceId) ?? first(params.invoice)} />;
}
