import { ethers, network } from "hardhat";
import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * End-to-end verification that v3 fan-out actually works on a live
 * chain (Mezo Testnet). The full flow:
 *
 *   1. Deployer/keeper EOA delegates self (already has 1500 veMEZO
 *      seed minted by deploy.ts).
 *   2. Keeper triggers castOptimalVote against the first 2 seeded
 *      gauges with 60/40 weights.
 *   3. Decode tx logs: assert exactly one VoteCast, zero VoteSkipped.
 *   4. Read MockGaugeController.lastVoter / getLastVote — confirm the
 *      adapter recorded the per-user vote against the keeper address.
 *
 * If this exits 0 against Mezo Testnet, the v3 Optimizer + iteration
 * + eligibility gate are all working against real chain state, not
 * just mock unit tests.
 */
async function main() {
  if (network.config.chainId !== 31611) {
    throw new Error(`Must run on mezoTestnet (31611). Got ${network.config.chainId}`);
  }

  const manifest = JSON.parse(
    readFileSync(resolve(__dirname, "..", "deployments", "mezo-testnet.json"), "utf8"),
  );
  const optAddr = manifest.contracts.MezoYieldOptimizer.address;
  const gctrlAddr = manifest.contracts.MockGaugeController.address;
  const veMezoAddr = manifest.contracts.MockVeMezo.address;
  const seeded = manifest.seededGauges as Array<{ name: string; address: string }>;

  const [keeper] = await ethers.getSigners();
  console.log("─".repeat(60));
  console.log("v3 testnet end-to-end verification");
  console.log("─".repeat(60));
  console.log(`Keeper EOA:           ${keeper.address}`);
  console.log(`MezoYieldOptimizer:   ${optAddr}`);
  console.log(`MockGaugeController:  ${gctrlAddr}`);
  console.log(`MockVeMezo:           ${veMezoAddr}`);
  console.log(`Seeded gauges:        ${seeded.length}`);
  console.log("");

  const optimizer = await ethers.getContractAt("MezoYieldOptimizer", optAddr, keeper);
  const gctrl = await ethers.getContractAt("MockGaugeController", gctrlAddr, keeper);
  const veMezo = new ethers.Contract(
    veMezoAddr,
    [
      "function balanceOf(address) view returns (uint256)",
      "function mint(address, uint256)",
    ],
    keeper,
  );

  // ─── 1. Eligibility precheck + delegate ───────────────────────
  const bal = await veMezo.balanceOf(keeper.address);
  console.log(`[1] veMezo.balanceOf(keeper): ${bal}`);
  if (bal === 0n) {
    throw new Error("Keeper has 0 veMezo — deploy.ts should have minted 1500.");
  }

  const alreadyDelegated = await optimizer.isDelegated(keeper.address);
  console.log(`    isDelegated(keeper): ${alreadyDelegated}`);
  if (!alreadyDelegated) {
    console.log("    submitting delegate(self)…");
    const tx = await optimizer.delegate(keeper.address);
    await tx.wait();
    console.log(`    delegate tx: ${tx.hash}`);
  }
  const delegatedCount = await optimizer.delegatedUsersCount();
  console.log(`    delegatedUsersCount: ${delegatedCount}`);

  // ─── 2. Trigger castOptimalVote ───────────────────────────────
  const voteGauges = seeded.slice(0, 2).map((g) => g.address);
  const voteWeights = [6000n, 4000n];
  console.log(`\n[2] castOptimalVote(${voteGauges.join(", ")}, [60%, 40%])…`);
  // Explicit gasLimit: estimator only sees the outer call succeed
  // (try/catch traps the inner OOG), so it under-allocates. Force
  // headroom — 200k per delegated user + 100k base is comfortable.
  const castTx = await optimizer.castOptimalVote(voteGauges, voteWeights, {
    gasLimit: 100_000n + 200_000n * (await optimizer.delegatedUsersCount()),
  });
  const receipt = await castTx.wait();
  if (!receipt) throw new Error("castOptimalVote: no receipt");
  console.log(`    castOptimalVote tx: ${castTx.hash}`);
  console.log(`    block:              ${receipt.blockNumber}`);

  // ─── 3. Decode logs ───────────────────────────────────────────
  const voteCastTopic = ethers.id("VoteCast(address[],uint256[])");
  const voteSkippedTopic = ethers.id("VoteSkipped(address,bytes)");
  const voteCastLogs = receipt.logs.filter(
    (l: { topics: ReadonlyArray<string>; address: string }) =>
      l.topics[0] === voteCastTopic && l.address.toLowerCase() === optAddr.toLowerCase(),
  );
  const voteSkippedLogs = receipt.logs.filter(
    (l: { topics: ReadonlyArray<string>; address: string }) =>
      l.topics[0] === voteSkippedTopic && l.address.toLowerCase() === optAddr.toLowerCase(),
  );
  console.log(`    VoteCast logs:      ${voteCastLogs.length}`);
  console.log(`    VoteSkipped logs:   ${voteSkippedLogs.length}`);

  // ─── 4. Adapter recorded the vote against the user ────────────
  const lastVoter = await gctrl.lastVoter();
  const [lastGauges, lastWeights] = await gctrl.getLastVote();
  console.log(`    gctrl.lastVoter:    ${lastVoter}`);
  console.log(`    gctrl.lastVote:     ${lastGauges} weights=${lastWeights}`);

  // ─── 5. Assertions ────────────────────────────────────────────
  console.log("\n[3] Assertions:");
  if (voteCastLogs.length !== 1) throw new Error(`expected 1 VoteCast, got ${voteCastLogs.length}`);
  if (voteSkippedLogs.length !== 0) throw new Error(`expected 0 VoteSkipped, got ${voteSkippedLogs.length}`);
  if (lastVoter.toLowerCase() !== keeper.address.toLowerCase()) {
    throw new Error(`lastVoter mismatch — got ${lastVoter}, expected ${keeper.address}`);
  }
  console.log("    ✅ VoteCast emitted exactly once");
  console.log("    ✅ Zero VoteSkipped — every delegated user's vote landed");
  console.log("    ✅ Gauge controller recorded the per-user voter, not the optimizer");
  console.log("\n🎉 v3 fan-out works end-to-end on Mezo Testnet (chain 31611).");
}

main().catch((err) => {
  console.error("\n❌ Testnet flow FAILED:");
  console.error(err);
  process.exitCode = 1;
});
