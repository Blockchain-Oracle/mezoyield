import { TokenGlyph } from "./TokenGlyph";
import type { TokenSymbol } from "@/lib/gaugeMetadata";

interface TokenPairProps {
  tokens: readonly TokenSymbol[];
  size?: number;
}

/**
 * Stacked pair-token display. Single-token gauges render one glyph; pair
 * gauges render two overlapping glyphs (right one shifted left + a card-
 * colored ring to lift it off the left). Mirrors Mezo's gauge-row icon
 * shape without lifting their assets.
 */
export function TokenPair({ tokens, size = 20 }: TokenPairProps) {
  if (tokens.length === 0) return null;
  if (tokens.length === 1) {
    return <TokenGlyph symbol={tokens[0]!} size={size} />;
  }
  return (
    <div className="inline-flex items-center">
      <TokenGlyph symbol={tokens[0]!} size={size} />
      <TokenGlyph
        symbol={tokens[1]!}
        size={size}
        className="-ml-2 ring-2 ring-card"
      />
    </div>
  );
}
