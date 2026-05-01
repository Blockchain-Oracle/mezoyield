"use client";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Header } from "@/components/Header";
import { ConnectButton } from "@/components/ConnectButton";

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
          <div
            className="rounded-lg border border-border bg-card p-12 text-center text-muted-foreground"
            data-testid="dashboard-panel"
          >
            Your gauges, position, and yield will appear here.
          </div>
        </TabsContent>

        <TabsContent value="optimize">
          <div
            className="rounded-lg border border-border bg-card p-12 text-center text-muted-foreground"
            data-testid="optimize-panel"
          >
            Choose your strategy — auto or manual.
          </div>
        </TabsContent>
      </main>
    </Tabs>
  );
}
