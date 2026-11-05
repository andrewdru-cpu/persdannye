import type { Metadata } from "next";
import { SubscriptionOffer } from "@/components/legal/SubscriptionOffer";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Оферта",
  robots: { index: false, follow: false },
};

/** Тот же текст, что на /subscription. В меню отдельно не добавляется. */
export default function OfferPage() {
  return <SubscriptionOffer />;
}
