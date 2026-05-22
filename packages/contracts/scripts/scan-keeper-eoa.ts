import { ethers, network } from "hardhat";
import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * Scans every block from a starting point to head and prints every
 * transaction sent FROM the keeper EOA. Decodes `to`, value, gas,
 * status, function selector, and tries to match selector to known
 * Optimizer / Adapter ABIs.
 *
 * Run: `pnpm exec hardhat run scripts/scan-keeper-eoa.ts --network mezoMainnet`
 */
async function main() {
  if (network.config.chainId !== 31612) {
    throw new Error(`Must run on mezoMainnet (31612). Got ${network.config.chainId}`);
  }

  const manifest = JSON.parse(
    readFileSync(resolve(__dirname, "..", "deployments", "mezo-mainnet.json"), "utf8"),
  );
  const eoa: string = manifest.deployer;
  const provider = ethers.provider;
  const head = await provider.getBlockNumber();
  const nonce = await provider.getTransactionCount(eoa);

  console.log("─".repeat(70));
  console.log(`Scan: tx history of ${eoa}`);
  console.log(`Head:  ${head}`);
  console.log(`Nonce: ${nonce}  (12 = sent ${nonce} txs total)`);
  console.log("─".repeat(70));

  // Build selector → name table for our known contracts.
  const optimizerIface = (await ethers.getContractAt("MezoYieldOptimizer", manifest.contracts.MezoYieldOptimizer.address)).interface;
  const adapterIface = (await ethers.getContractAt("BoostVoterAdapter", manifest.contracts.MockGaugeController.address)).interface;
  const matchboxIface = (await ethers.getContractAt("MatchboxAdapter", manifest.contracts.MockMatchbox.address)).interface;
  const knownIfaces = [
    { name: "MezoYieldOptimizer", addr: manifest.contracts.MezoYieldOptimizer.address.toLowerCase(), iface: optimizerIface },
    { name: "BoostVoterAdapter", addr: manifest.contracts.MockGaugeController.address.toLowerCase(), iface: adapterIface },
    { name: "MatchboxAdapter", addr: manifest.contracts.MockMatchbox.address.toLowerCase(), iface: matchboxIface },
  ];
  const externalKnown: Record<string, string> = Object.fromEntries(
    Object.entries(manifest.external).map(([k, v]) => [(v as string).toLowerCase(), k]),
  );
  externalKnown[manifest.contracts.MockVeMezo.address.toLowerCase()] = "VeMezoVotingPower";

  // Start scan a bit before the first known deploy block.
  const earliestDeploy = Math.min(
    manifest.contracts.MezoYieldOptimizer.blockNumber,
    manifest.contracts.MockGaugeController.blockNumber,
    manifest.contracts.MockMatchbox.blockNumber,
    manifest.contracts.MockVeMezo.blockNumber,
  );
  const FROM = Math.max(earliestDeploy - 10_000, 0);
  console.log(`Scanning ${FROM} → ${head} (${head - FROM} blocks)…`);

  let txCount = 0;
  const eoaLower = eoa.toLowerCase();

  // Use parallel block fetches to keep this brisk. Mezo blocks have
  // few txs each. Batch size kept small to be polite to Boar RPC.
  const BATCH = 50;
  for (let start = FROM; start <= head; start += BATCH) {
    const end = Math.min(start + BATCH - 1, head);
    const blocks = await Promise.all(
      Array.from({ length: end - start + 1 }, (_, i) =>
        provider.getBlock(start + i, true),
      ),
    );
    for (const block of blocks) {
      if (!block || !block.transactions) continue;
      for (const txHashOrTx of block.transactions) {
        // ethers v6: prefetched array contains TransactionResponse with `from`
        const tx: any =
          typeof txHashOrTx === "string"
            ? await provider.getTransaction(txHashOrTx)
            : txHashOrTx;
        if (!tx || tx.from?.toLowerCase() !== eoaLower) continue;

        txCount++;
        const receipt = await provider.getTransactionReceipt(tx.hash);
        const status = receipt?.status === 1 ? "✅" : "❌ REVERTED";
        const toLower = (tx.to ?? "").toLowerCase();
        const isDeploy = !tx.to;
        let target = isDeploy ? `DEPLOY (→ ${receipt?.contractAddress ?? "?"})` : tx.to;
        if (toLower && externalKnown[toLower]) {
          target += `  [${externalKnown[toLower]}]`;
        }
        const known = knownIfaces.find((k) => k.addr === toLower);
        let decoded = "";
        if (tx.data && tx.data !== "0x") {
          const selector = tx.data.slice(0, 10);
          if (known) {
            try {
              const fn = known.iface.getFunction(selector);
              if (fn) {
                const parsed = known.iface.parseTransaction({ data: tx.data, value: tx.value });
                decoded = `→ ${known.name}.${fn.name}(${parsed?.args.map((a: any) => Array.isArray(a) ? `[${a.length}]` : String(a)).join(", ") ?? ""})`;
              } else {
                decoded = `→ ${known.name} (unknown selector ${selector})`;
              }
            } catch {
              decoded = `→ ${known.name} (decode failed, selector ${selector})`;
            }
          } else if (toLower && externalKnown[toLower]) {
            decoded = `→ ${externalKnown[toLower]} (selector ${selector})`;
          } else {
            decoded = `(selector ${selector})`;
          }
        }
        console.log(
          `block ${block.number}  nonce ${tx.nonce}  ${status}  to=${target}\n  hash: ${tx.hash}\n  ${decoded}\n`,
        );
      }
    }
  }
  console.log("─".repeat(70));
  console.log(`Found ${txCount} txs from EOA (expected ${nonce}).`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
