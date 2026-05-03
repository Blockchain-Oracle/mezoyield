import { Hero } from "@/features/landing/Hero";
import { LiveDataStrip } from "@/features/landing/LiveDataStrip";
import { FeatureGrid } from "@/features/landing/FeatureGrid";
import { Footer } from "@/features/landing/Footer";

/**
 * V2 landing page. Composition of features/landing/* — no sidebar
 * (this surface is public, no app shell). Order:
 *   Hero (full viewport, centered, big Fraunces statement)
 *   LiveDataStrip (3 live numbers — top APY, total bribes, contract)
 *   FeatureGrid (4 product pillars)
 *   Footer (wordmark + nav + fine print)
 *
 * Marked async so Next.js gives this page its own server-render
 * boundary — even though every child is "use client" or pure HTML.
 */
export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Hero />
      <LiveDataStrip />
      <FeatureGrid />
      <Footer />
    </div>
  );
}
