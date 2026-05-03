"use client";

import { useAccount } from "wagmi";
import { formatUnits } from "viem";
import { Trophy, Medal, Award } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { truncateAddress, cn } from "@/lib/utils";
import { useLeaderboard } from "./useLeaderboard";

const RANK_ICON = {
  0: { icon: Trophy, className: "text-amber-400" },
  1: { icon: Medal, className: "text-zinc-300" },
  2: { icon: Award, className: "text-orange-400" },
} as const;

export function LeaderboardTable() {
  const { rows, isLoading, isError, error } = useLeaderboard();
  const { address } = useAccount();

  if (isLoading) {
    return (
      <Card className="bg-card">
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="bg-card">
        <CardContent>
          <p className="text-sm text-destructive">
            Couldn&rsquo;t load leaderboard: {error?.message ?? "unknown error"}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (rows.length === 0) {
    return (
      <Card className="bg-card">
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No claims yet — be the first to claim and top this board.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card">
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>User</TableHead>
              <TableHead className="text-right">Claims</TableHead>
              <TableHead className="text-right">Total earned</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, i) => {
              const isMe =
                address && row.user.toLowerCase() === address.toLowerCase();
              const rankIcon = RANK_ICON[i as keyof typeof RANK_ICON];
              const total = Number(formatUnits(row.totalWei, 18));
              return (
                <TableRow
                  key={row.user}
                  className={cn(isMe && "bg-mezo-soft hover:bg-mezo-soft/80")}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-muted-foreground">
                        {i + 1}
                      </span>
                      {rankIcon && (
                        <rankIcon.icon
                          aria-hidden
                          className={cn("h-4 w-4", rankIcon.className)}
                        />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-foreground">
                        {truncateAddress(row.user)}
                      </span>
                      {isMe && (
                        <Badge className="bg-mezo text-primary-foreground">
                          You
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {row.claimCount}
                  </TableCell>
                  <TableCell className="text-right font-mono text-mezo">
                    {total.toFixed(2)} MUSD
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
