/**
 * Display metadata derivation for gauges.
 *
 * The Mezo subgraph returns gauges with `{address, name, totalVeMezo, bribeMUSD}`
 * — no token-pair addresses, no pool-type field. But Mezo's naming convention
 * is consistent enough that we can derive the missing fields from the name:
 *
 *   "mUSDC/MUSD-10"        → tokens=[mUSDC, MUSD], type="CL stable pool"
 *   "BTC/MEZO-2000"        → tokens=[BTC, MEZO],   type="CL volatile pool"
 *   "mcbBTC/BTC"           → tokens=[mcbBTC, BTC], type="Basic volatile pool"
 *   "MUSD Savings"         → tokens=[MUSD],        type="Savings vault"
 *   "Stability Pool"       → tokens=[MUSD],        type="Stability Pool"
 *
 * Derivation rules (chosen so new gauges fall through gracefully):
 *   - Pair: split name on "/"; strip trailing "-N" fee-tier suffix.
 *   - Pool type: name contains "savings"  → Savings vault
 *                name contains "stability"→ Stability Pool
 *                name has "-N" suffix     → CL pool (stable if both sides
 *                                                    are stablecoins,
 *                                                    else volatile)
 *                otherwise                → Basic pool (same stable/volatile
 *                                                       split)
 *
 * This is the ONE file where deriving display data from string parsing is
 * the right call — the alternative is a hardcoded address→metadata map
 * that drifts every time Mezo seeds a new gauge. Every other "no
 * hardcoded literals" rule in CLAUDE.md still applies.
 */

export type TokenSymbol =
  | "MUSD"
  | "MEZO"
  | "BTC"
  | "mUSDC"
  | "mUSDT"
  | "USDC"
  | "USDT"
  | "mcbBTC"
  | "mSolvBTC"
  | "mxSolvBTC"
  | "mT"
  | "REKT"
  | "tBTC"
  | "UNKNOWN";

export type PoolType =
  | "CL stable pool"
  | "CL volatile pool"
  | "Basic stable pool"
  | "Basic volatile pool"
  | "Savings vault"
  | "Stability Pool"
  | "Other";

export interface GaugeDisplay {
  tokens: readonly TokenSymbol[];
  poolType: PoolType;
}

const STABLE_SYMBOLS = new Set<TokenSymbol>(["MUSD", "mUSDC", "mUSDT", "USDC", "USDT"]);

const KNOWN_SYMBOLS = new Set<TokenSymbol>([
  "MUSD",
  "MEZO",
  "BTC",
  "mUSDC",
  "mUSDT",
  "USDC",
  "USDT",
  "mcbBTC",
  "mSolvBTC",
  "mxSolvBTC",
  "mT",
  "REKT",
  "tBTC",
]);

function toSymbol(raw: string): TokenSymbol {
  return KNOWN_SYMBOLS.has(raw as TokenSymbol)
    ? (raw as TokenSymbol)
    : "UNKNOWN";
}

function parsePairTokens(name: string): readonly TokenSymbol[] {
  if (!name.includes("/")) {
    // Single-token gauges. "Stability Pool" is by convention always
    // denominated in MUSD (Liquity/MakerDAO heritage); name doesn't
    // mention MUSD explicitly so check it first.
    if (/stability/i.test(name)) return ["MUSD"];
    if (/musd/i.test(name)) return ["MUSD"];
    if (/mezo/i.test(name)) return ["MEZO"];
    return ["UNKNOWN"];
  }
  const parts = name.split("/").map((p) => p.trim());
  const [left, rightRaw] = parts;
  // Strip "-N" fee-tier suffix (e.g. "MUSD-10" → "MUSD").
  const right = rightRaw?.replace(/-\d+$/, "");
  return [toSymbol(left ?? ""), toSymbol(right ?? "")] as const;
}

function isStablePair(tokens: readonly TokenSymbol[]): boolean {
  if (tokens.length !== 2) return false;
  return tokens.every((t) => STABLE_SYMBOLS.has(t));
}

function derivePoolType(name: string, tokens: readonly TokenSymbol[]): PoolType {
  const lower = name.toLowerCase();
  if (lower.includes("savings")) return "Savings vault";
  if (lower.includes("stability")) return "Stability Pool";
  const hasFeeTierSuffix = /\/\w+-\d+$/.test(name);
  if (hasFeeTierSuffix) {
    return isStablePair(tokens) ? "CL stable pool" : "CL volatile pool";
  }
  if (tokens.length === 2) {
    return isStablePair(tokens) ? "Basic stable pool" : "Basic volatile pool";
  }
  return "Other";
}

/**
 * Single entrypoint: turn a gauge name into display metadata. Used by
 * GaugeTable, allocation list cells, etc.
 */
export function deriveGaugeDisplay(name: string): GaugeDisplay {
  const tokens = parsePairTokens(name);
  const poolType = derivePoolType(name, tokens);
  return { tokens, poolType };
}

/**
 * Brand color per token — used by TokenGlyph for the disc background.
 * Defaults to a neutral muted gray for unknowns so new tokens still render.
 */
export const TOKEN_COLORS: Record<TokenSymbol, string> = {
  BTC: "#F7931A",
  tBTC: "#F7931A",
  mcbBTC: "#F7931A",
  mSolvBTC: "#7B4FDB",
  mxSolvBTC: "#7B4FDB",
  MEZO: "#FF004D",
  MUSD: "#10B981",
  mUSDC: "#2775CA",
  USDC: "#2775CA",
  mUSDT: "#26A17B",
  USDT: "#26A17B",
  mT: "#737373",
  REKT: "#EF4444",
  UNKNOWN: "#52525B",
};
