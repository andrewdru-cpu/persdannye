import { calculatorIssueViews, finesCatalog } from "@/content/fines";
import { finesUi } from "@/content/landing";
import { FineCalculator } from "@/components/landing/FineCalculator";
import { LegalDisclaimer } from "@/components/landing/LegalDisclaimer";
import { Reveal } from "@/components/motion/Reveal";

function barUnits(value: number, scale: number): number {
  if (scale <= 0) return 0;
  return Math.min(100, Math.max(1.5, (value / scale) * 100));
}

export function FinesAmounts() {
  const scale = Math.max(
    ...finesCatalog.rows.flatMap((row) => [row.ip.max, row.legal.max]),
  );
  const hasUnsplit = finesCatalog.rows.some((row) => row.unsplitInSpec);

  return (
    <>
      <section
        id="fines"
        aria-labelledby="fines-title"
        className="scroll-mt-24 border-y border-amber-200/10 bg-ink-975/80 py-20 md:py-28"
      >
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-200/80">
              {finesUi.eyebrow}
            </p>
            <h2
              id="fines-title"
              className="mt-2 font-display text-4xl font-semibold text-white md:text-5xl"
            >
              {finesUi.title}
            </h2>
            <p className="mt-3 max-w-2xl text-white/70">{finesUi.lead}</p>
            <p className="mt-2 text-xs text-white/55">
              {finesCatalog.article}. По состоянию на {finesCatalog.as_of}. Источник:{" "}
              {finesCatalog.source}.
            </p>
          </Reveal>

          <div className="mt-8">
            <ul className="grid gap-3 md:hidden">
              {finesCatalog.rows.map((row) => (
                <li key={row.id} className="rounded-3xl border border-amber-200/20 bg-white/[0.03] p-4">
                  <p className="font-medium text-white">{row.violation}</p>
                  <dl className="mt-3 grid grid-cols-2 gap-3">
                    <div>
                      <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-100/80">
                        {finesUi.columns.ip}
                      </dt>
                      <dd className="mt-1 text-sm tabular-nums text-white">{row.ip.label}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-100/80">
                        {finesUi.columns.legal}
                      </dt>
                      <dd className="mt-1 text-sm tabular-nums text-white">{row.legal.label}</dd>
                    </div>
                  </dl>
                  <p className="mt-3 text-xs text-amber-100/90">
                    {finesUi.columns.norm}: {row.norm}
                  </p>
                </li>
              ))}
            </ul>
            <div
              className="hidden overflow-x-auto rounded-[28px] border border-amber-200/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 md:block"
              tabIndex={0}
              role="region"
              aria-label={finesUi.title}
            >
              <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                <caption className="sr-only">
                  {finesUi.title}. {finesCatalog.article}. Источник: {finesCatalog.source}.
                </caption>
                <thead className="bg-amber-100/[0.06] text-amber-50">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      {finesUi.columns.violation}
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      {finesUi.columns.ip}
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      {finesUi.columns.legal}
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      {finesUi.columns.norm}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {finesCatalog.rows.map((row) => (
                    <tr key={row.id} className="border-t border-amber-200/15">
                      <th scope="row" className="px-4 py-3 font-medium text-white">
                        {row.violation}
                      </th>
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-white/80">
                        {row.ip.label}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-white/80">
                        {row.legal.label}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-amber-100/90">{row.norm}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {hasUnsplit ? (
              <p className="mt-3 max-w-3xl text-xs leading-relaxed text-white/60">{finesUi.unsplitNote}</p>
            ) : null}
          </div>

          <figure className="mt-10" aria-hidden="true">
            <figcaption className="font-display text-3xl font-semibold text-white">
              {finesUi.chartTitle}
            </figcaption>
            <p className="mt-2 max-w-2xl text-sm text-white/65">{finesUi.chartCaption}</p>
            <ul className="mt-6 space-y-5">
              {finesCatalog.rows.map((row) => (
                <li key={row.id}>
                  <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-white">{row.violation}</span>
                    <span className="text-xs text-amber-100/80">{row.norm}</span>
                  </div>
                  <div className="grid gap-1.5">
                    <BarRow
                      name={finesUi.ipBar}
                      label={row.ip.label}
                      width={barUnits(row.ip.max, scale)}
                      tone="muted"
                    />
                    <BarRow
                      name={finesUi.legalBar}
                      label={row.legal.label}
                      width={barUnits(row.legal.max, scale)}
                      tone="strong"
                    />
                  </div>
                </li>
              ))}
            </ul>
          </figure>

          <aside className="mt-8 rounded-[28px] border border-amber-200/30 bg-amber-100/[0.05] p-5 md:p-6">
            <h3 className="font-display text-3xl font-semibold text-white">
              {finesCatalog.turnover.title}
            </h3>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/75">
              {finesCatalog.turnover.text}
            </p>
          </aside>

          <LegalDisclaimer className="mt-6 max-w-3xl" />
        </div>
      </section>

      <FineCalculator
        issues={calculatorIssueViews()}
        excludedNote={finesCatalog.calculatorExcludedNote}
      />
    </>
  );
}

function BarRow({
  name,
  label,
  width,
  tone,
}: {
  name: string;
  label: string;
  width: number;
  tone: "muted" | "strong";
}) {
  const fill = tone === "strong" ? "rgba(243,230,196,0.92)" : "rgba(198,161,91,0.72)";
  return (
    <div className="grid grid-cols-[4.25rem_minmax(0,1fr)] items-center gap-x-3 gap-y-1 sm:grid-cols-[4.25rem_minmax(0,1fr)_auto]">
      <span className="text-[11px] uppercase tracking-[0.14em] text-white/55">{name}</span>
      <svg viewBox="0 0 100 8" className="h-2 w-full" preserveAspectRatio="none" role="presentation">
        <rect x="0" y="0" width="100" height="8" rx="4" fill="rgba(255,255,255,0.08)" />
        <rect x="0" y="0" width={width} height="8" rx="4" fill={fill} />
      </svg>
      <span className="col-span-2 text-xs tabular-nums text-white/80 sm:col-span-1 sm:text-right">
        {label}
      </span>
    </div>
  );
}
