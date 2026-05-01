export function GaugeBoardSkeleton() {
  return (
    <div
      data-testid="gauge-board-skeleton"
      className="rounded-lg border border-border bg-card overflow-hidden"
    >
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-muted/30">
          <tr className="text-left text-muted-foreground">
            <th className="px-4 py-3 font-medium">Gauge</th>
            <th className="px-4 py-3 font-medium text-right">APY</th>
            <th className="px-4 py-3 font-medium text-right">Incentive (MUSD/wk)</th>
            <th className="px-4 py-3 font-medium text-right">My weight</th>
          </tr>
        </thead>
        <tbody>
          {[0, 1, 2, 3].map((i) => (
            <tr key={i} className="border-b border-border last:border-0">
              <td className="px-4 py-3">
                <div className="h-4 w-32 animate-pulse rounded bg-muted" />
              </td>
              <td className="px-4 py-3">
                <div className="ml-auto h-4 w-12 animate-pulse rounded bg-muted" />
              </td>
              <td className="px-4 py-3">
                <div className="ml-auto h-4 w-16 animate-pulse rounded bg-muted" />
              </td>
              <td className="px-4 py-3">
                <div className="ml-auto h-4 w-10 animate-pulse rounded bg-muted" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
