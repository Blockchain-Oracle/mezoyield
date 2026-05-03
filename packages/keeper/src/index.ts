import cron from "node-cron";
import pino from "pino";
import { runOnce } from "./runOnce.js";

const logger = pino({
  transport: { target: "pino-pretty", options: { colorize: true } },
});

/**
 * Long-running keeper loop. Runs once per Mezo epoch (~7 days).
 *
 * Cron expression: `5 0 * * *` = every day at 00:05 UTC. We schedule
 * daily and let the contract's idempotency take care of correctness:
 * casting the same allocation twice in one epoch is a no-op (weights
 * unchanged), and the gauge controller will only count one vote per
 * epoch per voter. Daily firing also self-heals if a single run fails.
 *
 * For production-grade you'd compute the next epoch boundary via
 * `Math.ceil(now / 604_800) * 604_800` and schedule a single timer
 * to that exact moment, but daily-with-idempotency is robust enough
 * for the MezoYield testnet demo and avoids edge cases around
 * daylight-savings, leap seconds, and node restarts.
 *
 * Run with:
 *   pnpm --filter @mezoyield/keeper start    # cron loop
 *   pnpm --filter @mezoyield/keeper once     # one-shot vote (demo)
 */
async function safeRun(label: string) {
  try {
    logger.info({ label }, "keeper tick — submitting vote");
    const { txHash } = await runOnce();
    logger.info({ label, txHash }, "tick OK");
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

  // Fire once immediately on boot so a fresh deployment isn't waiting
  // for the next midnight to cast its first vote. Idempotent against
  // the contract — if the keeper already voted this epoch, the next
  // tick is a no-op for distribution purposes.
  void safeRun("boot");
}

start();
