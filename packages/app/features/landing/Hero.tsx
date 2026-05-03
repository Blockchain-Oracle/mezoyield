import Link from "next/link";
import { ArrowRight, Code2 } from "lucide-react";

/**
 * Landing hero — big editorial Fraunces statement, two CTAs, mezo
 * pink underline accent on the verb. The whole vibe: "this is a
 * financial publication that ships software", not a generic SaaS.
 */
export function Hero() {
  return (
    <section className="relative isolate flex min-h-[88vh] flex-col items-center justify-center px-6 pt-20 text-center">
      {/* Localized soft halo behind the headline. The page-level
       * radial wash is in app/layout.tsx; this one adds a focused
       * gradient where the eye lands. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[640px] w-[640px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(255,0,77,0.18),transparent_70%)] blur-2xl"
      />

      <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-mezo/30 bg-mezo-soft px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-mezo">
        <span className="h-1 w-1 rounded-full bg-mezo" aria-hidden />
        MezoYield · Mezo Hack 2026
      </p>

      <h1 className="font-display text-5xl font-medium leading-[1.05] tracking-tight text-foreground sm:text-6xl md:text-7xl">
        Set your MEZO yield
        <br />
        <span className="italic">on autopilot.</span>
      </h1>

      <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
        Earn MUSD without remembering to vote each week. Pick a strategy,
        delegate once, MezoYield handles the rest.
      </p>

      <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/app/dashboard"
          className="group inline-flex items-center justify-center gap-2 rounded-md bg-mezo px-5 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-mezo-hover"
        >
          Launch app
          <ArrowRight
            aria-hidden
            className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
          />
        </Link>
        <Link
          href="https://github.com/Blockchain-Oracle/mezoyield"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-card/40 px-5 py-3 text-sm font-medium text-foreground transition-colors hover:bg-card"
        >
          <Code2 aria-hidden className="h-4 w-4" />
          View on GitHub
        </Link>
      </div>

      <p className="mt-10 max-w-md text-xs text-muted-foreground/70">
        Non-custodial · Mezo Testnet (chain 31611) · Real on-chain calls,
        no mocked settlement
      </p>
    </section>
  );
}
