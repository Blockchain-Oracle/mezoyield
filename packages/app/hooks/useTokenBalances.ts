"use client";

import { useReadContracts, useBalance } from "wagmi";
import { DEPLOYMENT_MANIFEST, MEZO_NETWORK, MEZO_TOKEN_ADDRESS } from "@/lib/contracts";
import { mezoErc20Abi } from "@/lib/abi";
import type { Address } from "@/lib/types";

/**
 * Reads the user's three ecosystem balances in one hook:
 *
 *   - BTC: native gas token on Mezo. Used for tx fees + LP collateral.
 *   - MEZO: governance token (Mezo's; needed to lock into veMEZO NFTs).
 *           Mainnet `external.MEZO`; testnet absent — returns 0n.
 *   - MUSD: Mezo stablecoin, the bribe-reward token MatchboxAdapter
 *           pays out. Mainnet `external.MUSD`; testnet absent — 0n.
 *
 * Powers the dashboard's wallet-balances chip so judges connecting a
 * fresh wallet see real on-chain holdings (not synthesized), which
 * is the credibility-anchor framing.
 *
 * Single-batch via `useReadContracts` so MEZO + MUSD ride one RPC
 * round trip; BTC native balance uses wagmi's dedicated `useBalance`.
 */

export type TokenBalances = {
  btcWei: bigint;
  mezoWei: bigint;
  musdWei: bigint;
};

export type UseTokenBalancesResult = {
  data: TokenBalances;
  isLoading: boolean;
  isError: boolean;
};

export function useTokenBalances(user: Address | undefined): UseTokenBalancesResult {
  const native = useBalance({
    address: user,
    query: { enabled: !!user, staleTime: 15_000 },
  });

  // MEZO uses the top-level `MEZO_TOKEN_ADDRESS` export (mainnet-gated,
  // throws at module load if missing). MUSD stays manifest-derived
  // because the hot path doesn't write to it — only reads — so the
  // dynamic-lookup smell is tolerable here.
  const ext = DEPLOYMENT_MANIFEST.external ?? {};
  const musdAddr = MEZO_NETWORK === "mainnet" ? (ext.MUSD as `0x${string}` | undefined) : undefined;

  const erc20 = useReadContracts({
    query: {
      enabled: !!user && MEZO_NETWORK === "mainnet" && !!MEZO_TOKEN_ADDRESS && !!musdAddr,
      staleTime: 15_000,
    },
    contracts: [
      ...(MEZO_TOKEN_ADDRESS
        ? [
            {
              address: MEZO_TOKEN_ADDRESS,
              abi: mezoErc20Abi,
              functionName: "balanceOf" as const,
              args: user ? ([user] as const) : undefined,
            },
          ]
        : []),
      ...(musdAddr
        ? [
            {
              address: musdAddr,
              abi: mezoErc20Abi,
              functionName: "balanceOf" as const,
              args: user ? ([user] as const) : undefined,
            },
          ]
        : []),
    ],
  });

  const mezoWei = (erc20.data?.[0]?.result as bigint | undefined) ?? 0n;
  const musdWei = (erc20.data?.[1]?.result as bigint | undefined) ?? 0n;
  const btcWei = native.data?.value ?? 0n;

  return {
    data: { btcWei, mezoWei, musdWei },
    isLoading: native.isLoading || erc20.isLoading,
    isError: native.isError || erc20.isError,
  };
}
