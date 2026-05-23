# Screenshots

Judge-facing captures referenced from the project README land here as `dashboard.png` and `optimize.png`.

## What to capture

### `dashboard.png`
A connected wallet on the Dashboard tab. Frame should show:

- Header with the truncated wallet-address chip on the right.
- `EpochCountdown` ticking with a non-zero progress bar.
- `PositionCard` with the "≈ X MUSD/week" hero, veMEZO balance, and the `Allocated: N gauges` summary if the wallet has voted.
- `YieldChart` showing 8 contiguous bars.
- `GaugeBoard` table with at least three rows (Stability Pool, MUSD Savings Rate, BTC-MUSD LP).

### `optimize.png`
Optimize tab with the modal open in **Auto** mode:

- Strategy radio set to Auto.
- Computed allocation as a horizontal stacked bar with gauge labels.
- "Estimated MUSD/week: X.XX" line below the bar.
- `Confirm` button enabled.

## Capture procedure

```bash
# Against the live demo:
npx playwright screenshot --viewport-size=1440,900 \
  https://mezoyield.xyz screenshots/dashboard.png

# Or locally:
pnpm install && pnpm dev
# then http://localhost:3000 in a browser with a Mezo testnet wallet
```
