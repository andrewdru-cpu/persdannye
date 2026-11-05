import type { Metadata } from "next";
import { OneTimeOffer } from "@/components/legal/OneTimeOffer";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Оферта на разовую услугу",
  robots: { index: false, follow: false },
};

export default function OneTimeOfferPage() {
  return <OneTimeOffer />;
}
