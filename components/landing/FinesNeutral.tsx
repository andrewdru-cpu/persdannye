import { finesNeutralCopy } from "@/content/fines-neutral";
import { LegalDisclaimer } from "@/components/landing/LegalDisclaimer";
import { Reveal } from "@/components/motion/Reveal";

export function FinesNeutral() {
  return (
    <section
      id="fines"
      aria-labelledby="fines-title"
      className="scroll-mt-24 border-y border-amber-200/10 bg-ink-975/80 py-20 md:py-28"
    >
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-200/80">
            {finesNeutralCopy.eyebrow}
          </p>
          <h2
            id="fines-title"
            className="mt-2 max-w-3xl font-display text-4xl font-semibold text-white md:text-5xl"
          >
            {finesNeutralCopy.title}
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/75 md:text-lg">
            {finesNeutralCopy.body}
          </p>
          <LegalDisclaimer className="mt-6 max-w-2xl" />
        </Reveal>
      </div>
    </section>
  );
}
