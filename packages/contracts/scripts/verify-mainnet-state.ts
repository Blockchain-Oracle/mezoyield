import { ethers, network } from "hardhat";
import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * Read-only diagnostic. Hits Mezo Mainnet via the configured RPC and
 * prints every state field that determines whether the keeper can vote
 * and whether the dApp can show non-zero numbers. No private key
 * needed — pure `eth_call` / `eth_getLogs`.
 *
 * Run: `pnpm --filter @mezoyield/contracts exec hardhat run scripts/verify-mainnet-state.ts --network mezoMainnet`
 */
async function main() {
  if (network.config.chainId !== 31612) {
    throw new Error(`Must run on mezoMainnet (31612). Got ${network.config.chainId}`);
  }

  const manifest = JSON.parse(
    readFileSync(resolve(__dirname, "..", "deployments", "mezo-mainnet.json"), "utf8"),
  );

  const optimizerAddr = manifest.contracts.MezoYieldOptimizer.address as string;
  const adapterAddr = manifest.contracts.MockGaugeController.address as string;
  const matchboxAddr = manifest.contracts.MockMatchbox.address as string;
  const votingPowerAddr = manifest.contracts.MockVeMezo.address as string;
  const realVeMezo = manifest.external.VeMEZO as string;
  const realBoostVoter = manifest.external.MezoBoostVoter as string;
  const keeperEoa = manifest.deployer as string;
  const deployBlock = manifest.contracts.MezoYieldOptimizer.blockNumber as number;

  const provider = ethers.provider;
  const head = await provider.getBlockNumber();

  console.log("─".repeat(60));
  console.log("Mezo Mainnet state check — ", new Date().toISOString());
  console.log("─".repeat(60));
  console.log(`Head block:           ${head}`);
  console.log(`Optimizer deploy:     ${deployBlock} (${head - deployBlock} blocks ago)`);
  console.log("");
  console.log("ADDRESSES");
  console.log(`  Optimizer:          ${optimizerAddr}`);
  console.log(`  BoostVoterAdapter:  ${adapterAddr}  (slot: MockGaugeController)`);
  console.log(`  MatchboxAdapter:    ${matchboxAddr}  (slot: MockMatchbox)`);
  console.log(`  VeMezoVotingPower:  ${votingPowerAddr}  (slot: MockVeMezo)`);
  console.log(`  REAL VeMEZO NFT:    ${realVeMezo}`);
  console.log(`  REAL BoostVoter:    ${realBoostVoter}`);
  console.log(`  Keeper EOA:         ${keeperEoa}`);
  console.log("");

  // ─── Optimizer state ─────────────────────────────────────────
  const optimizer = await ethers.getContractAt("MezoYieldOptimizer", optimizerAddr);
  console.log("OPTIMIZER STATE");
  const owner = await optimizer.owner();
  const keeper = await optimizer.keeper();
  const gctrl = await optimizer.gaugeController();
  const mbox = await optimizer.matchbox();
  console.log(`  owner():            ${owner}  ${owner.toLowerCase() === keeperEoa.toLowerCase() ? "✓" : "✗ MISMATCH"}`);
  console.log(`  keeper():           ${keeper}  ${keeper.toLowerCase() === keeperEoa.toLowerCase() ? "✓" : "✗ MISMATCH"}`);
  console.log(`  gaugeController():  ${gctrl}  ${gctrl.toLowerCase() === adapterAddr.toLowerCase() ? "✓ → BoostVoterAdapter" : "✗ MISMATCH"}`);
  console.log(`  matchbox():         ${mbox}  ${mbox.toLowerCase() === matchboxAddr.toLowerCase() ? "✓ → MatchboxAdapter" : "✗ MISMATCH"}`);
  const isDelegatedKeeper = await optimizer.isDelegated(keeperEoa);
  console.log(`  isDelegated(keeper EOA): ${isDelegatedKeeper}`);
  console.log("");

  // ─── BoostVoterAdapter registry ──────────────────────────────
  const adapter = await ethers.getContractAt("BoostVoterAdapter", adapterAddr);
  console.log("BOOST-VOTER-ADAPTER STATE");
  console.log(`  owner():            ${await adapter.owner()}`);
  const gauges: string[] = await adapter.gauges();
  console.log(`  gauges() count:     ${gauges.length}`);
  for (const g of gauges) {
    const [name, total] = await adapter.gaugeMeta(g);
    console.log(`    ${g}  name="${name}"  totalVeMezo=${total}`);
  }
  console.log("");

  // ─── MatchboxAdapter registry ────────────────────────────────
  const matchbox = await ethers.getContractAt("MatchboxAdapter", matchboxAddr);
  console.log("MATCHBOX-ADAPTER STATE");
  console.log(`  owner():            ${await matchbox.owner()}`);
  const trackedCount: bigint = await matchbox.trackedGaugesCount();
  console.log(`  trackedGaugesCount: ${trackedCount}`);
  for (let i = 0n; i < trackedCount; i++) {
    const g: string = await matchbox.trackedGaugeAt(i);
    const bribe: bigint = await matchbox.bribeForGauge(g);
    console.log(`    [${i}] ${g}  bribe=${bribe}`);
  }
  console.log("");

  // ─── veMEZO NFT ownership ────────────────────────────────────
  const veMezo = new ethers.Contract(
    realVeMezo,
    ["function balanceOf(address) view returns (uint256)"],
    provider,
  );
  console.log("VE-MEZO NFT BALANCES (real Mezo veMEZO @ external.VeMEZO)");
  console.log(`  balanceOf(Optimizer):         ${await veMezo.balanceOf(optimizerAddr)}  ← keeper-call adapter checks this`);
  console.log(`  balanceOf(BoostVoterAdapter): ${await veMezo.balanceOf(adapterAddr)}`);
  console.log(`  balanceOf(Keeper EOA):        ${await veMezo.balanceOf(keeperEoa)}`);
  console.log("");

  // ─── Keeper EOA gas balance ──────────────────────────────────
  const bal = await provider.getBalance(keeperEoa);
  console.log("KEEPER EOA");
  console.log(`  native balance:     ${ethers.formatEther(bal)} BTC`);
  console.log("");

  // ─── Event log scan ──────────────────────────────────────────
  console.log("EVENT LOGS (since deploy block)");
  const voteCastTopic = ethers.id("VoteCast(address[],uint256[])");
  const delegatedTopic = ethers.id("Delegated(address)");
  const manualAllocTopic = ethers.id("ManualAllocationSet(address,address[],uint256[])");

  // Walk in 9999-block chunks (matches useLastVote)
  const CHUNK = 9999;
  let voteCastCount = 0;
  let delegatedCount = 0;
  let manualAllocCount = 0;
  let lastVoteCastBlock: number | null = null;
  let firstDelegatedBlock: number | null = null;
  let firstDelegatedAddrs: string[] = [];
  let lastManualAllocBlock: number | null = null;

  for (let from = deployBlock; from <= head; from += CHUNK + 1) {
    const to = Math.min(from + CHUNK, head);
    const logs = await provider.getLogs({
      address: optimizerAddr,
      fromBlock: from,
      toBlock: to,
      topics: [[voteCastTopic, delegatedTopic, manualAllocTopic]],
    });
    for (const l of logs) {
      if (l.topics[0] === voteCastTopic) {
        voteCastCount++;
        lastVoteCastBlock = l.blockNumber;
      } else if (l.topics[0] === delegatedTopic) {
        delegatedCount++;
        if (firstDelegatedBlock === null) firstDelegatedBlock = l.blockNumber;
        const user = "0x" + l.topics[1].slice(26);
        firstDelegatedAddrs.push(user);
      } else if (l.topics[0] === manualAllocTopic) {
        manualAllocCount++;
        lastManualAllocBlock = l.blockNumber;
      }
    }
  }
  console.log(`  VoteCast events:           ${voteCastCount}${lastVoteCastBlock ? ` (last @ block ${lastVoteCastBlock})` : " ← keeper has NEVER successfully voted"}`);
  console.log(`  Delegated events:          ${delegatedCount}${firstDelegatedBlock ? ` (first @ block ${firstDelegatedBlock})` : ""}`);
  if (firstDelegatedAddrs.length > 0) {
    console.log(`    addresses (first 5):     ${firstDelegatedAddrs.slice(0, 5).join(", ")}`);
  }
  console.log(`  ManualAllocationSet events: ${manualAllocCount}${lastManualAllocBlock ? ` (last @ block ${lastManualAllocBlock})` : ""}`);
  console.log("");

  console.log("─".repeat(60));
  console.log("DONE");
  console.log("─".repeat(60));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
