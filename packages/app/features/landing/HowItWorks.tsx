import { Vote, Sparkles, Coins } from "lucide-react";

/**
 * Three huge numbered steps. Editorial — each step gets a Fraunces
 * numeral at clamp(4rem,7vw,8rem), a single-word verb, and one tight
 * line of explanation. No bullet lists, no boxes-of-features.
 *
 * Asymmetric grid: numbers staircase-down on lg+ via translate-y, so
 * the three rows form a visual descending diagonal that drags the eye
 * to the CTA below.
 */

const STEPS = [
  {
    icon: Vote,
    n: 1,
    verb: "Lock.",
    body: "Lock your MEZO into the gauge system to receive veMEZO voting power. Same model as Curve / Aerodrome ve(3,3).",
  },
  {
    icon: Sparkles,
    n: 2,
    verb: "Delegate.",
    body: "Open MezoYield, pick Set & Forget on /strategies, sign once. The keeper bot now votes for the highest-paying gauge for you every epoch.",
  },
  {
    icon: Coins,
    n: 3,
    verb: "Claim.",
    body: "Come back whenever to claim accumulated MUSD. Optionally auto-compound a share back into veMEZO without lifting a finger.",
  },
];

export function HowItWorks() {
  return (
    <section className="relative mx-auto w-full max-w-6xl px-6 py-24 sm:py-32">
      <div className="mb-16 max-w-3xl">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-mezo">
          How it works
        </p>
        <h2 className="mt-3 font-display text-4xl font-medium leading-[1.05] tracking-tight text-foreground sm:text-5xl">
          Three steps. <span className="italic">One signature.</span>
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-3 lg:gap-8">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          return (
            <div
              key={s.n}
              className={`group relative ${
                i === 1 ? "lg:translate-y-12" : ""
              } ${i === 2 ? "lg:translate-y-24" : ""}`}
            >
              {/* Number — sized large, mezo-pink, sits behind the verb */}
              <span
                aria-hidden
                className="font-display text-[clamp(5rem,7vw,8rem)] font-medium leading-none tracking-tighter text-mezo/15 transition-colors group-hover:text-mezo/30"
              >
                0{s.n}
              </span>

              <div className="mt-3 flex items-baseline gap-3">
                <Icon
                  aria-hidden
                  className="h-5 w-5 shrink-0 text-mezo"
                />
                <h3 className="font-display text-3xl font-medium tracking-tight text-foreground">
                  {s.verb}
                </h3>
              </div>

              <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
                {s.body}
              </p>

              {/* Connector line — only between cards on lg+ */}
              {i < STEPS.length - 1 && (
                <span
                  aria-hidden
                  className="absolute right-0 top-[88px] hidden h-px w-12 bg-gradient-to-r from-mezo/40 to-transparent lg:block"
                />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
