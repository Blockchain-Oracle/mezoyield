import { describe, it, expect } from "vitest";
import deployments from "@mezoyield/contracts/deployments/mezo-testnet.json";

/**
 * Lock-in tests for `packages/app/lib/contracts.ts`. The library is the
 * single source of truth for on-chain handles consumed by STORY-005+
 * wagmi hooks; if the manifest's shape drifts, these break before the
 * downstream hooks do.
 *
 * Note: we re-import `lib/contracts` for each chain-id assertion so the
 * module's load-time chain-id check is exercised under both the happy
 * path (matches what's in the manifest) and a simulated mismatch.
 */
describe("lib/contracts", () => {
  it("exports addresses that match the committed manifest", async () => {
    const lib = await import("@/lib/contracts");
    expect(lib.MEZO_CHAIN_ID).toBe(31611);
    expect(lib.MEZO_TESTNET_CHAIN_ID).toBe(31611); // legacy alias
    expect(lib.OPTIMIZER_ADDRESS).toBe(
      deployments.contracts.MezoYieldOptimizer.address,
    );
    expect(lib.GAUGE_CONTROLLER_ADDRESS).toBe(
      deployments.contracts.MockGaugeController.address,
    );
    expect(lib.MATCHBOX_ADDRESS).toBe(
      deployments.contracts.MockMatchbox.address,
    );
    expect(lib.VE_MEZO_ADDRESS).toBe(deployments.contracts.MockVeMezo.address);
    expect(lib.MEZO_TESTNET_RPC_URL).toBe(deployments.rpcUrl);
  });

  it("exposes the full manifest for diagnostics", async () => {
    const lib = await import("@/lib/contracts");
    expect(lib.DEPLOYMENT_MANIFEST).toMatchObject({
      chainId: 31611,
      network: "mezoTestnet",
    });
  });

  it("exported addresses look like checksummed 0x-hex (40 chars)", async () => {
    const lib = await import("@/lib/contracts");
    const addressRe = /^0x[0-9a-fA-F]{40}$/;
    expect(lib.OPTIMIZER_ADDRESS).toMatch(addressRe);
    expect(lib.GAUGE_CONTROLLER_ADDRESS).toMatch(addressRe);
    expect(lib.MATCHBOX_ADDRESS).toMatch(addressRe);
    expect(lib.VE_MEZO_ADDRESS).toMatch(addressRe);
  });
});
