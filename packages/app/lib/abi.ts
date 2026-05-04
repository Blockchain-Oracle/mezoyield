/**
 * Hand-curated ABI subsets for the contracts wagmi reads from. We type
 * each ABI with `as const` so wagmi's type inference can narrow return
 * shapes per call site. Keeping these inline (rather than importing the
 * Hardhat artifact JSON) avoids pulling typechain-generated types into
 * the app package, which would make tsc walk into files that depend on
 * `ethers` types not directly resolvable here (see STORY-003 PR notes).
 */

export const gaugeControllerAbi = [
  {
    type: "function",
    stateMutability: "view",
    name: "gauges",
    inputs: [],
    outputs: [{ name: "", type: "address[]" }],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "gaugeCount",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "gaugeMeta",
    inputs: [{ name: "gauge", type: "address" }],
    outputs: [
      { name: "name", type: "string" },
      { name: "totalVeMezo", type: "uint256" },
    ],
  },
] as const;

export const matchboxAbi = [
  {
    type: "function",
    stateMutability: "view",
    name: "bribeForGauge",
    inputs: [{ name: "gauge", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "pending",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export const veMezoAbi = [
  {
    type: "function",
    stateMutability: "view",
    name: "balanceOf",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "faucet",
    inputs: [],
    outputs: [],
  },
] as const;

export const optimizerAbi = [
  {
    type: "function",
    stateMutability: "view",
    name: "getAllocation",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      { name: "", type: "address[]" },
      { name: "", type: "uint256[]" },
    ],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "isDelegated",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "event",
    name: "RewardsClaimed",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "VoteCast",
    inputs: [
      { name: "gauges", type: "address[]", indexed: false },
      { name: "weights", type: "uint256[]", indexed: false },
    ],
    anonymous: false,
  },
] as const;
