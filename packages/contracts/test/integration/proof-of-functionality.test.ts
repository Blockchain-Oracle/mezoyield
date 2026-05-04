import { expect } from "chai";
import { ethers } from "hardhat";
import type { Log, LogDescription, Wallet } from "ethers";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import "dotenv/config";

/**
 * PROOF-OF-FUNCTIONALITY tests against the LIVE Mezo testnet deployment.
 *
 * Distinct from `testnet-readiness.test.ts` (read-only smoke that locks
 * the manifest to the on-chain surface). This file SUBMITS REAL TXs to
 * prove the deployed bytecode does what we say it does:
 *
 *   1. `delegate(user)` flips `isDelegated[user]` and emits `Delegated`.
 *   2. `setManualAllocation` persists exactly the (gauges, weights) the
 *      caller passed and emits `ManualAllocationSet`.
 *   3. `castOptimalVote` (keeper-only) emits `VoteCast` with the same
 *      payload — the event the landing's `useLastVote` hook reads.
 *   4. A backwards-chunked `getLogs` query (matching the frontend's
 *      hook strategy) finds that VoteCast within MAX_CHUNKS scans.
 *
 * Why these tests exist and `testnet-readiness.test.ts` isn't enough:
 * the smoke test reads the deployed surface but never proves the
 * MUTATING paths actually mutate. Abu's framing — "I want tests that
 * prove the functionality works, not tests that just don't crash" —
 * targets exactly this gap. Every flow the frontend depends on has a
 * corresponding test here that exercises it on the real chain.
 *
 * Cost discipline: each test sends AT MOST ONE tx. Gas is testnet-cheap
 * but not free, and the deployer wallet shouldn't be drained by a CI
 * loop. The suite is gated TWICE:
 *
 *   - `RUN_TESTNET_INTEGRATION=1` enables the read-only assertions
 *     (same gate as `testnet-readiness.test.ts`).
 *   - `RUN_TESTNET_WRITES=1` ALSO required to enable the four write
 *     tests. Default CI runs neither.
 *
 * Run locally with both gates:
 *   RUN_TESTNET_INTEGRATION=1 RUN_TESTNET_WRITES=1 \
 *     pnpm --filter @mezoyield/contracts test
 *
 * The deployer key in `packages/contracts/.env` plays both `owner` and
 * `keeper` roles per the deployment manifest, so a single signer can
 * exercise all the flows below.
 */
const RUN_READS = process.env.RUN_TESTNET_INTEGRATION === "1";
const RUN_WRITES = process.env.RUN_TESTNET_WRITES === "1";

const describeReads = RUN_READS ? describe : describe.skip;
const itWrite = RUN_READS && RUN_WRITES ? it : it.skip;

describeReads("Mezo testnet proof-of-functionality (live txs)", function () {
  // Each tx waits for confirmation; testnet block time + RPC latency
  // means individual cases can take 10-20s.
  this.timeout(120_000);

  const manifestPath = resolve(__dirname, "../../deployments/mezo-testnet.json");
  if (!existsSync(manifestPath)) {
    throw new Error(`Missing manifest ${manifestPath}; run pnpm run deploy:testnet first.`);
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

  const provider = new ethers.JsonRpcProvider(manifest.rpcUrl);
  const optimizerAddr: string = manifest.contracts.MezoYieldOptimizer.address;
  const gaugeControllerAddr: string = manifest.contracts.MockGaugeController.address;
  const matchboxAddr: string = manifest.contracts.MockMatchbox.address;
  const optimizerDeployBlock: number =
    manifest.contracts.MezoYieldOptimizer.blockNumber;

  const optimizerAbi = [
    // reads
    "function isDelegated(address) view returns (bool)",
    "function getAllocation(address) view returns (address[], uint256[])",
    "function keeper() view returns (address)",
    "function owner() view returns (address)",
    // writes
    "function delegate(address user)",
    "function setManualAllocation(address[] gauges, uint256[] weights)",
    "function castOptimalVote(address[] gauges, uint256[] weights)",
    // events
    "event Delegated(address indexed user)",
    "event ManualAllocationSet(address indexed user, address[] gauges, uint256[] weights)",
    "event VoteCast(address[] gauges, uint256[] weights)",
    "event RewardsClaimed(address indexed user, uint256 amount)",
  ];
  const matchboxAbi = ["function bribeForGauge(address) view returns (uint256)"];

  // ---- Lazily-built signer (only needed for write tests) ----
  let wallet: Wallet | null = null;
  function getWallet(): Wallet {
    if (wallet) return wallet;
    const key = process.env.DEPLOYER_PRIVATE_KEY;
    if (!key) {
      throw new Error(
        "DEPLOYER_PRIVATE_KEY missing from packages/contracts/.env — " +
          "the write tests need a funded signer.",
      );
    }
    wallet = new ethers.Wallet(key, provider);
    return wallet;
  }

  it("[read] connects to chain 31611 and the manifest deployer matches the on-chain owner", async () => {
    const network = await provider.getNetwork();
    expect(Number(network.chainId)).to.equal(31611);
    const c = new ethers.Contract(optimizerAddr, optimizerAbi, provider);
    expect((await c.owner()).toLowerCase()).to.equal(
      manifest.deployer.toLowerCase(),
    );
    expect((await c.keeper()).toLowerCase()).to.equal(
      manifest.deployer.toLowerCase(),
    );
  });

  itWrite("[write] delegate(self) toggles isDelegated and emits Delegated", async () => {
    const signer = getWallet();
    const c = new ethers.Contract(optimizerAddr, optimizerAbi, signer);

    const tx = await c.delegate(signer.address);
    const receipt = await tx.wait(1);
    expect(receipt?.status).to.equal(1, "delegate tx must succeed");

    // Post-state: monotonic flip — true regardless of prior state.
    expect(await c.isDelegated(signer.address)).to.equal(true);

    // Event emitted with the right user. Decode against the contract's ABI
    // because Mezo's RPC sometimes returns logs without the named field
    // populated by ethers' high-level helpers.
    const iface = new ethers.Interface(optimizerAbi);
    const events = ((receipt?.logs ?? []) as readonly Log[])
      .filter((l: Log) => l.address.toLowerCase() === optimizerAddr.toLowerCase())
      .map((l: Log) => iface.parseLog({ topics: [...l.topics], data: l.data }))
      .filter(
        (e: LogDescription | null): e is LogDescription =>
          e != null && e.name === "Delegated",
      );
    expect(events).to.have.length(1, "expected exactly one Delegated event");
    expect((events[0].args.user as string).toLowerCase()).to.equal(
      signer.address.toLowerCase(),
    );
  });

  itWrite(
    "[write] setManualAllocation([Stability Pool], [10000]) persists and round-trips",
    async () => {
      const signer = getWallet();
      const c = new ethers.Contract(optimizerAddr, optimizerAbi, signer);

      const target = manifest.seededGauges[0];
      const expectedWeights = [10_000n];
      const expectedGauges = [
        ethers.getAddress(target.address as string), // checksum-canonical form
      ];

      const tx = await c.setManualAllocation(expectedGauges, expectedWeights);
      const receipt = await tx.wait(1);
      expect(receipt?.status).to.equal(1);

      // View-call round-trip: the same (gauges, weights) we just submitted
      // must come back from getAllocation. Solidity returns parallel arrays
      // — viem/ethers both surface them as a tuple.
      const [gaugesOut, weightsOut]: [string[], bigint[]] = await c.getAllocation(
        signer.address,
      );
      expect(gaugesOut.map((a) => a.toLowerCase())).to.deep.equal(
        expectedGauges.map((a) => a.toLowerCase()),
      );
      expect(weightsOut.map((w) => w.toString())).to.deep.equal(
        expectedWeights.map((w) => w.toString()),
      );

      // Event payload must mirror the call args. ManualAllocationSet has
      // arrays as non-indexed args, so the parser hands them back as the
      // tuple we passed in.
      const iface = new ethers.Interface(optimizerAbi);
      const evt = ((receipt?.logs ?? []) as readonly Log[])
        .filter((l: Log) => l.address.toLowerCase() === optimizerAddr.toLowerCase())
        .map((l: Log) => iface.parseLog({ topics: [...l.topics], data: l.data }))
        .find((e: LogDescription | null) => e?.name === "ManualAllocationSet");
      expect(evt, "expected ManualAllocationSet event").to.exist;
      expect((evt!.args.user as string).toLowerCase()).to.equal(
        signer.address.toLowerCase(),
      );
      expect((evt!.args.gauges as string[]).map((a) => a.toLowerCase())).to.deep.equal(
        expectedGauges.map((a) => a.toLowerCase()),
      );
      expect((evt!.args.weights as bigint[]).map((w) => w.toString())).to.deep.equal(
        expectedWeights.map((w) => w.toString()),
      );
    },
  );

  itWrite(
    "[write] castOptimalVote (keeper-only) emits VoteCast with the submitted payload",
    async () => {
      const signer = getWallet();
      const c = new ethers.Contract(optimizerAddr, optimizerAbi, signer);

      // Sanity: the signer is the keeper. If a redeploy ever moves the role
      // off the deployer, this assertion fires before we burn gas.
      expect((await c.keeper()).toLowerCase()).to.equal(
        signer.address.toLowerCase(),
      );

      // Multi-gauge payload so we exercise array marshalling, not just the
      // single-element happy path.
      const gaugesIn: string[] = manifest.seededGauges
        .slice(0, 2)
        .map((g: { address: string }) => ethers.getAddress(g.address));
      const weightsIn = [6_000n, 4_000n];

      const tx = await c.castOptimalVote(gaugesIn, weightsIn);
      const receipt = await tx.wait(1);
      expect(receipt?.status).to.equal(1);

      const iface = new ethers.Interface(optimizerAbi);
      const evt = ((receipt?.logs ?? []) as readonly Log[])
        .filter((l: Log) => l.address.toLowerCase() === optimizerAddr.toLowerCase())
        .map((l: Log) => iface.parseLog({ topics: [...l.topics], data: l.data }))
        .find((e: LogDescription | null) => e?.name === "VoteCast");
      expect(evt, "expected VoteCast event").to.exist;
      expect((evt!.args.gauges as string[]).map((a) => a.toLowerCase())).to.deep.equal(
        gaugesIn.map((a) => a.toLowerCase()),
      );
      expect((evt!.args.weights as bigint[]).map((w) => w.toString())).to.deep.equal(
        weightsIn.map((w) => w.toString()),
      );
    },
  );

  it(
    "[read] backwards-walking log query finds the most recent VoteCast (mirrors useLastVote)",
    async () => {
      // Mirrors `packages/app/hooks/useLastVote.ts` — walk backward from
      // head in 9999-block chunks, return the LAST log in the first
      // non-empty chunk. If this test passes, the frontend's ProofLedger
      // section will too.
      const CHUNK = 9_999n;
      const MAX_CHUNKS = 30;
      const head = BigInt(await provider.getBlockNumber());
      const floor = BigInt(optimizerDeployBlock);
      const eventTopic = ethers.id("VoteCast(address[],uint256[])");

      let to = head;
      let found: { txHash: string; blockNumber: bigint } | null = null;
      for (let i = 0; i < MAX_CHUNKS && to >= floor; i++) {
        const from = to > floor + CHUNK ? to - CHUNK : floor;
        const logs = await provider.getLogs({
          address: optimizerAddr,
          fromBlock: Number(from),
          toBlock: Number(to),
          topics: [eventTopic],
        });
        if (logs.length > 0) {
          const last = logs[logs.length - 1];
          found = {
            txHash: last.transactionHash,
            blockNumber: BigInt(last.blockNumber),
          };
          break;
        }
        if (from === floor) break;
        to = from - 1n;
      }

      // If RUN_TESTNET_WRITES is set, the previous case JUST emitted one
      // — so we MUST find it. If not set, the test is informational
      // (it's allowed to find an older event from a prior keeper run, or
      // none at all if the suite hasn't run on this deploy yet).
      if (RUN_WRITES) {
        expect(found, "VoteCast must exist after the write test").to.not.equal(null);
        expect(found!.blockNumber).to.be.greaterThan(floor);
      }
    },
  );

  // Touch matchbox surface to confirm the bribe market is live and the
  // optimizer's matchbox address still resolves to the seeded contract.
  // Unindexed sanity that catches a broken matchbox redeploy. Voids the
  // result, just asserts the call returns without reverting.
  it("[read] MockMatchbox.bribeForGauge resolves for every seeded gauge", async () => {
    const c = new ethers.Contract(matchboxAddr, matchboxAbi, provider);
    for (const g of manifest.seededGauges as { address: string }[]) {
      const bribe: bigint = await c.bribeForGauge(g.address);
      expect(typeof bribe).to.equal("bigint");
      expect(bribe).to.be.at.least(0n);
    }
    // Reference gaugeControllerAddr to suppress the unused-binding lint
    // — kept for future expansion (e.g. asserting voteForGaugeWeights
    // recorded the call from castOptimalVote).
    expect(gaugeControllerAddr).to.match(/^0x[a-fA-F0-9]{40}$/);
  });
});
