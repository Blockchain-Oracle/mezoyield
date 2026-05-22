import Link from "next/link";
import { ArrowRight, Code2 } from "lucide-react";

/**
 * Editorial-fintech hero. Maximalist serif statement with an italic
 * accent on the verb, asymmetric "manifesto strip" running down the
 * left column, mezo-pink chip + status row, dual CTAs, fine print.
 *
 * Staggered fade-up reveals (60ms steps via CSS animation-delay) on
 * first paint. No scroll-triggered animations — one orchestrated
 * moment per the frontend-design skill's guidance.
 *
 * Visual hierarchy that judges remember:
 *   1. Top-mounted vertical "MEZOYIELD ‖ EST. 2026" rule (left)
 *   2. Mezo-pink chip with status pulse
 *   3. Display headline at clamp(3rem,8vw,7rem)
 *   4. Italic verb on its own line with hand-drawn underline accent
 *   5. Dual CTAs sized differently — Launch is the primary, GitHub is
 *      a quieter outline
 *   6. Fine-print "non-custodial · real on-chain · keeper just voted"
 *      — credibility line that matches the demo script
 */
export function Hero() {
  return (
    <section className="relative isolate flex min-h-[92vh] flex-col items-stretch px-6 pt-12 sm:pt-16">
      {/* Atmospheric layers — focused mezo halo behind the headline + a
       * subtle vignette toward the corners. The grain + global radial
       * are in app/layout.tsx; these are localized to this section. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[42%] -z-10 h-[640px] w-[840px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(255,0,77,0.18),transparent_75%)] blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 [background:radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.6)_100%)]"
      />

      {/* Vertical manifesto rule on the left margin (lg+). Anchors the
       * eye and gives the page a Wall-Street-Journal-masthead feel. */}
      <div
        aria-hidden
        className="hidden xl:block absolute left-8 top-1/2 -translate-y-1/2 origin-left -rotate-90 text-[10px] uppercase tracking-[0.4em] text-muted-foreground"
      >
        MezoYield <span className="text-mezo">‖</span> Est. 2026 · Mezo MEZO Track
      </div>

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center text-center">
        {/* Status chip — fades in first */}
        <p
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-mezo/30 bg-mezo-soft px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-mezo animate-fade-up"
          style={{ animationDelay: "60ms" }}
        >
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inset-0 animate-ping rounded-full bg-mezo opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-mezo" />
          </span>
          Live on Mezo Mainnet · Set &amp; Forget online
        </p>

        {/* Hero — stacked editorial. The italic verb gets its own line +
         * a pink swash so the eye treats it as the action verb of the
         * manifesto. */}
        <h1 className="font-display text-[clamp(3rem,8vw,7rem)] font-medium leading-[0.95] tracking-tight text-foreground">
          <span
            className="block animate-fade-up"
            style={{ animationDelay: "120ms" }}
          >
            Set your MEZO yield
          </span>
          <span
            className="relative mt-2 block italic text-foreground/95 animate-fade-up"
            style={{ animationDelay: "200ms" }}
          >
            on autopilot.
            <svg
              aria-hidden
              viewBox="0 0 320 16"
              preserveAspectRatio="none"
              className="absolute -bottom-1 left-1/2 h-3 w-[min(60vw,320px)] -translate-x-1/2 text-mezo"
            >
              <path
                d="M2 9 Q60 2 120 8 T 240 8 T 318 6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </span>
        </h1>

        <p
          className="mx-auto mt-10 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg animate-fade-up"
          style={{ animationDelay: "300ms" }}
        >
          Lock MEZO. Pick a strategy. MezoYield&rsquo;s keeper bot votes the
          highest-paying gauge for you every epoch — you claim MUSD whenever.
          Convex for Mezo, non-custodial, first on the MEZO Track.
        </p>

        <div
          className="mt-10 flex flex-wrap items-center justify-center gap-3 animate-fade-up"
          style={{ animationDelay: "380ms" }}
        >
          <Link
            href="/app/dashboard"
            className="group inline-flex items-center justify-center gap-2 rounded-md bg-mezo px-6 py-3 text-sm font-medium text-primary-foreground shadow-lg shadow-mezo/30 transition-all hover:translate-y-[-1px] hover:bg-mezo-hover hover:shadow-mezo/50"
          >
            Launch app
            <ArrowRight
              aria-hidden
              className="h-4 w-4 transition-transform group-hover:translate-x-1"
            />
          </Link>
          <Link
            href="https://github.com/Blockchain-Oracle/mezoyield"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-card/40 px-6 py-3 text-sm font-medium text-foreground backdrop-blur transition-colors hover:border-mezo/40 hover:bg-card hover:text-mezo"
          >
            <Code2 aria-hidden className="h-4 w-4" />
            View source
          </Link>
        </div>

        {/* Three-up credibility row — short, punchy, real */}
        <div
          className="mt-14 grid w-full max-w-2xl grid-cols-3 gap-px overflow-hidden rounded-2xl border border-foreground/5 bg-foreground/5 animate-fade-up"
          style={{ animationDelay: "460ms" }}
        >
          {[
            { label: "Custody", value: "Non-custodial" },
            { label: "Network", value: "Mezo Testnet" },
            { label: "Keeper", value: "Voted on chain" },
          ].map((item) => (
            <div key={item.label} className="bg-background px-4 py-3 text-left">
              <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                {item.label}
              </p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
