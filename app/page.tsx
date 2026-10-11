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
import { resolveHeroVariant } from "@/lib/hero-copy";
import { finesMode } from "@/lib/fines-gate";

export default function HomePage() {
  const mode = finesMode();
  const hero = resolveHeroVariant(mode === "amounts");

  return (
    <>
      <Hero headline={hero.headline} highlight={hero.highlight} subline={hero.subline} />
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
