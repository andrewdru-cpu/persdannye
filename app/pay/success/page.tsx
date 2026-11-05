import type { Metadata } from "next";
import { PaySuccessScreen } from "@/components/pay/PayScreens";

export const metadata: Metadata = {
  title: "Платёж получен",
  robots: { index: false, follow: false },
};

export default function PaySuccessPage() {
  return <PaySuccessScreen />;
}
