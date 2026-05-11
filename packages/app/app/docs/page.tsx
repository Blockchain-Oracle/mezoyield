import Link from "next/link";
import { ExternalLink } from "lucide-react";
import {
  OPTIMIZER_ADDRESS,
  GAUGE_CONTROLLER_ADDRESS,
  MATCHBOX_ADDRESS,
  VE_MEZO_ADDRESS,
  MEZO_EXPLORER,
  MEZO_CHAIN_ID,
} from "@/lib/contracts";
import { AppHeader } from "@/components/AppHeader/AppHeader";

/**
 * /docs — public static page. No wagmi hooks; renders without a wallet
 * stack. Houses FAQ, optimizer formula, contracts table, non-custody
 * disclosure, risk disclaimer. Linked from the footer on every page.
 */

const FAQ: ReadonlyArray<{ q: string; a: string }> = [
  {
    q: "Is MezoYield custodial?",
    a: "No. The optimizer contract holds no balances and has no payable functions. You always own your veMEZO position. The keeper is granted permission to call setManualAllocation / castOptimalVote on your behalf — you can revoke that at any time.",
  },
  {
    q: "What happens if I miss an epoch?",
    a: "Nothing — that's the point. Once you activate a strategy, the keeper bot re-votes every Unix-aligned weekly epoch (604_800 seconds, lands ~Thursday 00:00 UTC) for as long as the strategy is active. Rewards accrue continuously; claim them whenever it suits you.",
  },
  {
    q: "How is the 'best gauge' decided?",
    a: "Each gauge is scored by the ratio of its current MUSD incentive to its locked voting power — the MUSD reward per unit of locked vote. Gauges with a positive score (anything being incentivized this epoch) are taken; weights are distributed proportionally in basis points. Read the algorithm in packages/app/lib/optimize.ts. The exact formula is in the section above.",
  },
  {
    q: "Where does the MUSD reward come from?",
    a: "Mezo's gauge controller routes a portion of protocol fees plus epoch-specific bribes to gauges. veMEZO holders who vote on a gauge get a pro-rata share of those rewards when the epoch closes. MezoYield's keeper bot routes your votes to the highest-score gauges so your share is maximized.",
  },
  {
    q: "Can I exit my strategy at any time?",
    a: "Yes. The optimizer exposes a clearAllocation / undelegate path — when you call it, your votes default to zero for the next epoch and no further keeper actions touch your position. Withdrawal of veMEZO itself is governed by Mezo's underlying lock mechanics, not MezoYield.",
  },
  {
    q: "What wallets are supported?",
    a: "Mezo Passport (the project's mandated wallet), which wraps Xverse, Unisat, OKX, and any EVM-compatible wallet via RainbowKit. Mainnet support arrives with Mezo's mainnet bridge.",
  },
];

const CONTRACTS: ReadonlyArray<{ name: string; address: `0x${string}`; note: string }> = [
  {
    name: "MezoYieldOptimizer",
    address: OPTIMIZER_ADDRESS,
    note: "Non-custodial vote-optimizer. Source of all RewardsClaimed events.",
  },
  {
    name: "MockGaugeController",
    address: GAUGE_CONTROLLER_ADDRESS,
    note: "Testnet stand-in for Mezo's gauge system (real Voter.sol addresses unpublished as of submission).",
  },
  {
    name: "MockMatchbox",
    address: MATCHBOX_ADDRESS,
    note: "Testnet stand-in for Mezo's Matchbox bribe market.",
  },
  {
    name: "MockVeMezo",
    address: VE_MEZO_ADDRESS,
    note: "Testnet stand-in for veMEZO (Mezo mainnet ABI not yet final).",
  },
];

export default function DocsPage() {
  return (
    <>
      <AppHeader variant="landing" />
      <DocsPageBody />
    </>
  );
}

function DocsPageBody() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16 text-foreground">
      <header className="mb-10">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-mezo">
          Reference
        </p>
        <h1 className="mt-2 font-display text-5xl font-medium tracking-tight">
          Docs
        </h1>
        <p className="mt-4 max-w-prose text-sm text-muted-foreground">
          How MezoYield works, what it touches, and what it doesn&rsquo;t.
          Sourced from the deployed optimizer at chain {MEZO_CHAIN_ID}.
        </p>
      </header>

      <section className="mb-12">
        <h2 className="font-display text-2xl font-medium tracking-tight">
          Intro
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          MezoYield is a set-and-forget MUSD yield optimizer on Mezo. Lock
          MEZO, pick a strategy, and the optimizer&rsquo;s keeper bot re-votes
          the highest-incentive gauges for you at each Unix-aligned weekly
          epoch. Rewards accrue in MUSD; you claim them whenever.
        </p>
      </section>

      <section className="mb-12">
        <h2 className="font-display text-2xl font-medium tracking-tight">
          How the optimizer scores gauges
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          For each gauge <code className="font-mono text-foreground">g</code>:
        </p>
        <pre className="mt-3 overflow-x-auto rounded-xl border border-border bg-card/50 p-4 font-mono text-xs leading-relaxed text-foreground">
{`score(g) = bribe(g) / totalVeMezo(g)`}
        </pre>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Higher score means more MUSD reward per unit of your veMEZO. The
          allocator sorts gauges by score, drops any with score{" "}
          <code className="font-mono text-foreground">≤ 0</code>, and
          distributes your voting weight proportionally to the survivors.
          Rounding drift goes to the heaviest entry so the basis-point sum
          is exactly <code className="font-mono text-foreground">10_000</code>.
          Read the full algorithm in{" "}
          <code className="font-mono text-foreground">packages/app/lib/optimize.ts</code>.
        </p>
      </section>

      <section className="mb-12">
        <h2 className="font-display text-2xl font-medium tracking-tight">
          FAQ
        </h2>
        <dl className="mt-4 space-y-6">
          {FAQ.map((entry) => (
            <div
              key={entry.q}
              data-testid="docs-faq-item"
              className="border-b border-border pb-5 last:border-b-0"
            >
              <dt className="text-sm font-medium text-foreground">
                {entry.q}
              </dt>
              <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {entry.a}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mb-12">
        <h2 className="font-display text-2xl font-medium tracking-tight">
          Contracts
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Deployed on Mezo Testnet (chain {MEZO_CHAIN_ID}). Source of truth:{" "}
          <code className="font-mono text-foreground">
            packages/contracts/deployments/mezo-testnet.json
          </code>
          .
        </p>
        <div className="mt-4 overflow-hidden rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-card/40 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Contract</th>
                <th className="px-4 py-2">Address</th>
              </tr>
            </thead>
            <tbody>
              {CONTRACTS.map((row) => (
                <tr
                  key={row.address}
                  data-testid="docs-contract-row"
                  className="border-t border-border align-top"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{row.name}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {row.note}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <a
                      href={`${MEZO_EXPLORER}/address/${row.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-mono text-xs text-foreground hover:text-mezo"
                    >
                      {row.address.slice(0, 8)}…{row.address.slice(-6)}
                      <ExternalLink aria-hidden className="h-3 w-3" />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="font-display text-2xl font-medium tracking-tight">
          Non-custody disclosure
        </h2>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
          <li>
            The MezoYieldOptimizer contract has no <code className="font-mono">payable</code>{" "}
            functions and holds no balances.
          </li>
          <li>
            Strategy activation grants the keeper permission to call{" "}
            <code className="font-mono">setManualAllocation</code> /{" "}
            <code className="font-mono">castOptimalVote</code> on your behalf.
            Nothing else.
          </li>
          <li>
            Revocation is a single transaction; reverts to zero allocation at
            the next epoch boundary.
          </li>
          <li>
            All votes and claims emit on-chain events you can audit via the
            Mezo explorer link in the Contracts table above.
          </li>
        </ul>
      </section>

      <section className="mb-12">
        <h2 className="font-display text-2xl font-medium tracking-tight">
          Risk disclaimer
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          MezoYield is hackathon software (Mezo Hack 2026, Encode Club, MEZO
          Track). Smart contracts are audited only by their authors and Codex.
          Testnet only at the time of writing. veMEZO lock terms, MUSD peg
          mechanics, and gauge-controller behavior are governed by Mezo, not
          MezoYield — see Mezo&rsquo;s own docs for the full risk picture.
          Nothing here is financial advice.
        </p>
      </section>

      <footer className="mt-16 border-t border-border pt-6 text-xs text-muted-foreground">
        <Link href="/" className="hover:text-foreground">
          ← Back to home
        </Link>
      </footer>
    </main>
  );
}
