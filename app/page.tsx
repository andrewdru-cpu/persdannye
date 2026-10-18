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
import { loadVisibleChecksCount } from "@/lib/checks-count";
import { renderHero } from "@/lib/hero-copy";
import { finesMode } from "@/lib/fines-gate";
import { collectionEnabled } from "@/lib/collection-gate";
import { marketingConsentEnabled, showPlaceholderTodos } from "@/lib/runtime-flags";

export default async function HomePage() {
  const mode = finesMode();
  const checksCount = flags.hero_checks_count ? await loadVisibleChecksCount() : null;
  const hero = renderHero({ checksCount });
  const showFines = flags.show_fines && mode !== "hidden";
  const collect = collectionEnabled();

  return (
    <>
      <Hero
        headline={hero.headline}
        highlight={hero.highlight}
        subline={hero.subline}
        sublineNarrow={hero.sublineNarrow}
        ctaLabel={hero.cta}
        marketingConsent={marketingConsentEnabled()}
        collectionEnabled={collect}
      />
      <Trust />
      <HowItWorks />
      <HowCheckWorks />
      <WhatWeCheck />
      <DataOnSite />
      <RiskCalculator />
      {showFines && mode === "amounts" ? <FinesAmounts /> : showFines && mode === "neutral" ? <FinesNeutral /> : null}
      {flags.show_sample_report ? <ExampleResult /> : null}
      {flags.show_who_for ? <WhoFor /> : null}
      {flags.show_fix_with_us ? <FixWithUs collectionEnabled={collect} /> : null}
      <FAQ todos={showPlaceholderTodos()} showFinesTable={showFines} />
      {flags.show_lead_form ? (
        <LeadSection marketingConsent={marketingConsentEnabled()} collectionEnabled={collect} />
      ) : null}
    </>
  );
}
