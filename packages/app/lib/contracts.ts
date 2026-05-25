import testnetManifest from "@mezoyield/contracts/deployments/mezo-testnet.json";
import mainnetManifest from "@mezoyield/contracts/deployments/mezo-mainnet.json";

/**
 * Frontend handles for the contracts the active deployment uses. The
 * active deployment is picked at build time by `NEXT_PUBLIC_MEZO_NETWORK`
 * (defaults to `"testnet"`).
 *
 * Why an env-var conditional and not runtime chain detection: each domain
 * — `mezoyield.xyz` (testnet) and `mainnet.mezoyield.xyz` (mainnet) — is
 * built as a separate Coolify service with its own `NEXT_PUBLIC_MEZO_NETWORK`
 * value baked into the bundle. That keeps the testnet demo's blast
 * radius isolated from any mainnet change, and lets the wallet connector
 * (`wagmi.ts`) pin a single chain at config time instead of juggling
 * multi-chain switch flows. Both manifests are imported so bundlers can
 * tree-shake the inactive one — net cost is ~1KB.
 *
 * On mainnet, `MockGaugeController`'s address slot holds the real
 * `BoostVoter` proxy (Mezo's Solidly-derived voter with a boost mechanic
 * on top — verified via `veMEZO.voter()` reverse lookup on 2026-05-20).
 * The `Mock*` key names are retained for shape compatibility with the
 * testnet manifest until a future PR renames them across both manifests
 * and every consumer; see `packages/contracts/deployments/mezo-mainnet.json`
 * notes field for the disclosure.
 */

type DeployedContract = {
  // Nullable because mainnet's MezoYieldOptimizer hasn't deployed yet —
  // the manifest is checked into git with `null` so the wiring is in
  // place but the build for mainnet fails loudly until Phase 5 fills
  // the address in. Better to fail at module load than to ship a UI
  // that points at the zero address.
  address: `0x${string}` | null;
  txHash: `0x${string}` | null;
  blockNumber: number | null;
};

type DeploymentManifest = {
  chainId: number;
  network: string;
  rpcUrl: string;
  explorer?: string;
  deployer: `0x${string}`;
  deployedAt: string | null;
  contracts: {
    MezoYieldOptimizer: DeployedContract;
    MockGaugeController: DeployedContract;
    MockMatchbox: DeployedContract;
    MockVeMezo: DeployedContract;
  };
  // Only present on the mainnet manifest — addresses of real Mezo
  // contracts we read against (MUSD, MEZO precompile, Tigris router).
  // Optional so the testnet manifest doesn't need to declare it.
  external?: Record<string, `0x${string}`>;
  notes: string;
};

// Strict validation — Codex P2 (round 3): a ternary that defaults to
// testnet on anything-not-"mainnet" silently routes typos like
// `NEXT_PUBLIC_MEZO_NETWORK=mainet` (one 'n') to the testnet manifest.
// That would build a mainnet-domain Coolify service against testnet
// addresses, bypassing every guard below. Treat unset/empty as the
// explicit "testnet" default; reject every other non-canonical value.
const rawNetwork = process.env.NEXT_PUBLIC_MEZO_NETWORK;
let NETWORK: "testnet" | "mainnet";
if (rawNetwork === undefined || rawNetwork === "" || rawNetwork === "testnet") {
  NETWORK = "testnet";
} else if (rawNetwork === "mainnet") {
  NETWORK = "mainnet";
} else {
  throw new Error(
    `Invalid NEXT_PUBLIC_MEZO_NETWORK="${rawNetwork}". ` +
      `Expected "testnet", "mainnet", or unset (= "testnet"). ` +
      `Common cause: typo in the Coolify env var.`,
  );
}

const manifest = (
  NETWORK === "mainnet" ? mainnetManifest : testnetManifest
) as unknown as DeploymentManifest;

const ACCEPTED_CHAIN_IDS = new Set<number>([31611, 31612]);
if (!ACCEPTED_CHAIN_IDS.has(manifest.chainId)) {
  throw new Error(
    `Expected Mezo testnet (31611) or mainnet (31612) deployment, got chainId ${manifest.chainId}.`,
  );
}

// Fail fast on a mainnet build whose Optimizer hasn't been deployed
// yet. Coolify can't ship a half-wired mainnet UI with this guard in
// place. To unblock: run `pnpm --filter @mezoyield/contracts run
// deploy:mainnet` (after Phase 3's Matchbox adapter has populated
// MockMatchbox.address in the manifest), commit the updated
// `mezo-mainnet.json`, then rebuild.
const optimizerAddress = manifest.contracts.MezoYieldOptimizer.address;
if (!optimizerAddress) {
  throw new Error(
    `MezoYieldOptimizer not yet deployed on Mezo ${NETWORK}. ` +
      `Run \`pnpm --filter @mezoyield/contracts run deploy:${NETWORK}\` ` +
      `and commit the updated packages/contracts/deployments/mezo-${NETWORK}.json before building.`,
  );
}

const gaugeControllerAddress = manifest.contracts.MockGaugeController.address;
if (!gaugeControllerAddress) {
  throw new Error(
    `MockGaugeController address missing from mezo-${NETWORK}.json — cannot wire gauge reads.`,
  );
}

const veMezoAddress = manifest.contracts.MockVeMezo.address;
if (!veMezoAddress) {
  throw new Error(
    `MockVeMezo address missing from mezo-${NETWORK}.json — cannot wire veMEZO reads.`,
  );
}

const matchboxAddress = manifest.contracts.MockMatchbox.address;
if (!matchboxAddress) {
  // Mainnet's bribe-claim flow is per-gauge (BribeVotingReward children
  // of the Voter), not a singleton matchbox. The next PR (optimizer
  // adapter for mainnet) deploys a thin Matchbox-shaped façade that
  // multiplexes across the per-gauge bribe contracts so this address
  // is non-null. Until then, mainnet builds fail loud here rather than
  // letting useClaimRewards / useGaugeData ship with null reads.
  throw new Error(
    `MockMatchbox address missing from mezo-${NETWORK}.json — wiring required before mainnet build can succeed.`,
  );
}

export const MEZO_NETWORK = NETWORK;
export const MEZO_CHAIN_ID = manifest.chainId;
export const MEZO_RPC_URL = manifest.rpcUrl;
export const MEZO_EXPLORER = manifest.explorer;

// Deprecated aliases retained so STORY-004's tests don't break.
export const MEZO_TESTNET_CHAIN_ID = manifest.chainId;
export const MEZO_TESTNET_RPC_URL = manifest.rpcUrl;
export const MEZO_TESTNET_EXPLORER = manifest.explorer;

export const OPTIMIZER_ADDRESS = optimizerAddress;
export const GAUGE_CONTROLLER_ADDRESS = gaugeControllerAddress;
export const MATCHBOX_ADDRESS = matchboxAddress;
export const VE_MEZO_ADDRESS = veMezoAddress;

/**
 * Real Mezo veMEZO ERC-721 NFT contract on mainnet. Only present in the
 * `external` block of the mainnet manifest (testnet uses MockVeMezo,
 * exported above as `VE_MEZO_ADDRESS`, which collapses the NFT to an
 * ERC-20-style balance). The frontend's activate flow uses this address
 * to call `setApprovalForAll(BoostVoterAdapter, true)` so the keeper's
 * per-user `voteForUser` fan-out can vote with the user's NFT.
 *
 * `undefined` on testnet — callers MUST gate on `MEZO_NETWORK === "mainnet"`
 * before reading this. Empty/missing value on mainnet is a manifest bug
 * (caught at module load below).
 */
export const VE_MEZO_NFT_ADDRESS: `0x${string}` | undefined =
  NETWORK === "mainnet" ? (manifest.external?.VeMEZO as `0x${string}` | undefined) : undefined;
if (NETWORK === "mainnet" && !VE_MEZO_NFT_ADDRESS) {
  throw new Error(
    "mezo-mainnet.json `external.VeMEZO` missing — required by the dApp's " +
      "activate flow to call setApprovalForAll on the real veMEZO NFT.",
  );
}

/**
 * Real Mezo MEZO ERC-20 token contract on mainnet. Only present in the
 * `external` block of the mainnet manifest — testnet has no MEZO ERC-20
 * (the testnet flow mints veMEZO directly via the mock's faucet/mint).
 * The frontend's activate flow uses this to read MEZO balance + allowance
 * and submit `approve` before `VeMEZO.createLock`.
 *
 * `undefined` on testnet — callers MUST gate on `MEZO_NETWORK === "mainnet"`
 * before reading this. Empty/missing on mainnet is a manifest bug.
 */
export const MEZO_TOKEN_ADDRESS: `0x${string}` | undefined =
  NETWORK === "mainnet" ? (manifest.external?.MEZO as `0x${string}` | undefined) : undefined;
if (NETWORK === "mainnet" && !MEZO_TOKEN_ADDRESS) {
  throw new Error(
    "mezo-mainnet.json `external.MEZO` missing — required by the dApp's " +
      "activate flow to read MEZO balance and approve VeMEZO for createLock.",
  );
}

// Lower bound for `getLogs` calls against the optimizer. On testnet the
// deploy block is captured in the manifest; on mainnet, when the optimizer
// lands, the deploy script will populate it. Fall back to 0n so the log
// walk can start from genesis in the edge case where blockNumber is null
// but address is set (shouldn't happen in practice — the deploy script
// writes both atomically).
export const OPTIMIZER_DEPLOYMENT_BLOCK = BigInt(
  manifest.contracts.MezoYieldOptimizer.blockNumber ?? 0,
);

// Lower bound for `getLogs` calls against the Matchbox slot — used by
// the landing-page bribes chart. The matchbox slot holds different
// contracts per chain (MockMatchbox on testnet, MatchboxAdapter on
// mainnet) but the deploy block lives in the same manifest entry on
// both. Falls back to 0n so the walker can start from genesis if the
// manifest somehow has the address but null block (deploy-script bug).
export const MATCHBOX_DEPLOYMENT_BLOCK = BigInt(
  manifest.contracts.MockMatchbox.blockNumber ?? 0,
);

export const DEPLOYMENT_MANIFEST = manifest;
