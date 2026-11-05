import type { Metadata } from "next";
import { RefundPolicy } from "@/components/legal/RefundPolicy";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Возврат",
  robots: { index: false, follow: false },
};

export default function RefundPage() {
  return <RefundPolicy />;
}
