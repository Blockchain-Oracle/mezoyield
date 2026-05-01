"use client";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Header } from "@/components/Header";
import { ConnectButton } from "@/components/ConnectButton";
import { GaugeBoard } from "@/components/Dashboard/GaugeBoard";
import { PositionCard } from "@/components/Dashboard/PositionCard";
import { EpochCountdown } from "@/components/Dashboard/EpochCountdown";
import { YieldChart } from "@/components/Dashboard/YieldChart";
import { OptimizeModal } from "@/components/OptimizeModal";

const TAB_TRIGGERS = (
  <TabsList variant="line">
    <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
    <TabsTrigger value="optimize">Optimize</TabsTrigger>
  </TabsList>
);

export default function HomePage() {
  return (
    <Tabs defaultValue="dashboard" className="min-h-screen">
      <Header tabs={TAB_TRIGGERS} connectSlot={<ConnectButton />} />

      <main className="mx-auto max-w-5xl px-6 py-8">
        <TabsContent value="dashboard">
          <div data-testid="dashboard-panel" className="space-y-6">
            <EpochCountdown />
            <PositionCard />
            <YieldChart />
            <GaugeBoard />
          </div>
        </TabsContent>

        <TabsContent value="optimize">
          <div data-testid="optimize-panel" className="space-y-6">
            <OptimizeModal />
          </div>
        </TabsContent>
      </main>
    </Tabs>
  );
}
