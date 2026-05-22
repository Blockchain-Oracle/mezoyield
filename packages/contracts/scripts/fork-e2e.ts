import { ethers, network } from "hardhat";

/**
 * End-to-end integration test against a forked Mezo Mainnet. Proves the
 * v3 architecture works with the REAL Mezo BoostVoter + veMEZO before we
 * ever touch real mainnet state. No private keys needed — the fork lets
 * us impersonate any account.
 *
 *   ENV: MEZO_MAINNET_FORK=1  (configures the in-process hardhat network
 *                              to fork from Boar RPC)
 *   RUN: pnpm --filter @mezoyield/contracts exec hardhat run \
 *          scripts/fork-e2e.ts --network hardhat
 *
 * What it does:
 *   1. Probes the real BoostVoter for the first 5 gauges (iterates
 *      `gauges(uint256)` until OOB) — we need real gauge addresses,
 *      not the mock keccak placeholders used in the testnet manifest.
 *   2. Deploys fresh BoostVoterAdapter (pointing at real Mezo BoostVoter
 *      + real veMEZO) and MezoYieldOptimizer (pointing at adapter,
 *      MatchboxAdapter v3 from the manifest, VeMezoVotingPower from the
 *      manifest, keeper EOA).
 *   3. Wires setOptimizer.
 *   4. Registers the discovered real gauges on the adapter.
 *   5. Impersonates a real veMEZO holder (top holder from explorer).
 *      As holder: setApprovalForAll(adapter, true), delegate(self).
 *   6. Impersonates the keeper EOA. As keeper: castOptimalVote.
 *   7. Asserts: VoteCast event fired with userCount=1, BoostVoter.votes
 *      updated for holder's tokenId on the voted gauge.
 *
 * If this script exits 0, the v3 architecture works end-to-end against
 * the real Mezo BoostVoter ABI on real chain state. Any failure here
 * means the bug is real and would manifest on mainnet too — fix BEFORE
 * the actual mainnet redeploy.
 */
const REAL_BOOST_VOTER = "0x2Ba614a598Cffa5a19d683cDCA97bac3a49313d1";
const REAL_VE_MEZO = "0xb90fdAd3DFD180458D62Cc6acedc983D78E20122";
const MATCHBOX_ADAPTER_V3 = "0xdB2CB451fBCfa232d97d5De878F17Cc3F2b10535";
const VOTING_POWER_SHIM = "0x2d413D8267b9ab5DE06C8588da66d1Caff337544";
const KEEPER_EOA = "0x6A6D50F25A32f79bC784F7c67Df54ce21244834c";
// Top veMEZO NFT holder per https://api.explorer.mezo.org/api/v2/tokens
// /0xb90fdAd3...0122/holders — 17 NFTs as of 2026-05-22.
const VE_MEZO_HOLDER = "0x58C6A45AcFCc1fD0E5A103Cab2caE00b0B188EC5";

async function impersonate(address: string) {
  await network.provider.request({ method: "hardhat_impersonateAccount", params: [address] });
  // Top up gas so impersonated account can pay for txs.
  await network.provider.send("hardhat_setBalance", [address, "0x" + (10n ** 18n).toString(16)]);
  return await ethers.getSigner(address);
}

async function probeRealGauges(maxProbe = 10): Promise<string[]> {
  const boostVoter = new ethers.Contract(
    REAL_BOOST_VOTER,
    ["function gauges(uint256) view returns (address)"],
    ethers.provider,
  );
  const found: string[] = [];
  for (let i = 0; i < maxProbe; i++) {
    try {
      const g = await boostVoter.gauges(i);
      if (g === ethers.ZeroAddress) break;
      found.push(g);
    } catch {
      break;
    }
  }
  return found;
}

async function main() {
  if (process.env.MEZO_MAINNET_FORK !== "1") {
    throw new Error("Set MEZO_MAINNET_FORK=1 to fork Mezo Mainnet.");
  }
  const head = await ethers.provider.getBlockNumber();
  console.log(`Forked at block ${head}`);

  // 0. Probe real gauges.
  console.log("[0] Probing real Mezo BoostVoter for known gauges…");
  const realGauges = await probeRealGauges(20);
  if (realGauges.length === 0) {
    throw new Error("No gauges found on real BoostVoter — fork unreachable or BoostVoter empty.");
  }
  console.log(`    Found ${realGauges.length} gauges:`);
  realGauges.forEach((g, i) => console.log(`      [${i}] ${g}`));

  // Use first 2 real gauges as the keeper's vote targets.
  const voteGauges = realGauges.slice(0, 2);
  const voteWeights = [6000n, 4000n];

  // 1. Deploy v3 contracts using hardhat signer #0 as deployer.
  console.log("\n[1] Deploying v3 BoostVoterAdapter + Optimizer…");
  const [deployer] = await ethers.getSigners();
  console.log(`    Deployer (hardhat #0): ${deployer.address}`);

  const Adapter = await ethers.getContractFactory("BoostVoterAdapter", deployer);
  const adapter = await Adapter.deploy(REAL_BOOST_VOTER, REAL_VE_MEZO);
  await adapter.waitForDeployment();
  const adapterAddr = await adapter.getAddress();
  console.log(`    BoostVoterAdapter: ${adapterAddr}`);

  const Optimizer = await ethers.getContractFactory("MezoYieldOptimizer", deployer);
  const optimizer = await Optimizer.deploy(
    adapterAddr,
    MATCHBOX_ADAPTER_V3,
    VOTING_POWER_SHIM, // veMezo for delegate eligibility
    KEEPER_EOA, // initial keeper
  );
  await optimizer.waitForDeployment();
  const optAddr = await optimizer.getAddress();
  console.log(`    MezoYieldOptimizer: ${optAddr}`);

  // 2. Wire optimizer slot on adapter.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (adapter as any).setOptimizer(optAddr);
  console.log(`    adapter.setOptimizer(${optAddr}) ✓`);

  // 3. Register the discovered real gauges on the adapter.
  const names = realGauges.map((_, i) => `Gauge ${i}`);
  const weights = realGauges.map(() => 1n);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (adapter as any).registerGauges(realGauges, names, weights);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const registered = await (adapter as any).gauges();
  console.log(`    Registered ${registered.length} gauges on adapter`);

  // 4. Impersonate the veMEZO holder.
  console.log(`\n[2] Impersonating veMEZO holder ${VE_MEZO_HOLDER}…`);
  const holder = await impersonate(VE_MEZO_HOLDER);
  const veMezoNft = new ethers.Contract(
    REAL_VE_MEZO,
    [
      "function balanceOf(address) view returns (uint256)",
      "function tokenOfOwnerByIndex(address, uint256) view returns (uint256)",
      "function setApprovalForAll(address, bool)",
      "function isApprovedForAll(address, address) view returns (bool)",
    ],
    holder,
  );
  const holderBal = await veMezoNft.balanceOf(VE_MEZO_HOLDER);
  console.log(`    veMEZO NFT count: ${holderBal}`);
  if (holderBal === 0n) throw new Error("Holder unexpectedly has 0 NFTs.");
  const holderTokenId = await veMezoNft.tokenOfOwnerByIndex(VE_MEZO_HOLDER, 0);
  console.log(`    First tokenId:    ${holderTokenId}`);

  // 5. Holder grants approval to adapter, then delegates via optimizer.
  console.log("\n[3] Holder grants approval + delegates…");
  await veMezoNft.setApprovalForAll(adapterAddr, true);
  const approved = await veMezoNft.isApprovedForAll(VE_MEZO_HOLDER, adapterAddr);
  console.log(`    isApprovedForAll(holder, adapter): ${approved}`);
  if (!approved) throw new Error("setApprovalForAll did not stick.");

  // Holder must also have voting power per the Optimizer's eligibility gate.
  // VotingPower shim reads against real veMEZO — let's confirm.
  const shimBal = await new ethers.Contract(
    VOTING_POWER_SHIM,
    ["function balanceOf(address) view returns (uint256)"],
    ethers.provider,
  ).balanceOf(VE_MEZO_HOLDER);
  console.log(`    VotingPower shim balanceOf(holder): ${shimBal}`);
  if (shimBal === 0n) {
    throw new Error(
      "VotingPower shim returns 0 for the holder — eligibility gate would block delegate(). " +
        "Check the shim's getVotes path against the real veMEZO NFT — there may be a lock-decay or " +
        "snapshot timing issue we need to surface in the dApp UX.",
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (optimizer as any).connect(holder).delegate(VE_MEZO_HOLDER);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isDelegated = await (optimizer as any).isDelegated(VE_MEZO_HOLDER);
  console.log(`    isDelegated(holder): ${isDelegated}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const delegatedCount = await (optimizer as any).delegatedUsersCount();
  console.log(`    delegatedUsersCount: ${delegatedCount}`);

  // 6. Keeper triggers castOptimalVote.
  console.log("\n[4] Keeper triggers castOptimalVote…");
  const keeper = await impersonate(KEEPER_EOA);

  // Record BoostVoter.votes BEFORE so we can show the delta.
  const boostVoterRead = new ethers.Contract(
    REAL_BOOST_VOTER,
    ["function votes(uint256, address) view returns (uint256)"],
    ethers.provider,
  );
  const before = await boostVoterRead.votes(holderTokenId, voteGauges[0]);
  console.log(`    votes(holderTokenId, gauge0) before: ${before}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const castTx = await (optimizer as any).connect(keeper).castOptimalVote(voteGauges, voteWeights);
  const receipt = await castTx.wait();
  console.log(`    castOptimalVote tx mined in block ${receipt.blockNumber}`);

  // 7. Inspect logs.
  const voteCastTopic = ethers.id("VoteCast(address[],uint256[])");
  const voteSkippedTopic = ethers.id("VoteSkipped(address,bytes)");
  const voteCastLogs = receipt.logs.filter((l: { topics: ReadonlyArray<string>; address: string }) =>
    l.topics[0] === voteCastTopic && l.address.toLowerCase() === optAddr.toLowerCase(),
  );
  const voteSkippedLogs = receipt.logs.filter((l: { topics: ReadonlyArray<string>; address: string }) =>
    l.topics[0] === voteSkippedTopic && l.address.toLowerCase() === optAddr.toLowerCase(),
  );
  console.log(`    VoteCast events:    ${voteCastLogs.length}`);
  console.log(`    VoteSkipped events: ${voteSkippedLogs.length}`);

  const after = await boostVoterRead.votes(holderTokenId, voteGauges[0]);
  console.log(`    votes(holderTokenId, gauge0) after:  ${after}`);

  // 8. Assertions.
  console.log("\n[5] Assertions:");
  if (voteCastLogs.length !== 1) {
    throw new Error(`Expected 1 VoteCast, got ${voteCastLogs.length}`);
  }
  if (voteSkippedLogs.length !== 0) {
    const reasons = voteSkippedLogs.map((l: { data: string }) => l.data).join(", ");
    throw new Error(`Expected 0 VoteSkipped, got ${voteSkippedLogs.length}: ${reasons}`);
  }
  if (after === before) {
    throw new Error(
      `BoostVoter.votes did not change for the holder's tokenId on the voted gauge — ` +
        `the adapter forwarded but the real BoostVoter didn't record. Possible causes: ` +
        `epoch already voted this period, gauge weighting rejected, ABI mismatch.`,
    );
  }

  console.log("    ✅ VoteCast emitted exactly once");
  console.log("    ✅ Zero VoteSkipped — every delegated user's vote landed");
  console.log("    ✅ Real BoostVoter recorded the vote against the holder's NFT");
  console.log("\n🎉 v3 fan-out works end-to-end against the REAL Mezo BoostVoter on a forked mainnet.");
}

main().catch((err) => {
  console.error("\n❌ Fork e2e FAILED:");
  console.error(err);
  process.exitCode = 1;
});
