import { cn } from "@/lib/utils";
import { TOKEN_COLORS, type TokenSymbol } from "@/lib/gaugeMetadata";

interface TokenGlyphProps {
  symbol: TokenSymbol;
  size?: number;
  className?: string;
}

/**
 * Letter-disc token glyph. Solid brand color background with the first
 * letter (or `?` for UNKNOWN) in white. Distinct from Mezo's bespoke
 * pair-token SVGs — letter avatars are a recognized convention (GitHub,
 * Vercel, Linear) and avoid lifting copyrighted art for a hackathon.
 */
export function TokenGlyph({ symbol, size = 20, className }: TokenGlyphProps) {
  const bg = TOKEN_COLORS[symbol];
  // Use a more distinctive 2-char label for BTC variants ("BT" loses the
  // c/x/Solv signal — but for a 20px disc 1 letter reads cleaner). Keep
  // the first 1-2 visible chars after lowercase "m" prefix when present.
  const letter = pickLetter(symbol);
  return (
    <div
      role="img"
      aria-label={symbol}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-mono font-semibold uppercase text-white",
        className,
      )}
      style={{
        width: size,
        height: size,
        backgroundColor: bg,
        fontSize: Math.max(8, Math.round(size * 0.45)),
      }}
    >
      {letter}
    </div>
  );
}

function pickLetter(symbol: TokenSymbol): string {
  if (symbol === "UNKNOWN") return "?";
  // BTC variants → "₿" for visual distinction across the BTC family
  if (symbol === "BTC" || symbol === "tBTC") return "₿";
  if (symbol === "mcbBTC") return "c";
  if (symbol === "mSolvBTC" || symbol === "mxSolvBTC") return "S";
  // Stables → "$" for the broader stablecoin family is too generic; use
  // first distinguishing letter after any "m" prefix
  if (symbol.startsWith("m") && symbol.length > 1) {
    return symbol[1]!.toUpperCase();
  }
  return symbol[0]!.toUpperCase();
}
