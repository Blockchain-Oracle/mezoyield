import { expect } from "chai";
import { ethers, artifacts } from "hardhat";

/**
 * Locks in the "swap-compatible" claim from `TESTNET_ADDRESSES.md`:
 * both `MockGaugeController` (testnet) and `BoostVoterAdapter`
 * (mainnet) MUST expose the same `IGaugeController` surface so the
 * `MezoYieldOptimizer` is chain-agnostic.
 *
 * The behavioral delta (veMEZO NFT check, setApprovalForAll
 * requirement, etc.) is intentional and documented. What this test
 * guards against is the *interface* drifting silently — e.g. if a
 * future PR adds a new method to `BoostVoterAdapter` without adding
 * the corresponding stub on `MockGaugeController`, the Optimizer's
 * interface-typed calls would break on testnet.
 *
 * Cheap (no deploys, just ABI introspection). Run as part of the
 * standard `pnpm test` gate.
 */

const IGAUGE_CONTROLLER_SIGNATURES = [
  "voteForGaugeWeights(address[],uint256[])",
  "voteForUser(address,address[],uint256[])",
] as const;

const READ_SURFACE_SIGNATURES = [
  "gauges()",
  "gaugeMeta(address)",
] as const;

async function selectorsFromContract(contractName: string): Promise<Set<string>> {
  const artifact = await artifacts.readArtifact(contractName);
  const iface = new ethers.Interface(artifact.abi);
  const selectors = new Set<string>();
  iface.forEachFunction((fn) => selectors.add(fn.selector));
  return selectors;
}

describe("Interface conformance: MockGaugeController vs BoostVoterAdapter", () => {
  it("both contracts expose the IGaugeController vote-write surface", async () => {
    const mockSelectors = await selectorsFromContract("MockGaugeController");
    const adapterSelectors = await selectorsFromContract("BoostVoterAdapter");

    for (const sig of IGAUGE_CONTROLLER_SIGNATURES) {
      const sel = ethers.id(sig).slice(0, 10);
      expect(mockSelectors.has(sel), `MockGaugeController missing ${sig} (${sel})`).to.equal(true);
      expect(adapterSelectors.has(sel), `BoostVoterAdapter missing ${sig} (${sel})`).to.equal(true);
    }
  });

  it("both contracts expose the registry read surface consumed by useGaugeData", async () => {
    const mockSelectors = await selectorsFromContract("MockGaugeController");
    const adapterSelectors = await selectorsFromContract("BoostVoterAdapter");

    for (const sig of READ_SURFACE_SIGNATURES) {
      const sel = ethers.id(sig).slice(0, 10);
      expect(mockSelectors.has(sel), `MockGaugeController missing ${sig} (${sel})`).to.equal(true);
      expect(adapterSelectors.has(sel), `BoostVoterAdapter missing ${sig} (${sel})`).to.equal(true);
    }
  });

  it("IGaugeController interface itself declares only what both implementations support", async () => {
    // Make sure nobody adds an IGaugeController method without
    // implementing it on both — IGaugeController's ABI is the contract.
    const ifaceArtifact = await artifacts.readArtifact("IGaugeController");
    const ifaceFns = new ethers.Interface(ifaceArtifact.abi);
    const mockSelectors = await selectorsFromContract("MockGaugeController");
    const adapterSelectors = await selectorsFromContract("BoostVoterAdapter");

    ifaceFns.forEachFunction((fn) => {
      expect(mockSelectors.has(fn.selector), `MockGaugeController missing IGaugeController.${fn.name}`).to.equal(true);
      expect(adapterSelectors.has(fn.selector), `BoostVoterAdapter missing IGaugeController.${fn.name}`).to.equal(true);
    });
  });
});
