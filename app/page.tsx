import {
  Hero,
  Trust,
  HowItWorks,
  HowCheckWorks,
  WhatWeCheck,
  DataOnSite,
  ExampleResult,
  WhoFor,
  FixWithUs,
  FAQ,
  LeadSection,
} from "@/components/landing/Sections";
import { RiskCalculator } from "@/components/landing/RiskCalculator";
import { FinesAmounts } from "@/components/landing/FinesAmounts";
import { FinesNeutral } from "@/components/landing/FinesNeutral";
import { flags } from "@/content/flags";
import { renderHero } from "@/lib/hero-copy";
import { finesMode } from "@/lib/fines-gate";
import { marketingConsentEnabled, showPlaceholderTodos } from "@/lib/runtime-flags";

export default function HomePage() {
  const mode = finesMode();
  const hero = renderHero();
  const showFines = flags.show_fines && mode !== "hidden";

  return (
    <>
      <Hero
        headline={hero.headline}
        highlight={hero.highlight}
        subline={hero.subline}
        ctaLabel={hero.cta}
        marketingConsent={marketingConsentEnabled()}
      />
      <Trust />
      <HowItWorks />
      <HowCheckWorks />
      <WhatWeCheck />
      <DataOnSite />
      <RiskCalculator />
      {showFines && mode === "amounts" ? <FinesAmounts /> : showFines && mode === "neutral" ? <FinesNeutral /> : null}
      {flags.show_example_result ? <ExampleResult /> : null}
      {flags.show_who_for ? <WhoFor /> : null}
      {flags.show_fix_with_us ? <FixWithUs /> : null}
      <FAQ todos={showPlaceholderTodos()} />
      <LeadSection marketingConsent={marketingConsentEnabled()} />
    </>
  );
}
