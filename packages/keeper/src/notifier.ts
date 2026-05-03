import { DISCORD_WEBHOOK_URL } from "./config.js";

export type NotifyPayload = {
  txHash: string;
  blockNumber: string;
  allocation: { name: string; weightBps: number }[];
};

/**
 * Posts a vote-cast summary to the configured Discord webhook.
 * Silent no-op when the webhook isn't configured — keeper bot still
 * runs fine without notifications, this is purely operator UX.
 */
export async function notify(payload: NotifyPayload): Promise<void> {
  if (!DISCORD_WEBHOOK_URL) return;
  const lines = payload.allocation.map(
    (a) => `  • ${a.name}: ${(a.weightBps / 100).toFixed(0)}%`,
  );
  const body = {
    username: "MezoYield Keeper",
    content: [
      "✅ **Vote cast**",
      `tx: \`${payload.txHash}\``,
      `block: ${payload.blockNumber}`,
      "",
      "Allocation:",
      ...lines,
    ].join("\n"),
  };
  try {
    const res = await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      // Don't throw — notifier failure must NOT crash the keeper run.
      // The vote already succeeded on chain at this point.
      console.warn(
        `[notifier] webhook returned ${res.status} ${res.statusText}`,
      );
    }
  } catch (err) {
    console.warn(
      `[notifier] webhook send failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
