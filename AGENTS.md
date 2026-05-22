# AGENTS.md

This file is read by:
- **OpenAI Codex GitHub App** — for PR review guidance (see `## Review guidelines` below).
- **Codex CLI** when running `codex` interactively or via `codex exec` in this repo.
- Any other tool that follows the AGENTS.md convention.

The closest AGENTS.md to a changed file wins. Place tighter rules under
`packages/<x>/AGENTS.md` if a module needs them.

<!-- sahil-coding-protocol-review marker -->

## Review guidelines

These guidelines apply to Codex automatic PR reviews.

### Block on
- New behavior shipped without a corresponding test. Every story file in this
  repo has BDD acceptance criteria; the test must encode them before the
  implementation lands.
- Swallowed errors (`catch (_) {}`, broad `except: pass`, `|| true` on commands
  whose failure matters). Errors must surface or be logged with reason.
- Mock data, placeholder strings, or fabricated values where real ones are
  expected — see the §14 anti-slop list in CLAUDE.md.
- Files added to bypass the green-light gate (skipping tests via `.skip`,
  disabling lint rules inline, `--no-verify` git pushes).
- Direct writes to `main` or other protected branches.
- Hardcoded secrets, API keys, or tokens.
- Hardcoded sponsor or stakeholder identifiers (channel IDs, chat IDs, repo
  slugs) inside operating logic — those belong in config or routing maps.

### Flag (don't auto-block)
- Three or more similar lines suggesting an abstraction may be premature.
- New dependencies for trivial functionality.
- Comments narrating what code does (the well-named identifier already does
  that). Comments are for the *why* — non-obvious constraints, workarounds,
  hidden invariants.
- Backwards-compatibility shims when the upstream caller can be updated in the
  same PR.

### Approve fast
- Tests that exercise BDD acceptance criteria from the story spec.
- Code that matches existing patterns in the same package.
- Diffs that delete more than they add (refactor or simplification).
- PRs that close a known mistakes-log entry under
  `obsidian-vault/Agent-Core/mistakes.md` upstream.

### Codex-specific
- If a PR comment mentions `@codex review`, run an additional review pass
  beyond the automatic one.
- If a PR comment mentions `@codex <free-text>`, treat as a Codex Cloud task
  request — do not interpret it as part of the review pass.

## Build & test

See `CLAUDE.md` for the full coding protocol. The single gate is
`.claude/scripts/green-light.sh` — when it exits 0, the change is ready.


<claude-mem-context>
# Memory Context

# [mezoyield] recent context, 2026-05-22 8:55am GMT+1

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (29,249t read) | 613,287t work | 95% savings

### May 11, 2026
715 6:28p ✅ v2 redesign specification and feature scope documented
716 " 🟣 Protocol earnings visualization with historical aggregate claim data
717 " 🟣 Protocol strategy mix distribution hook and on-card usage badges
718 " 🟣 /docs route with static public documentation
719 " 🟣 Dashboard pre-connect reverse empty state with example user row
720 " 🟣 Light/dark theme support with next-themes integration
721 " 🟣 Settings UI refresh with Boar-style segmented bars
725 6:29p 🔵 Pre-push code review findings: v2 redesign diff validated clean
730 7:39p 🔵 Large v2 redesign with light/dark theming, keeper optimizations, and expanded test coverage
731 " 🟣 Keeper refactored with per-epoch deduplication and testable pure-logic flow
732 " 🟣 UI redesign: theming, typography system, and visual atmosphere
733 " ✅ Deployment infrastructure: nixpacks.toml + smoke gate validation
734 " ✅ Webpack/Next.js bundle fixes: @metamask/sdk AsyncStorage alias
735 " 🔵 Complete test suite passes: 147 tests across 28 files with v2 redesign
736 7:40p 🔵 Production build succeeds with static generation for all 12 routes
737 " 🔵 Keeper service passes all 28 tests; deployment configuration validates dual-service architecture
738 " 🟣 Integration test suite added: proof-of-functionality on live Mezo testnet
739 " 🔵 Frontend linting clean; application hooks implement honest data sourcing with subgraph fallback
740 7:41p 🟣 Landing and dashboard UI implements "receipts, not promises" credibility pattern; never invents data
741 " ✅ Core data hooks refactored for RPC reliability: chunked getLogs, wallet-switch guards, dual-path gauge sourcing
S115 Code review of pending changes against main branch (merge base 7e71f6a); identify prioritized, actionable findings in the Mezo hackathon project. (May 11 at 7:43 PM)
S401 Review current code changes (staged, unstaged, untracked files) and provide prioritized findings for Mezo Yield hackathon project (May 11 at 7:43 PM)
### May 20, 2026
2339 9:43a 🟣 Mainnet Support Architecture: Build-Time Network Selection with Fail-Fast Deployment Validation
2340 " 🔵 Deployment State: Incomplete Mainnet Rollout (Phase 5 Pending)
2341 " ✅ Address Validation Standardized Across Frontend and Backend
2342 " 🔵 Test Coverage and Backward Compatibility Strategy Across Dual-Network Buildout
2343 " 🔵 Cross-Codebase Contract Address Wiring: 50+ Import Sites for Optimizer/GaugeController/Matchbox/VeMezo
2344 " 🔵 UI Network Awareness: Chain-ID-Driven Rendering in Landing, Sidebar, and Docs
2345 9:44a 🔵 Wallet Connector Integration: @mezo-org/passport Accepts mezoNetwork Parameter, Defaults to Mainnet
2346 " 🔵 Deploy Scripts: Only testnet Script Present; Mainnet Rollout Requires deploy:mainnet Addition
2347 " 🔵 Keeper Test Suite: Test Isolation Pattern + Epoch Dedup Edge Cases Covered Post-Codex P1
2348 " 🔵 Frontend Test Suite Green: 147 Tests Pass, Including New Mainnet Chain Detection Tests
2349 9:45a 🔵 Deploy Script Ready for Mainnet: Network Config and Filename Mapping Already in Place
2350 " 🔵 Contract + Keeper + Frontend Algorithm Parity: Identical Gauge Read and Allocation Paths Across All Layers
2351 " 🔵 Mock Contract Strategy: Deterministic Gauge Addresses (keccak) on Testnet; Mainnet Uses Real BoostVoter + Per-Gauge Adapter
2352 9:46a 🔵 Frontend Test Coverage Includes Static Public Pages: Docs, AppHeader, Providers All Testnet-Aware
2353 " 🔵 Code Review Complete: Mainnet Support Architecture Fully Wired with Defensive Validation at Module Load
2354 " 🔵 Contract Test Suite Green: 34 Tests Pass, Including Manifest Schema + Mock Registry + Optimizer Logic
2355 9:48a 🔵 Hardcoded Testnet Explorer URL in Footer: Should Use Dynamic MEZO_EXPLORER Constant for Mainnet Support
2356 9:49a 🔵 Hardcoded Testnet Strings and URLs Across Landing Components: Need Mainnet-Aware Rendering
S402 Review mainnet support implementation (feat/mainnet-support-phase-1 branch): examine code changes for staged rollout strategy, deployment state, validation guards, and readiness assessment. (May 20 at 9:50 AM)
S403 Review current code changes (staged, unstaged, untracked files) for prioritized findings — identified P1 mainnet deployment vulnerability and P2 repo-level agent instruction leak (May 20 at 9:50 AM)
S404 Review the current code changes (staged, unstaged, and untracked files) on the mezoyield mainnet support Phase 1 PR and provide prioritized findings (May 20 at 10:06 AM)
S405 Review the current code changes (staged, unstaged, and untracked files) in the MezoYield mainnet support phase 1 PR and provide prioritized findings. (May 20 at 10:06 AM)
2372 10:11a 🟣 Mainnet support infrastructure with environment-based deployment switching
2373 10:12a 🔵 Null-address fail-fast guard prevents premature mainnet deployment
2374 " 🔵 Mainnet manifest declares real Mezo external contract addresses verified on-chain
2375 10:14a 🟣 Regression test suite validates network selector behavior across all states
2376 " 🔵 @mezo-org/passport v0.17.2 integrates getConfig(mezoNetwork) for dual-chain wagmi setup
2377 10:15a ✅ .env.example files not yet updated for mainnet-specific env vars
S406 Code review of Phase 1 mainnet support implementation for MezoYield: staged changes adding Mezo mainnet (chain 31612) deployment infrastructure, build-time/runtime network switching, fail-fast validation, and keeper epoch deduplication. (May 20 at 10:17 AM)
S407 Review current code changes (staged, unstaged, untracked) and provide prioritized findings for MezoYield hackathon project (May 20 at 10:30 AM)
S408 Review code changes (staged, unstaged, untracked files) and provide prioritized findings for a mainnet deployment in a Mezo yield farming application. (May 20 at 10:30 AM)
2393 10:38a 🟣 Mainnet support infrastructure with strict build-time network selection
2394 " 🔵 Comprehensive monorepo-wide mainnet deployment infrastructure with phase-gated architecture
2395 10:39a 🔵 Mainnet support PR passes full test and lint suite with 152 tests green
2396 10:40a 🔵 Environment variable documentation gap for mainnet configuration
2397 10:41a 🔵 Next.js production build succeeds with mainnet support code
2398 10:42a 🔵 Deployment configuration ready for dual-environment Coolify services
S409 Comprehensive code review of mainnet support Phase 1 implementation for MezoYield, examining all staged changes across frontend, keeper, and contracts packages (May 20 at 10:46 AM)
**Investigated**: Examined dual-manifest architecture for testnet/mainnet network selection across @mezoyield/app, @mezoyield/keeper, and @mezoyield/contracts. Reviewed strict build-time validation logic in contracts.ts and config.ts, mainnet deployment manifest structure, deploy-mainnet.ts script, test regression suite for network selector, and production build output. Validated all 200+ tests across three packages, TypeScript type checking, and git hygiene.

**Learned**: The implementation uses a phase-gated deployment strategy with null contract addresses in the mainnet manifest that fail loudly at module load until Phase 5 deploys the Optimizer. Build-time env vars (NEXT_PUBLIC_MEZO_NETWORK for frontend, MEZO_NETWORK for keeper) select which manifest to use at compile time, enabling separate Coolify services per domain. The pattern mirrors across app/lib/contracts.ts, keeper/src/config.ts, and Hardhat config. Real Mezo addresses are stored in an external field for reference but not wired directly into the contract slots due to ABI incompatibilities (BoostVoter vs IGaugeController, per-gauge bribes vs singleton Matchbox). The dual-manifest import adds no observable bundle overhead due to tree-shaking.

**Completed**: Staged changes include: new regression test suite (contractsNetworkSelector.test.ts, 5 tests), mainnet deployment manifest and script, Hardhat mezoMainnet network config, strict validation in contracts.ts and keeper config.ts, dynamic chain selection in wagmi.ts and Providers.tsx, dynamic ticker labels and cross-domain links. All 214 tests passing (152 app + 28 keeper + 34 contracts). Next.js production build succeeds. TypeScript strict mode satisfied. No formatting or whitespace issues.

**Next Steps**: Address three findings from automated review: (1) Document NEXT_PUBLIC_MEZO_NETWORK and MEZO_NETWORK env vars in .env.example files and deployment guide for Coolify mainnet service setup; (2) Add regression test coverage for wagmi.ts and Providers.tsx under mainnet env var state (currently only contracts.ts selector is tested); (3) Remove transient session-specific memory context from AGENTS.md before merge (appears to be internal review state that should not persist as repo guidance).


Access 613k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>