/**
 * One-shot diagnostic: count every event that could power the landing
 * page's "Protocol Earnings" chart, on whatever network the runner is
 * pointed at. Read-only; safe to run on either testnet or mainnet.
 *
 * Run:
 *   pnpm --filter @mezoyield/contracts exec hardhat run \
 *     scripts/count-live-events.ts --network mezoMainnet
 *   pnpm --filter @mezoyield/contracts exec hardhat run \
 *     scripts/count-live-events.ts --network mezoTestnet
 *
 * Output is a single JSON line per event class so the caller can grep
 * it and compare networks side-by-side.
 */
import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

type Manifest = {
  chainId: number;
  contracts: {
    MezoYieldOptimizer: { address: string; blockNumber: number };
    MockGaugeController: { address: string; blockNumber: number };
    MockMatchbox: { address: string; blockNumber: number };
  };
};

async function main() {
  const filename =
    network.name === "mezoMainnet" ? "mezo-mainnet.json" : "mezo-testnet.json";
  const manifestPath = path.join(__dirname, "..", "deployments", filename);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as Manifest;

  const provider = ethers.provider;
  const head = await provider.getBlockNumber();
  const optimizer = manifest.contracts.MezoYieldOptimizer.address;
  const matchbox = manifest.contracts.MockMatchbox.address;
  const adapter = manifest.contracts.MockGaugeController.address;

  const optDeploy = manifest.contracts.MezoYieldOptimizer.blockNumber;
  const mbxDeploy = manifest.contracts.MockMatchbox.blockNumber;
  const adpDeploy = manifest.contracts.MockGaugeController.blockNumber;

  console.log(JSON.stringify({
    network: network.name,
    chainId: manifest.chainId,
    head,
    optimizer,
    matchbox,
    adapter,
  }));

  const eventClasses = [
    { label: "Optimizer.VoteCast", addr: optimizer, fromBlock: optDeploy,
      topic: ethers.id("VoteCast(address[],uint256[])") },
    { label: "Optimizer.TickAttempted", addr: optimizer, fromBlock: optDeploy,
      topic: ethers.id("TickAttempted(uint256,uint256,uint256)") },
    { label: "Optimizer.Delegated", addr: optimizer, fromBlock: optDeploy,
      topic: ethers.id("Delegated(address)") },
    { label: "Optimizer.RewardsClaimed", addr: optimizer, fromBlock: optDeploy,
      topic: ethers.id("RewardsClaimed(address,uint256)") },
    { label: "Optimizer.VoteSkipped", addr: optimizer, fromBlock: optDeploy,
      topic: ethers.id("VoteSkipped(address,bytes)") },
    { label: "Optimizer.ManualAllocationSet", addr: optimizer, fromBlock: optDeploy,
      topic: ethers.id("ManualAllocationSet(address,address[],uint256[])") },
    // Mainnet adapter event (matchbox slot holds MatchboxAdapter)
    { label: "Matchbox.BribeUpdated", addr: matchbox, fromBlock: mbxDeploy,
      topic: ethers.id("BribeUpdated(address,uint256)") },
    // Testnet mock event (matchbox slot holds MockMatchbox)
    { label: "Matchbox.BribeSet", addr: matchbox, fromBlock: mbxDeploy,
      topic: ethers.id("BribeSet(address,uint256)") },
    { label: "Matchbox.PendingSet", addr: matchbox, fromBlock: mbxDeploy,
      topic: ethers.id("PendingSet(address,uint256)") },
    { label: "Matchbox.Claimed", addr: matchbox, fromBlock: mbxDeploy,
      topic: ethers.id("Claimed(address,uint256)") },
    { label: "Adapter.GaugeWeightUpdated", addr: adapter, fromBlock: adpDeploy,
      topic: ethers.id("GaugeWeightUpdated(address,uint256)") },
  ];

  // Walk in chunks to be RPC-friendly.
  const CHUNK = 9_999n;
  for (const ev of eventClasses) {
    let count = 0;
    let lastBlock: number | null = null;
    let to = BigInt(head);
    const floor = BigInt(ev.fromBlock);
    let chunks = 0;
    while (to >= floor && chunks < 200) {
      const from = to > floor + CHUNK ? to - CHUNK : floor;
      try {
        const logs = await provider.getLogs({
          address: ev.addr,
          fromBlock: Number(from),
          toBlock: Number(to),
          topics: [ev.topic],
        });
        count += logs.length;
        if (logs.length > 0) {
          const newest = logs[logs.length - 1].blockNumber;
          if (lastBlock === null || newest > lastBlock) lastBlock = newest;
        }
      } catch (e) {
        // RPC range error; halve and retry once
        const mid = (from + to) / 2n;
        const upper = await provider.getLogs({
          address: ev.addr,
          fromBlock: Number(mid + 1n),
          toBlock: Number(to),
          topics: [ev.topic],
        });
        const lower = await provider.getLogs({
          address: ev.addr,
          fromBlock: Number(from),
          toBlock: Number(mid),
          topics: [ev.topic],
        });
        count += upper.length + lower.length;
      }
      if (from === floor) break;
      to = from - 1n;
      chunks++;
    }
    console.log(JSON.stringify({
      label: ev.label,
      count,
      lastBlock,
    }));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
