import cron from "node-cron";
import pino from "pino";
import { runOnce } from "./runOnce.js";

const logger = pino({
  transport: { target: "pino-pretty", options: { colorize: true } },
});

/**
 * Long-running keeper loop. Targets one vote per Mezo epoch (~7 days).
 *
 * Cron expression: `5 0 * * *` = every day at 00:05 UTC. We schedule
 * daily and let `runOnce`'s per-epoch dedup short-circuit redundant
 * runs: it reads the optimizer's most recent VoteCast event, computes
 * its epoch index, and skips if it matches the current chain epoch.
 * Daily firing also self-heals if a single run fails — the next tick
 * picks up the missed epoch.
 *
 * Codex P1 (PR #29): an earlier version assumed `castOptimalVote` was
 * idempotent within an epoch. It isn't — the gauge controller
 * overwrites lastVote on every call with no epoch check. Without the
 * dedup, daily firing would emit ~7× the necessary VoteCast events,
 * spamming the landing's ProofLedger and burning keeper gas.
 *
 * For production-grade you'd compute the next epoch boundary via
 * `Math.ceil(now / 604_800) * 604_800` and schedule a single timer
 * to that exact moment. Daily-with-dedup is robust enough for the
 * MezoYield testnet demo and avoids edge cases around DST, leap
 * seconds, and node restarts.
 *
 * Run with:
 *   pnpm --filter @mezoyield/keeper start    # cron loop
 *   pnpm --filter @mezoyield/keeper once     # one-shot vote (demo, force=true)
 */
async function safeRun(label: string) {
  try {
    logger.info({ label }, "keeper tick");
    const result = await runOnce(); // force=false; honor the epoch guard
    if (result.status === "submitted") {
      logger.info({ label, txHash: result.txHash, epoch: result.epoch }, "tick OK");
    } else {
      logger.info(
        { label, reason: result.reason, epoch: result.epoch },
        "tick skipped (already voted this epoch)",
      );
    }
  } catch (err) {
    logger.error(
      {
        label,
        err: err instanceof Error ? err.message : String(err),
      },
      "tick failed (will retry next tick)",
    );
  }
}

function start() {
  logger.info("keeper boot — scheduling 00:05 UTC daily cron");
  cron.schedule(
    "5 0 * * *",
    () => {
      void safeRun("scheduled");
    },
    { timezone: "Etc/UTC" },
  );

  // Fire once immediately on boot so a fresh deployment doesn't wait
  // until the next midnight to cast its first vote. The epoch guard
  // makes this safe across restarts: if the keeper already voted in
  // this epoch (whether by an earlier process or a manual demo run),
  // boot is a no-op.
  void safeRun("boot");
}

start();
