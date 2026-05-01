import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MezoYield — Gauge optimizer for veMEZO holders",
  description:
    "Auto-vote your veMEZO gauges for maximum MUSD yield. Connect with Mezo Passport and let MezoYield optimize your allocations every epoch.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
