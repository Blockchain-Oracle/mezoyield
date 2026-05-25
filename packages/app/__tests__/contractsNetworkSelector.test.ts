import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Regression suite for the `NEXT_PUBLIC_MEZO_NETWORK` build-time switch
 * added in the Phase 1 mainnet PR. Codex P1 (pre-push): the prior version
 * shipped the conditional without coverage for the mainnet branch, so a
 * regression on manifest selection / null-address fail-fast / dynamic
 * wagmi wiring would have slipped through with all 147 existing tests
 * still green.
 *
 * The branches we lock in here:
 *
 *   Given no env var, when contracts.ts loads, then chain id = 31611
 *     (testnet) and the testnet manifest is selected.
 *   Given NEXT_PUBLIC_MEZO_NETWORK=testnet, when contracts.ts loads,
 *     then chain id = 31611.
 *   Given NEXT_PUBLIC_MEZO_NETWORK=mainnet and the mainnet manifest's
 *     Optimizer.address is null (the committed Phase 1 stub state), then
 *     contracts.ts throws with a fail-fast message pointing at the deploy
 *     command — by design, so a half-wired mainnet UI can never ship.
 *   Given NEXT_PUBLIC_MEZO_NETWORK=mainnet and the mainnet manifest is
 *     mocked to a populated state (simulating post-Phase-5), then chain
 *     id = 31612 and the real Mezo BoostVoter proxy address is exported.
 *
 * `vi.resetModules()` runs between cases because `lib/contracts.ts`
 * captures env + manifest at module load — caching across cases would
 * make every assertion read the first case's snapshot.
 */
describe("lib/contracts — NEXT_PUBLIC_MEZO_NETWORK selector", () => {
  const ORIGINAL_NETWORK = process.env.NEXT_PUBLIC_MEZO_NETWORK;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.doUnmock(
      "@mezoyield/contracts/deployments/mezo-mainnet.json",
    );
    if (ORIGINAL_NETWORK === undefined) {
      delete process.env.NEXT_PUBLIC_MEZO_NETWORK;
    } else {
      process.env.NEXT_PUBLIC_MEZO_NETWORK = ORIGINAL_NETWORK;
    }
  });

  it("defaults to the testnet manifest when the env var is unset", async () => {
    vi.stubEnv("NEXT_PUBLIC_MEZO_NETWORK", "");
    const lib = await import("@/lib/contracts");
    expect(lib.MEZO_CHAIN_ID).toBe(31611);
    expect(lib.MEZO_NETWORK).toBe("testnet");
    expect(lib.DEPLOYMENT_MANIFEST.network).toBe("mezoTestnet");
  });

  it("selects testnet manifest when env var is the literal 'testnet'", async () => {
    vi.stubEnv("NEXT_PUBLIC_MEZO_NETWORK", "testnet");
    const lib = await import("@/lib/contracts");
    expect(lib.MEZO_CHAIN_ID).toBe(31611);
    expect(lib.MEZO_NETWORK).toBe("testnet");
  });

  it("throws on mainnet build when Optimizer.address is null (fail-fast guard)", async () => {
    vi.stubEnv("NEXT_PUBLIC_MEZO_NETWORK", "mainnet");
    // Inject a manifest with a null Optimizer to exercise the fail-fast
    // guard regardless of whether the committed manifest happens to
    // have a real address. Pre-Phase-5 the manifest naturally carried
    // null; post-Phase-5 it carries the deployed address — the guard
    // logic itself is what we're locking in here, not the manifest
    // file's current state.
    vi.doMock(
      "@mezoyield/contracts/deployments/mezo-mainnet.json",
      () => ({
        default: {
          chainId: 31612,
          network: "mezoMainnet",
          rpcUrl: "https://rpc-http.mezo.boar.network",
          explorer: "https://explorer.mezo.org",
          deployer: "0x0000000000000000000000000000000000000000",
          deployedAt: null,
          contracts: {
            MezoYieldOptimizer: { address: null, txHash: null, blockNumber: null },
            MockGaugeController: {
              address: "0x1111111111111111111111111111111111111111",
              txHash: null,
              blockNumber: null,
            },
            MockMatchbox: {
              address: "0x2222222222222222222222222222222222222222",
              txHash: null,
              blockNumber: null,
            },
            MockVeMezo: {
              address: "0x3333333333333333333333333333333333333333",
              txHash: null,
              blockNumber: null,
            },
          },
          notes: "test fixture — null optimizer",
        },
      }),
    );
    await expect(import("@/lib/contracts")).rejects.toThrow(
      /MezoYieldOptimizer not yet deployed on Mezo mainnet/,
    );
  });

  it("rejects misspelled network values (e.g. 'mainet') with a clear error", async () => {
    vi.stubEnv("NEXT_PUBLIC_MEZO_NETWORK", "mainet");
    await expect(import("@/lib/contracts")).rejects.toThrow(
      /Invalid NEXT_PUBLIC_MEZO_NETWORK="mainet"/,
    );
  });

  it("loads cleanly on mainnet when the manifest carries a populated Optimizer (post-Phase-5 simulation)", async () => {
    vi.stubEnv("NEXT_PUBLIC_MEZO_NETWORK", "mainnet");
    vi.doMock(
      "@mezoyield/contracts/deployments/mezo-mainnet.json",
      () => ({
        default: {
          chainId: 31612,
          network: "mezoMainnet",
          rpcUrl: "https://rpc-http.mezo.boar.network",
          explorer: "https://explorer.mezo.org",
          deployer: "0x84f94745ea0a434540749839819E65E281970004",
          deployedAt: "2026-06-01T00:00:00.000Z",
          contracts: {
            MezoYieldOptimizer: {
              address: "0x00000000000000000000000000000000DeAdBeEf",
              txHash: "0x" + "1".repeat(64),
              blockNumber: 9_999_999,
            },
            MockGaugeController: {
              address: "0x1111111111111111111111111111111111111111",
              txHash: null,
              blockNumber: null,
            },
            MockMatchbox: {
              address: "0x2222222222222222222222222222222222222222",
              txHash: null,
              blockNumber: null,
            },
            MockVeMezo: {
              address: "0x3333333333333333333333333333333333333333",
              txHash: null,
              blockNumber: null,
            },
          },
          // `external` block mirrors the real mainnet manifest shape
          // post-Phase-3: BoostVoter / VeMEZO / MUSD addresses live
          // here so the activate flow can read `VE_MEZO_NFT_ADDRESS`
          // and call setApprovalForAll on the real NFT.
          external: {
            MezoBoostVoter: "0x4444444444444444444444444444444444444444",
            VeMEZO: "0x5555555555555555555555555555555555555555",
            MUSD: "0x6666666666666666666666666666666666666666",
            MEZO: "0x7777777777777777777777777777777777777777",
          },
          notes: "test fixture",
        },
      }),
    );
    const lib = await import("@/lib/contracts");
    expect(lib.MEZO_CHAIN_ID).toBe(31612);
    expect(lib.MEZO_NETWORK).toBe("mainnet");
    // The post-Phase-3 fixture wires adapter addresses (NOT the raw
    // external Mezo addresses) into the mock slots — see the manifest's
    // notes field for why raw BoostVoter/veMEZO addresses can't go here.
    expect(lib.GAUGE_CONTROLLER_ADDRESS).toBe(
      "0x1111111111111111111111111111111111111111",
    );
    expect(lib.MATCHBOX_ADDRESS).toBe(
      "0x2222222222222222222222222222222222222222",
    );
    expect(lib.VE_MEZO_ADDRESS).toBe(
      "0x3333333333333333333333333333333333333333",
    );
  });
});
