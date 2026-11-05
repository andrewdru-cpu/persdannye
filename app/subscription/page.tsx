import type { Metadata } from "next";
import { SubscriptionOffer } from "@/components/legal/SubscriptionOffer";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Оферта на подписку",
  robots: { index: false, follow: false },
};

export default function SubscriptionPage() {
  return <SubscriptionOffer />;
}
