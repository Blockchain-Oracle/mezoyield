import { Check, X } from "lucide-react";

/**
 * Side-by-side: generic yield aggregator vs MezoYield. This is the
 * visual answer to "how is this different from another yield product?"
 * — the structural distinction that "we don't take custody, we don't
 * run a vault, we coordinate votes."
 *
 * Two columns separated by a vertical mezo divider. Each row maps a
 * concept; left column shows the Yearn-class answer, right column
 * shows MezoYield. Mezo column is visually emphasized (mezo border
 * accent, slightly lifted).
 */

const ROWS = [
  { label: "Custody model", left: "Vault holds your tokens", right: "Non-custodial — your veMEZO never moves" },
  { label: "Source of yield", left: "Interest the vault earns", right: "MUSD bribes posted by other protocols" },
  { label: "Mental model", left: "Deposit, wait, withdraw", right: "Delegate vote, claim MUSD" },
  { label: "User effort", left: "Click deposit, click claim", right: "Click activate once, claim whenever" },
  { label: "Execution layer", left: "Strategy contracts", right: "Keeper bot + on-chain optimizer" },
  { label: "Currency", left: "Vault share token", right: "Native MUSD straight to wallet" },
];

export function Comparison() {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-24 sm:py-32">
      <div className="mb-12 max-w-3xl">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-mezo">
          What we are not
        </p>
        <h2 className="mt-3 font-display text-4xl font-medium leading-[1.05] tracking-tight text-foreground sm:text-5xl">
          Not another vault.
          <br />
          <span className="italic text-mezo">A vote optimizer.</span>
        </h2>
        <p className="mt-4 max-w-2xl text-sm text-muted-foreground sm:text-base">
          MezoYield is in the Convex / Votium family, not the Yearn family. We
          coordinate where your veMEZO votes go each epoch — we don&rsquo;t
          take custody of any token.
        </p>
      </div>

      <div className="grid grid-cols-1 overflow-hidden rounded-3xl border border-border bg-card/30 lg:grid-cols-2">
        {/* Left: generic yield aggregator */}
        <div className="border-b border-border p-8 lg:border-b-0 lg:border-r">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Generic yield aggregator
          </p>
          <h3 className="mt-3 font-display text-2xl font-medium tracking-tight text-muted-foreground">
            Vault model
          </h3>
          <ul className="mt-8 space-y-5">
            {ROWS.map((row) => (
              <li key={row.label} className="flex items-start gap-3 text-sm">
                <X
                  aria-hidden
                  className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/50"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
                    {row.label}
                  </p>
                  <p className="mt-1 text-muted-foreground">{row.left}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Right: MezoYield — visually emphasized */}
        <div className="relative bg-mezo-soft/40 p-8">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-mezo to-transparent"
          />
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-mezo">
            MezoYield
          </p>
          <h3 className="mt-3 font-display text-2xl font-medium tracking-tight text-foreground">
            Vote-optimizer model
          </h3>
          <ul className="mt-8 space-y-5">
            {ROWS.map((row) => (
              <li key={row.label} className="flex items-start gap-3 text-sm">
                <Check
                  aria-hidden
                  className="mt-0.5 h-4 w-4 shrink-0 text-mezo"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-mezo/80">
                    {row.label}
                  </p>
                  <p className="mt-1 text-foreground">{row.right}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
