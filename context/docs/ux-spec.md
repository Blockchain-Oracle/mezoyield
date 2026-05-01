# UX Spec — MezoYield
**Version:** 1.0 — 2026-04-30

---

## Anchor product

**Liquity v2 Bold Frontend**

**Repo:** https://github.com/liquity/bold  
**License:** MIT (fork-friendly)  
**Tech Stack:** Next.js 15, React 18, Panda CSS, TypeScript, pnpm monorepo  
**Last Commit:** April 29, 2025 (actively maintained)

### Why this anchor

Liquity Bold's governance voting interface is directly applicable to MezoYield. It includes:
- Voting delegation panels (adapt to veMEZO delegation)
- Vote weight distribution visualization (adapt to gauge allocation)
- Active governance feedback loops (adapt to epoch countdown + reward tracking)
- Production-grade TypeScript + Panda CSS design system

Same product successfully used for MezoStream (April 2026). Known good baseline.

### Clone-or-replicate verdict

**FORK RECOMMENDED.** Extract the frontend package, rebrand colors/naming, adapt governance calls to MEZO gauge voting calls. Rebranding cleanup is mandatory (hackathon-playbook §12).

### Design token override plan

Liquity Bold uses Panda CSS for design tokens. Override in `panda.config.ts`:
- Primary color: `#F7931A` (Bitcoin orange)
- Background: `#0D0D0D`
- Accent: `#10B981` (gauge success state)
- Fonts: keep as-is (Liquity's font choices are solid)

Full token list in design tokens table below.

---

## Layout shape — SPA + mode toggle

Per hackathon-playbook.md §12: Single route (`/`), two modes:

**Mode 1: Dashboard**
```
┌─────────────────────────────────────────────────┐
│  MezoYield        [Dashboard] [Optimize]  [🔗 Connect] │
├───────────────┬─────────────────────────────────┤
│ My Position   │ Gauge Board                     │
│               │ ┌──────┬────────┬──────────────┐│
│ veMEZO: 1200  │ │Gauge │ APY    │ My Weight    ││
│               │ │ A    │ 12.4%  │ 40%          ││
│ Est reward:   │ │ B    │  8.1%  │ 30%          ││
│ 42 MUSD/epoch │ │ C    │  5.3%  │ 30%          ││
│               │ └──────┴────────┴──────────────┘│
├───────────────┴─────────────────────────────────┤
│ Epoch countdown: 3d 14h 22m                     │
├─────────────────────────────────────────────────┤
│ Yield history chart (MUSD/epoch, last 8 epochs) │
└─────────────────────────────────────────────────┘
```

**Mode 2: Optimize**
```
┌─────────────────────────────────────────────────┐
│  MezoYield        [Dashboard] [Optimize]  [✓ Connected] │
├─────────────────────────────────────────────────┤
│ Optimization Strategy                           │
│  ○ Auto (max MUSD yield)   ● Manual             │
├─────────────────────────────────────────────────┤
│ Gauge allocation                                │
│  Gauge A  [──────────────] 40%                  │
│  Gauge B  [─────────────]  35%                  │
│  Gauge C  [──────]         25%                  │
├─────────────────────────────────────────────────┤
│          [Preview optimal] [Submit vote]        │
└─────────────────────────────────────────────────┘
```

---

## Design tokens (provisional — anchor overrides these)

| Token | Value | Usage |
|---|---|---|
| Primary | `#F7931A` (Bitcoin orange) | CTAs, active state |
| Background | `#0D0D0D` | App background |
| Surface | `#1A1A1A` | Cards |
| Border | `#2A2A2A` | Card borders |
| Text primary | `#FFFFFF` | Headings |
| Text secondary | `#9CA3AF` | Labels |
| Accent | `#10B981` (green) | Positive yields |
| Warning | `#F59E0B` | Epoch urgency |

*Note: Final tokens come from the anchor product after UI mining. These are placeholders — do NOT hardcode them.*

---

## Components

| Component | Location | Description |
|---|---|---|
| `PositionCard` | Dashboard | Shows veMEZO balance, estimated MUSD/epoch, claim button |
| `GaugeBoard` | Dashboard | Table of all active gauges, APY from Matchbox, current user weight |
| `EpochCountdown` | Dashboard | Countdown timer to next epoch, progress bar |
| `YieldChart` | Dashboard | Recharts bar chart — MUSD earned per epoch, last 8 epochs |
| `OptimizeModal` | Optimize | Strategy selector (auto/manual) + allocation sliders |
| `ClaimButton` | PositionCard | Single-click claim; shows pending MUSD amount |
| `ConnectButton` | Header | Mezo Passport connection state |

---

## Critical UX rules

1. **Never show raw gauge addresses** — resolve to human-readable names via subgraph metadata
2. **Always show rewards in MUSD** — not in raw token units
3. **Epoch countdown is always visible** — it's the primary urgency signal
4. **Auto-optimize is the default strategy** — manual is opt-in
5. **Loading states on all async data** — skeleton cards, not blank/broken UI
6. **Wallet not connected = read-only mode** — show live gauge data but disable actions
