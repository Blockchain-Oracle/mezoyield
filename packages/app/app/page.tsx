import Link from "next/link";

/**
 * V2 root route — temporary placeholder until Phase 5 ships the real
 * landing page. Deliberately does NOT redirect because:
 *  - server-side redirects bypass the client wallet hydration cycle
 *  - judges should land on a hero-style page, not a dashboard
 *
 * Phase 5 swaps this for the marketing landing under `(landing)/page.tsx`.
 */
export default function RootPlaceholder() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 text-center">
      <div className="space-y-3">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-mezo">
          MezoYield · V2 in progress
        </p>
        <h1 className="font-sans text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
          Set your MEZO yield on autopilot
        </h1>
        <p className="mx-auto max-w-xl text-sm text-muted-foreground">
          Earn MUSD without remembering to vote each week. Pick a strategy,
          delegate once, MezoYield handles the rest.
        </p>
      </div>
      <Link
        href="/app/dashboard"
        className="inline-flex items-center justify-center rounded-md bg-mezo px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-mezo-hover"
      >
        Launch app →
      </Link>
    </main>
  );
}
