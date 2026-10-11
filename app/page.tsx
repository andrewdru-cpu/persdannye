import {
  Hero,
  Trust,
  HowItWorks,
  WhatWeCheck,
  ExampleResult,
  WhoFor,
  FixWithUs,
  FAQ,
  LeadSection,
} from "@/components/landing/Sections";
import { FinesAmounts } from "@/components/landing/FinesAmounts";
import { FinesNeutral } from "@/components/landing/FinesNeutral";
import { renderHero } from "@/lib/hero-copy";
import { finesMode } from "@/lib/fines-gate";

export default function HomePage() {
  const mode = finesMode();
  const hero = renderHero();

  return (
    <>
      <Hero
        headline={hero.headline}
        highlight={hero.highlight}
        subline={hero.subline}
        ctaLabel={hero.cta}
      />
      <Trust />
      <HowItWorks />
      <WhatWeCheck />
      {mode === "amounts" ? <FinesAmounts /> : mode === "neutral" ? <FinesNeutral /> : null}
      <ExampleResult />
      <WhoFor />
      <FixWithUs />
      <FAQ />
      <LeadSection />
    </>
  );
}
