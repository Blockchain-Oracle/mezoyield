import { Hero } from "@/features/landing/Hero";
import { Ticker } from "@/features/landing/Ticker";
import { JudgeQuotes } from "@/features/landing/JudgeQuotes";
import { HowItWorks } from "@/features/landing/HowItWorks";
import { Comparison } from "@/features/landing/Comparison";
import { LiveDataStrip } from "@/features/landing/LiveDataStrip";
import { FeatureGrid } from "@/features/landing/FeatureGrid";
import { Footer } from "@/features/landing/Footer";

/**
 * V2 landing — editorial-fintech, Bitcoin-noir energy. Composed in
 * the order judges/visitors will read it:
 *
 *   1. Hero — maximalist Fraunces statement, status pulse, dual CTAs.
 *   2. Ticker — continuously-scrolling on-chain numbers (no teeth=no win).
 *   3. JudgeQuotes — Andre + Dimmitri on-camera transcript pulls.
 *   4. HowItWorks — 3 Fraunces-numeral steps, asymmetric staircase.
 *   5. Comparison — Yearn-class vs MezoYield (vote-optimizer model).
 *   6. LiveDataStrip — three live-number tiles + contract address link.
 *   7. FeatureGrid — 4 product pillars (kept; same shape).
 *   8. Footer.
 */
export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Hero />
      <Ticker />
      <JudgeQuotes />
      <HowItWorks />
      <Comparison />
      <LiveDataStrip />
      <FeatureGrid />
      <Footer />
    </div>
  );
}
