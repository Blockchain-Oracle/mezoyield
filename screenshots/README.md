# Screenshots

> **Status: pending capture.** The two PNG artifacts (`dashboard.png` and `optimize.png`) are intentionally not committed in the same PR as the rest of the submission shell. The repo maintainer captures them against the live off-Vercel deploy in a follow-up commit, so the screenshots reflect the same UI a judge would see at `${DEMO_URL}` rather than a local-dev render. The capture procedure below is what the maintainer follows.

This directory holds the judge-facing screenshots referenced from the project README. Captures land here as `dashboard.png` and `optimize.png`, both annotated.

## What to capture

### `dashboard.png`

A connected wallet on the Dashboard tab. Frame should show:

- Header with the truncated wallet address chip on the right.
- `EpochCountdown` ticking with a non-zero progress bar.
- `PositionCard` with the "≈ X MUSD/week" hero, veMEZO balance, and either a "Connect wallet" hint or the `Allocated: N gauges` summary if the wallet has voted.
- `YieldChart` showing 8 contiguous bars (some zero) — the contiguous-calendar fix from PR #27.
- `GaugeBoard` table with at least three rows (Stability Pool, MUSD Savings Rate, BTC-MUSD LP).

### `optimize.png`

Optimize tab with the modal open in **Auto** mode. Frame should show:

- Strategy radio set to Auto.
- Computed allocation as a horizontal stacked bar with gauge labels.
- "Estimated MUSD/week: X.XX" line below the bar.
- `Confirm` button enabled.

## Capture procedure

The application is deployed off-Vercel by Abu post-merge; the URL is filled into the README at deploy time. To reproduce locally:

```bash
pnpm install
pnpm dev   # http://localhost:3000
```

Connect a Mezo testnet wallet via the Mezo Passport modal. The deployer EOA (`0x84f9…0004`) is pre-seeded with 1500 veMEZO and 25 MUSD pending — using its private key in a fresh browser profile gives a fully-populated demo state without any extra clicks.

For headless capture (after Vercel deploy):

```bash
# Replace DEMO_URL with the real demo URL.
npx playwright screenshot --viewport-size=1440,900 \
  $DEMO_URL screenshots/dashboard.png
```

## Annotations

Annotations call out the four user moments per the PRD's "≤30 second demo loop":

1. **Connect** — wallet chip in the header.
2. **See your position** — MUSD/week hero + epoch countdown.
3. **One CTA** — Auto-optimize button.
4. **Confirm + done** — toast on success and the chart updating.

Use a flat overlay (Excalidraw export, Figma annotation, or inline-SVG) so the annotations stay editable. Avoid baked-in screenshot annotators that flatten the markup into the PNG.
