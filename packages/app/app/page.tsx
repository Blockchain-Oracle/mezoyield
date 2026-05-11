import { AppHeader } from "@/components/AppHeader/AppHeader";
import { Hero } from "@/features/landing/Hero";
import { Ticker } from "@/features/landing/Ticker";
import { HowItWorks } from "@/features/landing/HowItWorks";
import { ProofLedger } from "@/features/landing/ProofLedger";
import { Comparison } from "@/features/landing/Comparison";
import { LiveDataStrip } from "@/features/landing/LiveDataStrip";
import { ProtocolEarningsChart } from "@/features/landing/ProtocolEarningsChart";
import { FeatureGrid } from "@/features/landing/FeatureGrid";
import { Footer } from "@/features/landing/Footer";

/**
 * V2 landing — editorial-fintech, Bitcoin-noir energy. Composed in
 * the order judges/visitors will read it:
 *
 *   1. Hero — maximalist Fraunces statement, status pulse, dual CTAs.
 *   2. Ticker — continuously-scrolling on-chain numbers (no teeth=no win).
 *   3. HowItWorks — 3 Fraunces-numeral steps, asymmetric staircase.
 *   4. ProofLedger — receipts. The most recent on-chain VoteCast from
 *      the keeper, pulled live. Replaces the old JudgeQuotes section
 *      (quotes are soft signals, tx hashes are hard signals).
 *   5. Comparison — Yearn-class vs MezoYield (vote-optimizer model).
 *   6. LiveDataStrip — three live-number tiles + contract address link.
 *   7. FeatureGrid — 4 product pillars (bento layout, lead spans 2x2).
 *   8. Footer.
 */
export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader variant="landing" />
      <Hero />
      <Ticker />
      <HowItWorks />
      <ProofLedger />
      <Comparison />
      <LiveDataStrip />
      <ProtocolEarningsChart />
      <FeatureGrid />
      <Footer />
    </div>
  );
}
