"use client";

import { useWalletReady } from "@/app/providers";
import { PageHeader } from "@/components/chrome/PageHeader";
import { PageSkeleton } from "@/components/chrome/PageSkeleton";
import { SubNav } from "@/components/chrome/SubNav";
import { INSIGHTS_SUBNAV } from "@/components/Sidebar/sidebarConfig";
import { LeaderboardTable } from "@/features/leaderboard/LeaderboardTable";

export default function LeaderboardPage() {
  const walletReady = useWalletReady();
  if (!walletReady) {
    return <PageSkeleton variant="table" />;
  }
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Insights"
        title="Top earners on MezoYield"
        description={
          <>
            Ranked by total MUSD claimed via the optimizer. Aggregated live from
            on-chain RewardsClaimed events — no off-chain database. Your row
            highlights when you&rsquo;re connected.
          </>
        }
      />
      <SubNav items={INSIGHTS_SUBNAV} />
      <LeaderboardTable />
    </div>
  );
}
