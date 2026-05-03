import { Sparkles, Vote, Coins, ShieldCheck } from "lucide-react";

/**
 * 4 product pillars. Editorial layout — generous gutters, asymmetric
 * by mixing vertical & horizontal alignment of icons. Each pillar
 * names ONE concrete behavior so the user knows what they're getting.
 */
const PILLARS = [
  {
    icon: Sparkles,
    title: "Set & Forget",
    body: "Delegate once → the keeper bot votes for the highest-APY gauge for you each Sunday. Never log in to vote again.",
  },
  {
    icon: Vote,
    title: "Browse strategies",
    body: "5 named presets across the live Mezo gauges (Stability, MUSD Saver, BTC-LP, Balanced, Set & Forget). Yearn-style — pick your risk profile.",
  },
  {
    icon: Coins,
    title: "Claim in MUSD",
    body: "One click claims your accumulated MUSD into your wallet. 8-week earnings chart for trust + total cumulative MUSD on your vault page.",
  },
  {
    icon: ShieldCheck,
    title: "Non-custodial",
    body: "Your veMEZO never leaves your wallet. The optimizer holds zero balances. Set your own allocation any time, switch strategies any time.",
  },
] as const;

export function FeatureGrid() {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-20 sm:py-28">
      <div className="mx-auto max-w-2xl text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-mezo">
          What it does
        </p>
        <h2 className="mt-3 font-display text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
          A yield platform with <span className="italic">teeth.</span>
        </h2>
        <p className="mt-4 text-sm text-muted-foreground">
          Real testnet contracts. Real wagmi reads. Real gauge votes. No mocked
          settlement, no theater.
        </p>
      </div>

      <div className="mt-14 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-2">
        {PILLARS.map((p) => (
          <div
            key={p.title}
            className="flex flex-col gap-3 bg-background p-7 transition-colors hover:bg-card/40"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-mezo-soft">
              <p.icon aria-hidden className="h-5 w-5 text-mezo" />
            </div>
            <h3 className="font-display text-xl font-medium text-foreground">
              {p.title}
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {p.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
