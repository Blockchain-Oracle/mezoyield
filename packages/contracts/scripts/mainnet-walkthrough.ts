import { ethers, network } from "hardhat";
import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * Single-script mainnet end-to-end walkthrough — runs every check + tx
 * a real demo user would do, in order, with every state read + tx hash
 * printed. Idempotent: re-runnable; skips steps that already landed.
 *
 * Default mode is READ-ONLY (prints what's needed). Pass
 * `EXECUTE=1` to actually submit the prerequisite txs (lock + approve
 * + delegate + keeper tick).
 *
 * Run:
 *   pnpm --filter @mezoyield/contracts exec hardhat run \
 *     scripts/mainnet-walkthrough.ts --network mezoMainnet
 *   (read-only — shows what's missing)
 *
 *   EXECUTE=1 pnpm --filter @mezoyield/contracts exec hardhat run \
 *     scripts/mainnet-walkthrough.ts --network mezoMainnet
 *   (actually runs the prerequisite txs)
 *
 * Exit codes:
 *   0 — every check green, demo-ready (VoteCast event present)
 *   1 — something failed; output explains what
 *   2 — read-only mode and prerequisites still missing
 */
const EXECUTE = process.env.EXECUTE === "1";
const LOCK_MEZO_AMOUNT = ethers.parseUnits("1", 18); // 1 MEZO
const LOCK_DURATION = 604_800n; // 1 week (min)
const VOTE_GAUGES_TAKE = 2; // top 2 of 5 by bribe

type Manifest = {
  contracts: {
    MezoYieldOptimizer: { address: string };
    MockGaugeController: { address: string };
    MockMatchbox: { address: string };
    MockVeMezo: { address: string };
  };
  external: { MezoBoostVoter: string; VeMEZO: string; MEZO: string };
};

const veMezoNftAbi = [
  "function balanceOf(address) view returns (uint256)",
  "function ownerToNFTokenIdList(address, uint256) view returns (uint256)",
  "function isApprovedForAll(address, address) view returns (bool)",
  "function setApprovalForAll(address, bool)",
  "function createLock(uint256, uint256) returns (uint256)",
];
const mezoTokenAbi = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address, uint256) returns (bool)",
];

function explorer(hashOrAddr: string): string {
  return `https://explorer.mezo.org/${hashOrAddr.length === 66 ? "tx" : "address"}/${hashOrAddr}`;
}

async function main() {
  if (network.config.chainId !== 31612) {
    throw new Error(`Must run on mezoMainnet (31612). Got ${network.config.chainId}`);
  }

  const manifest = JSON.parse(
    readFileSync(resolve(__dirname, "..", "deployments", "mezo-mainnet.json"), "utf8"),
  ) as Manifest;

  const optAddr = manifest.contracts.MezoYieldOptimizer.address;
  const adapterAddr = manifest.contracts.MockGaugeController.address;
  const matchboxAddr = manifest.contracts.MockMatchbox.address;
  const realVeMezoAddr = manifest.external.VeMEZO;
  const realMezoAddr = manifest.external.MEZO;

  const [signer] = await ethers.getSigners();
  const user = signer.address;
  const provider = ethers.provider;

  const mode = EXECUTE ? "EXECUTE" : "DRY-RUN";
  console.log("═".repeat(70));
  console.log(` Mezo Mainnet v3.1 walkthrough — mode: ${mode}`);
  console.log("═".repeat(70));
  console.log(`Wallet:               ${user}`);
  console.log(`Optimizer:            ${optAddr}`);
  console.log(`BoostVoterAdapter:    ${adapterAddr}`);
  console.log(`MatchboxAdapter:      ${matchboxAddr}`);
  console.log(`Real VeMEZO NFT:      ${realVeMezoAddr}`);
  console.log(`Real MEZO token:      ${realMezoAddr}`);
  console.log("");

  let needsAction = 0;

  // ─── 0. Gas balance ────────────────────────────────────────────
  const btcBal = await provider.getBalance(user);
  const btcUsd = (Number(btcBal) / 1e18) * 77_000;
  const btcOk = btcBal >= ethers.parseUnits("0.0001", 18);
  console.log(`[0/5] Gas balance:                    ${ethers.formatEther(btcBal)} BTC (~$${btcUsd.toFixed(2)})  ${btcOk ? "✅" : "❌ insufficient"}`);
  if (!btcOk) {
    console.log(`      Need at least 0.0001 BTC (~$7) for the full op sequence (lock+approve+delegate+keeper tick).`);
    console.log(`      Send BTC to ${user} (Mezo native BTC, not Ethereum WBTC/tBTC unless via bridge).`);
    needsAction++;
  }

  // ─── 1. MEZO balance ────────────────────────────────────────────
  const mezo = new ethers.Contract(realMezoAddr, mezoTokenAbi, signer);
  const mezoBal = (await mezo.balanceOf(user)) as bigint;
  const mezoOk = mezoBal >= LOCK_MEZO_AMOUNT;
  console.log(`[1/5] MEZO balance:                   ${ethers.formatUnits(mezoBal, 18)} MEZO  ${mezoOk ? "✅" : "❌ need ≥1 MEZO to lock"}`);
  if (!mezoOk) {
    console.log(`      NO PUBLIC BTC→MEZO POOL on Mezo Mainnet right now — confirmed by probing`);
    console.log(`      Tigris PoolFactory (0x83FE…4248) at every fee tier + volatile/stable.`);
    console.log(`      MEZO is circulating via Mezo-team distributions, not a public AMM.`);
    console.log(`      Three ways to get MEZO into ${user}:`);
    console.log(`        a) CEX route: buy MEZO somewhere it's listed, withdraw to this address.`);
    console.log(`        b) Mezo Hack Discord / sponsor channel: ask for a 1 MEZO demo drop.`);
    console.log(`        c) Transfer from another wallet you control that already holds MEZO.`);
    console.log(`      Once 1+ MEZO lands here, re-run with EXECUTE=1 to finish.`);
    needsAction++;
  }

  // ─── 2. veMEZO NFT count (lock state) ──────────────────────────
  const veMezo = new ethers.Contract(realVeMezoAddr, veMezoNftAbi, signer);
  const nftCount = (await veMezo.balanceOf(user)) as bigint;
  console.log(`[2/5] veMEZO NFT count:               ${nftCount}  ${nftCount > 0n ? "✅" : "❌ need ≥1 NFT (createLock)"}`);
  if (nftCount === 0n) {
    if (mezoOk && EXECUTE) {
      console.log(`      EXECUTING: VeMEZO.createLock(${LOCK_MEZO_AMOUNT}, ${LOCK_DURATION}) (1 MEZO, 1 week)`);
      // ERC20.approve(VeMEZO, amount) typically required first
      const approveTx = await mezo.approve(realVeMezoAddr, LOCK_MEZO_AMOUNT);
      console.log(`        MEZO.approve(VeMEZO) tx: ${approveTx.hash}  ${explorer(approveTx.hash)}`);
      await approveTx.wait();
      const lockTx = await veMezo.createLock(LOCK_MEZO_AMOUNT, LOCK_DURATION);
      console.log(`        createLock tx:           ${lockTx.hash}  ${explorer(lockTx.hash)}`);
      await lockTx.wait();
    } else if (!EXECUTE) {
      console.log(`      Re-run with EXECUTE=1 to auto-lock 1 MEZO (requires MEZO balance).`);
      needsAction++;
    } else {
      console.log(`      Skipping — no MEZO to lock.`);
      needsAction++;
    }
  }

  // Re-read after potential lock
  const nftCountAfter = (await veMezo.balanceOf(user)) as bigint;
  if (nftCountAfter > 0n) {
    const tokenId = await veMezo.ownerToNFTokenIdList(user, 0);
    console.log(`      First tokenId: ${tokenId}`);
  }

  // ─── 3. setApprovalForAll on the adapter ──────────────────────
  if (nftCountAfter > 0n) {
    const approved = (await veMezo.isApprovedForAll(user, adapterAddr)) as boolean;
    console.log(`[3/5] Adapter approved on veMEZO:     ${approved}  ${approved ? "✅" : "❌ setApprovalForAll required"}`);
    if (!approved) {
      if (EXECUTE) {
        console.log(`      EXECUTING: veMEZO.setApprovalForAll(${adapterAddr}, true)`);
        const tx = await veMezo.setApprovalForAll(adapterAddr, true);
        console.log(`        tx: ${tx.hash}  ${explorer(tx.hash)}`);
        await tx.wait();
      } else {
        console.log(`      Re-run with EXECUTE=1 to grant approval.`);
        needsAction++;
      }
    }
  } else {
    console.log(`[3/5] Adapter approved on veMEZO:     (skipped — no NFT)`);
  }

  // ─── 4. Optimizer.delegate(self) ──────────────────────────────
  const optimizer = await ethers.getContractAt("MezoYieldOptimizer", optAddr, signer);
  const isDelegated = await optimizer.isDelegated(user);
  console.log(`[4/5] isDelegated(self):              ${isDelegated}  ${isDelegated ? "✅" : "❌ delegate() required"}`);
  if (!isDelegated && nftCountAfter > 0n) {
    if (EXECUTE) {
      console.log(`      EXECUTING: Optimizer.delegate(self)`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tx = await (optimizer as any).delegate(user);
      console.log(`        tx: ${tx.hash}  ${explorer(tx.hash)}`);
      await tx.wait();
    } else if (nftCountAfter === 0n) {
      console.log(`      Eligibility gate would reject — need veMEZO first.`);
      needsAction++;
    } else {
      console.log(`      Re-run with EXECUTE=1 to delegate.`);
      needsAction++;
    }
  }

  // ─── 5. Keeper tick → VoteCast assertion ──────────────────────
  const isDelegatedAfter = await optimizer.isDelegated(user);
  if (isDelegatedAfter) {
    const delegatedCount = await optimizer.delegatedUsersCount();
    console.log(`[5/5] Optimizer.delegatedUsersCount:  ${delegatedCount}  ✅`);

    if (EXECUTE) {
      console.log(`      EXECUTING: castOptimalVote on 2 gauges (60/40 split)`);
      const adapter = await ethers.getContractAt("BoostVoterAdapter", adapterAddr);
      // ethers v6 returns Result objects (readonly). Spread into a fresh
      // mutable array before passing to writeContract — encoder mutates
      // in place internally.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const gaugesRaw = await (adapter as any).gauges();
      const voteGauges = [...gaugesRaw].slice(0, VOTE_GAUGES_TAKE).map((g: string) => g);
      const voteWeights = [6000n, 4000n];
      // Earlier formula (100k + 200k*N) under-counted real BoostVoter.vote
      // cost (~250-400k per inner call on mainnet). Bumping the per-user
      // figure to 600k gives comfortable headroom; the keeper helper
      // should mirror this. Total tx cost is still pennies on Mezo.
      const gas = 300_000n + 600_000n * (delegatedCount as bigint);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tx = await (optimizer as any).connect(signer).castOptimalVote(voteGauges, voteWeights, { gasLimit: gas });
      const receipt = await tx.wait();
      console.log(`        castOptimalVote tx: ${tx.hash}  ${explorer(tx.hash)}`);

      const voteCastTopic = ethers.id("VoteCast(address[],uint256[])");
      const tickAttemptedTopic = ethers.id("TickAttempted(uint256,uint256,uint256)");
      const voteSkippedTopic = ethers.id("VoteSkipped(address,bytes)");
      const vc = receipt.logs.filter((l: { topics: ReadonlyArray<string>; address: string }) =>
        l.topics[0] === voteCastTopic && l.address.toLowerCase() === optAddr.toLowerCase(),
      ).length;
      const ta = receipt.logs.filter((l: { topics: ReadonlyArray<string>; address: string }) =>
        l.topics[0] === tickAttemptedTopic && l.address.toLowerCase() === optAddr.toLowerCase(),
      ).length;
      const vs = receipt.logs.filter((l: { topics: ReadonlyArray<string>; address: string }) =>
        l.topics[0] === voteSkippedTopic && l.address.toLowerCase() === optAddr.toLowerCase(),
      ).length;
      console.log(`        VoteCast:      ${vc}  ${vc === 1 ? "✅" : "❌"}`);
      console.log(`        TickAttempted: ${ta}  ${ta === 1 ? "✅" : "❌"}`);
      console.log(`        VoteSkipped:   ${vs}  ${vs === 0 ? "✅" : "❌ at least one user's vote did NOT land"}`);
      if (vc === 0 || vs > 0) needsAction++;
    } else {
      console.log(`      Re-run with EXECUTE=1 to fire the keeper tick + assert VoteCast.`);
      needsAction++;
    }
  } else {
    console.log(`[5/5] Optimizer.delegatedUsersCount:  (skipped — not delegated)`);
    needsAction++;
  }

  console.log("");
  console.log("═".repeat(70));
  if (needsAction === 0) {
    console.log(" ✅ Mainnet demo path fully green. dApp UI will reflect this state.");
    process.exitCode = 0;
  } else if (!EXECUTE) {
    console.log(` ⚠ ${needsAction} prerequisite(s) remaining. Re-run with EXECUTE=1 to advance.`);
    process.exitCode = 2;
  } else {
    console.log(` ❌ ${needsAction} step(s) failed. See output above for details.`);
    process.exitCode = 1;
  }
  console.log("═".repeat(70));
}

main().catch((err) => {
  console.error("\n❌ Walkthrough crashed:");
  console.error(err);
  process.exitCode = 1;
});
