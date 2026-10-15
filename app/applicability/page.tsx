import type { Metadata } from "next";
import { notApplicableItems } from "@/content/not-applicable";

export const metadata: Metadata = {
  title: "Что к сайту не относится",
  robots: { index: false, follow: false },
};

export default function ApplicabilityPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-14 md:px-6 md:py-20">
      <h1 className="text-3xl font-semibold text-white md:text-4xl">Что к сайту не относится</h1>
      <ul className="mt-8 space-y-6">
        {notApplicableItems.map((item) => (
          <li key={item.id} className="glass-card p-4">
            <p className="text-sm text-white/80">Пункт {item.id}</p>
            <h2 className="mt-1 text-xl font-semibold text-white">{item.title}</h2>
            <p className="mt-2 text-sm font-medium text-amber-100">{item.mark}</p>
            <p className="mt-2 text-sm leading-relaxed text-white/80">{item.reason}</p>
          </li>
        ))}
      </ul>
    </article>
  );
}
