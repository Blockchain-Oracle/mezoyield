import { expect } from "chai";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

/**
 * Locks the on-chain manifest written by `scripts/deploy.ts` to the shape
 * STORY-004 BDD requires. Catches regressions like writing the wrong slug
 * (`mezoTestnet.json` instead of `mezo-testnet.json`), dropping txHashes,
 * misnaming the contract keys, or shipping a manifest pointing at the wrong
 * chain.
 *
 * The test reads the committed file under
 * `packages/contracts/deployments/mezo-testnet.json` — this is the same
 * file `packages/app/lib/contracts.ts` imports, so any divergence between
 * the deploy script's output shape and the consumer expectations will be
 * caught here regardless of which side broke.
 */
describe("deployments/mezo-testnet.json", () => {
  const file = resolve(__dirname, "../deployments/mezo-testnet.json");

  it("is committed at the kebab-case path STORY-004 expects", () => {
    expect(existsSync(file), `${file} must exist after deploy:testnet`).to.be.true;
  });

  it("matches the schema required by lib/contracts.ts", () => {
    const json = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;

    // Top-level: chain identity + provenance.
    expect(json.chainId).to.equal(31611);
    expect(json.network).to.equal("mezoTestnet");
    expect(json.rpcUrl).to.be.a("string").and.match(/^https?:\/\//);
    expect(json.deployer).to.be.a("string").and.match(/^0x[0-9a-fA-F]{40}$/);
    expect(json.deployedAt).to.be.a("string").and.match(/^\d{4}-\d{2}-\d{2}T/);

    // Per-contract: address + txHash + blockNumber, all three required
    // by story-004's BDD ("written with address, txHash, blockNumber").
    const contracts = json.contracts as Record<string, Record<string, unknown>>;
    expect(contracts).to.be.an("object");
    for (const name of ["MezoYieldOptimizer", "MockGaugeController", "MockMatchbox"]) {
      const c = contracts[name];
      expect(c, `contracts.${name} must be present`).to.exist;
      expect(c.address, `contracts.${name}.address must be 0x-hex`).to.match(
        /^0x[0-9a-fA-F]{40}$/,
      );
      expect(c.txHash, `contracts.${name}.txHash must be 0x-hex`).to.match(
        /^0x[0-9a-fA-F]{64}$/,
      );
      expect(c.blockNumber, `contracts.${name}.blockNumber must be a number`).to.be.a(
        "number",
      );
    }

    // Disclosure note about mocks (CONTEXT.md OQ #6) is part of the contract.
    expect(json.notes, "manifest.notes documents the mock disclosure").to.be.a(
      "string",
    ).and.match(/mock|stand-in/i);
  });
});
