import Link from "next/link";
import { Sparkles, Vote, Coins, ShieldCheck, ArrowRight } from "lucide-react";

/**
 * Bento-style asymmetric grid (4 cells, 2x2 base, top-left spans 2x2 on lg+
 * so the lead pillar gets visual weight). Editorial cousin of an Apple
 * marketing grid: one anchor cell tells the story, the satellites
 * elaborate.
 *
 * Replaces the prior flat 2x2 — picked up the recommendation from the
 * ui-ux-pro-max bento pattern, kept the locked Fraunces+Geist+#FF004D
 * direction (the skill's typography/color suggestions were rejected).
 */

const LEAD = {
  icon: Sparkles,
  title: "Set & Forget",
  body: "Delegate once. The keeper bot picks the highest-APY gauge for you every Mezo epoch and casts the vote. You never come back unless you want to claim or switch strategies.",
  cta: { href: "/app/earn/strategies", label: "Browse strategies" },
} as const;

const SATELLITES = [
  {
    icon: Vote,
    title: "Browse strategies",
    body: "5 named presets across the live Mezo gauges. Yearn-style — pick a risk profile, click activate, signed.",
  },
  {
    icon: Coins,
    title: "Claim in MUSD",
    body: "One click claims accumulated MUSD into your wallet. 8-week earnings chart on /app/earn/vault.",
  },
  {
    icon: ShieldCheck,
    title: "Non-custodial",
    body: "Your veMEZO never moves. The optimizer holds zero balances. Switch strategies or revoke any time.",
  },
] as const;

export function FeatureGrid() {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-20 sm:py-28">
      <div className="mx-auto max-w-2xl text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-mezo">
          What it does
        </p>
        <h2 className="mt-3 font-display text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
          A yield platform with <span className="italic">teeth.</span>
        </h2>
        <p className="mt-4 text-sm text-muted-foreground">
          Real Mezo Mainnet contracts. Real wagmi reads. Real gauge votes. No
          mocked settlement, no theater.
        </p>
      </div>

      {/* Bento grid — 1col mobile, 2x2 sm+, lead-spans-2x2 on lg+ */}
      <div className="mt-14 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:grid-rows-2">
        {/* Lead — full feature with CTA, spans 2x2 on lg+ */}
        <article className="group relative isolate flex flex-col gap-5 overflow-hidden rounded-2xl border border-border bg-card/40 p-7 transition-all duration-300 hover:border-mezo/40 hover:bg-card sm:col-span-2 lg:row-span-2 lg:p-9">
          {/* Halo behind the lead card */}
          <div
            aria-hidden
            className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-[radial-gradient(closest-side,rgba(255,0,77,0.18),transparent_70%)] blur-2xl transition-opacity duration-300 group-hover:opacity-150"
          />
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-mezo/30 bg-mezo-soft">
            <LEAD.icon aria-hidden className="h-6 w-6 text-mezo" />
          </div>
          <div className="flex-1 space-y-3">
            <h3 className="font-display text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
              {LEAD.title}
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
              {LEAD.body}
            </p>
          </div>
          <Link
            href={LEAD.cta.href}
            className="group/cta inline-flex w-fit cursor-pointer items-center gap-2 rounded-md border border-mezo/30 bg-mezo-soft px-4 py-2 text-sm font-medium text-mezo transition-colors hover:bg-mezo hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mezo focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {LEAD.cta.label}
            <ArrowRight
              aria-hidden
              className="h-4 w-4 transition-transform group-hover/cta:translate-x-1"
            />
          </Link>
        </article>

        {/* Satellites */}
        {SATELLITES.map((s) => (
          <article
            key={s.title}
            className="group flex flex-col gap-3 rounded-2xl border border-border bg-card/30 p-6 transition-colors duration-200 hover:border-mezo/30 hover:bg-card/60 sm:col-span-1 lg:col-span-2"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-mezo-soft transition-colors group-hover:bg-mezo/20">
              <s.icon aria-hidden className="h-5 w-5 text-mezo" />
            </div>
            <h3 className="font-display text-xl font-medium text-foreground">
              {s.title}
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {s.body}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
