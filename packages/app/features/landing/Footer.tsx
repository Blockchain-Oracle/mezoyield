import Link from "next/link";
import { Code2 } from "lucide-react";

/**
 * Lightweight footer. Wordmark, tagline, three link clusters,
 * fine-print line. No sidebar context here — landing page is its
 * own surface.
 */
export function Footer() {
  return (
    <footer className="mt-auto border-t border-border">
      <div className="mx-auto w-full max-w-6xl px-6 py-12">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
          <div className="space-y-3">
            <Link href="/" className="inline-flex items-center">
              <span className="font-display text-2xl font-medium tracking-tight text-foreground">
                Mezo<span className="text-mezo">Yield</span>
              </span>
            </Link>
            <p className="max-w-xs text-sm text-muted-foreground">
              Set-and-forget MUSD yield on Mezo. Built for Mezo Hack 2026
              (Encode Club, MEZO Track).
            </p>
          </div>

          <div className="space-y-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-mezo">
              App
            </p>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/app/dashboard"
                  className="text-muted-foreground hover:text-foreground"
                >
                  Dashboard
                </Link>
              </li>
              <li>
                <Link
                  href="/app/earn/strategies"
                  className="text-muted-foreground hover:text-foreground"
                >
                  Strategies
                </Link>
              </li>
              <li>
                <Link
                  href="/app/earn/gauges"
                  className="text-muted-foreground hover:text-foreground"
                >
                  Gauges
                </Link>
              </li>
              <li>
                <Link
                  href="/app/insights/bribe-market"
                  className="text-muted-foreground hover:text-foreground"
                >
                  Bribe market
                </Link>
              </li>
              <li>
                <Link
                  href="/docs"
                  className="text-muted-foreground hover:text-foreground"
                >
                  Docs
                </Link>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-mezo">
              Build
            </p>
            <ul className="space-y-2 text-sm">
              <li>
                <a
                  href="https://github.com/Blockchain-Oracle/mezoyield"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
                >
                  <Code2 aria-hidden className="h-3.5 w-3.5" />
                  GitHub
                </a>
              </li>
              <li>
                <a
                  href="https://faucet.test.mezo.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground"
                >
                  Mezo Testnet faucet
                </a>
              </li>
              <li>
                <a
                  href="https://explorer.test.mezo.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground"
                >
                  Testnet explorer
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-border pt-6 text-xs text-muted-foreground">
          © 2026 MezoYield · MIT license · Built for Mezo Hack 2026
          (Encode Club). Non-custodial; not financial advice.
        </div>
      </div>
    </footer>
  );
}
