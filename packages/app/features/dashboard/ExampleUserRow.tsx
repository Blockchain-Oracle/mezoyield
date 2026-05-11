/**
 * Pre-wallet-connect preview row for /app/dashboard. Renders one row of
 * static, plausible-shaped example data with an explicit `← example`
 * label so it can't be confused with real on-chain position data.
 *
 * Pure presentational — no wagmi hooks. The values are static props with
 * sensible defaults; passing different props is only useful for tests
 * and Storybook-style previews.
 *
 * Why this exists: Boar Finance's pre-connect dashboard shows an empty
 * "your stats appear here" panel, which asks the user to imagine the
 * value. The reverse pattern — show realistic example data with an
 * unambiguous label — activates faster without lying.
 *
 * §14 note: variable named `EXAMPLE_USER` (not `mockUser`, not `fakeUser`).
 * Lives in `features/`, not in any hot-path lib/hooks/components/Dashboard
 * directory. The literal text "example" is rendered to the DOM.
 */

export type ExampleUserData = {
  strategy: string;
  veMezo: number;
  musdPerWeek: number;
};

export const EXAMPLE_USER: ExampleUserData = {
  strategy: "Set & Forget",
  veMezo: 18.42,
  musdPerWeek: 0.14,
};

interface ExampleUserRowProps {
  data?: ExampleUserData;
}

export function ExampleUserRow({ data = EXAMPLE_USER }: ExampleUserRowProps) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-foreground/10 bg-card/40 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="inline-flex h-2 w-2 shrink-0 rounded-full bg-foreground/30"
        />
        <div className="flex flex-col">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            ← example · not your data
          </span>
          <span className="text-sm font-medium text-foreground">
            {data.strategy}
          </span>
        </div>
      </div>

      <div className="flex items-baseline gap-6 pl-5 sm:pl-0">
        <div className="flex flex-col">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            veMEZO
          </span>
          <span className="font-mono text-sm text-foreground">
            {data.veMezo.toFixed(2)} veMEZO
          </span>
        </div>
        <div className="flex flex-col">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Projected
          </span>
          <span className="font-mono text-sm text-mezo">
            {data.musdPerWeek.toFixed(2)} MUSD/wk
          </span>
        </div>
      </div>
    </div>
  );
}
