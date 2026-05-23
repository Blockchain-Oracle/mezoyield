import type { Metadata } from "next";
import { Fraunces, JetBrains_Mono } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Providers } from "./providers";
import { ThemeProviderClient } from "@/components/ThemeProviderClient";
import { GlobalTicker } from "@/components/GlobalTicker";

/**
 * Type system — committed to aesthetic, not defaults.
 *  - Fraunces (variable serif) for display + headings. Brings the
 *    "financial-publication tone" the PRD's set-and-forget framing
 *    is reaching for; carried over from the KiteAI "Tactical
 *    Editorial" reset Abu rolled back to.
 *  - Geist Sans (Vercel grotesque, via the `geist` npm package since
 *    Geist isn't in Google Fonts) for body. Clean, modern,
 *    distinctive without being generic-Inter.
 *  - JetBrains Mono for addresses, hashes, numbers — long-form
 *    monospace with a real character (slashed zero, distinct l/1).
 */
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MezoYield — Gauge optimizer for veMEZO holders",
  description:
    "Auto-vote your veMEZO gauges for maximum MUSD yield. Connect with Mezo Passport and let MezoYield optimize your allocations every epoch.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "font-sans",
        fraunces.variable,
        GeistSans.variable,
        jetbrains.variable,
      )}
    >
      <body className="relative min-h-screen bg-background text-foreground antialiased">
        {/* Atmosphere: a soft mezo radial wash anchored top-right and
         * a fixed grain overlay. Both pointer-events-none so they
         * never block interaction. Together they kill the "flat
         * shadcn template" feel without screaming. */}
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(800px_500px_at_85%_-10%,rgba(255,0,77,0.10),transparent_60%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 -z-10 opacity-[0.035] mix-blend-overlay [background-image:url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22120%22 height=%22120%22><filter id=%22n%22><feTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%222%22 stitchTiles=%22stitch%22/></filter><rect width=%22120%22 height=%22120%22 filter=%22url(%23n)%22 opacity=%220.6%22/></svg>')]"
        />
        {/* ThemeProvider sits OUTSIDE the lazy wagmi/Passport stack so
         * it can take effect on the SSR pass + first paint. Toggling
         * the theme class on <html> never depends on the wallet stack
         * being mounted. */}
        <ThemeProviderClient>
          <Providers>
            <GlobalTicker />
            {children}
          </Providers>
        </ThemeProviderClient>
      </body>
    </html>
  );
}
