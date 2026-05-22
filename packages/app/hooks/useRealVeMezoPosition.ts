"use client";

import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import { MEZO_NETWORK, VE_MEZO_NFT_ADDRESS } from "@/lib/contracts";
import type { Address } from "@/lib/types";

/**
 * Reads the user's REAL veMEZO NFT position from the upstream Mezo
 * contract (`external.VeMEZO` in the mainnet manifest). Returns the
 * raw chain truth: how many NFTs, total locked MEZO across them,
 * total voting power, the earliest unlock timestamp, and the first
 * tokenId (which is what the keeper's adapter uses to cast votes).
 *
 * Why a separate hook from `useVeMezoPosition`: the existing hook
 * reads the `VeMezoVotingPower` shim's `balanceOf` (an aggregate
 * voting-power view). This one calls into the upstream contract
 * directly so the dashboard can show per-NFT detail (tokenId list,
 * locked amount, unlock time) — the "this is real Mezo state" proof
 * judges want to see.
 *
 * Testnet returns `null` (real veMEZO doesn't exist on testnet — see
 * `TESTNET_ADDRESSES.md#testnet-vs-mainnet-wiring-delta`). Consumers
 * should fall back to `useVeMezoPosition` for testnet display.
 *
 * Caps NFT enumeration at 10 tokens to keep RPC traffic bounded.
 * Power users with > 10 locks get accurate counts but only the first
 * 10 tokenIds rendered.
 */

const VEMEZO_READ_ABI = [
  {
    type: "function",
    stateMutability: "view",
    name: "balanceOf",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "ownerToNFTokenIdList",
    inputs: [
      { name: "owner", type: "address" },
      { name: "index", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "votingPowerOfNFT",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "locked",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "amount", type: "int128" },
          { name: "end", type: "uint256" },
        ],
      },
    ],
  },
] as const;

const MAX_TOKENS_READ = 10;

export type RealVeMezoPosition = {
  nftCount: bigint;
  tokenIds: bigint[];
  totalLockedMezoWei: bigint;
  totalVotingPowerWei: bigint;
  earliestUnlockSeconds: bigint | null;
};

export type UseRealVeMezoPositionResult = {
  data: RealVeMezoPosition | null;
  isLoading: boolean;
  isError: boolean;
  available: boolean;
};

export function useRealVeMezoPosition(
  user: Address | undefined,
): UseRealVeMezoPositionResult {
  const client = usePublicClient();
  const available = MEZO_NETWORK === "mainnet" && !!VE_MEZO_NFT_ADDRESS;

  const query = useQuery({
    queryKey: ["real-vemezo-position", user, VE_MEZO_NFT_ADDRESS],
    enabled: !!user && available && !!client,
    staleTime: 30_000,
    queryFn: async (): Promise<RealVeMezoPosition | null> => {
      if (!user || !client || !VE_MEZO_NFT_ADDRESS) return null;

      const nftCount = (await client.readContract({
        address: VE_MEZO_NFT_ADDRESS,
        abi: VEMEZO_READ_ABI,
        functionName: "balanceOf",
        args: [user],
      })) as bigint;

      if (nftCount === 0n) {
        return {
          nftCount: 0n,
          tokenIds: [],
          totalLockedMezoWei: 0n,
          totalVotingPowerWei: 0n,
          earliestUnlockSeconds: null,
        };
      }

      const enumerate = Math.min(Number(nftCount), MAX_TOKENS_READ);
      const tokenIds: bigint[] = [];
      let totalLocked = 0n;
      let totalPower = 0n;
      let earliestUnlock: bigint | null = null;

      // Sequential reads — viem multicall would be a nice optimization
      // but adds factory wiring; ≤10 reads per user is fine for the demo.
      for (let i = 0; i < enumerate; i++) {
        const tokenId = (await client.readContract({
          address: VE_MEZO_NFT_ADDRESS,
          abi: VEMEZO_READ_ABI,
          functionName: "ownerToNFTokenIdList",
          args: [user, BigInt(i)],
        })) as bigint;
        tokenIds.push(tokenId);

        const power = (await client.readContract({
          address: VE_MEZO_NFT_ADDRESS,
          abi: VEMEZO_READ_ABI,
          functionName: "votingPowerOfNFT",
          args: [tokenId],
        })) as bigint;
        totalPower += power;

        const lock = (await client.readContract({
          address: VE_MEZO_NFT_ADDRESS,
          abi: VEMEZO_READ_ABI,
          functionName: "locked",
          args: [tokenId],
        })) as { amount: bigint; end: bigint };
        // amount is int128; positive for active locks
        if (lock.amount > 0n) totalLocked += lock.amount;
        if (lock.end > 0n) {
          earliestUnlock =
            earliestUnlock === null
              ? lock.end
              : lock.end < earliestUnlock
                ? lock.end
                : earliestUnlock;
        }
      }

      return {
        nftCount,
        tokenIds,
        totalLockedMezoWei: totalLocked,
        totalVotingPowerWei: totalPower,
        earliestUnlockSeconds: earliestUnlock,
      };
    },
  });

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    available,
  };
}
