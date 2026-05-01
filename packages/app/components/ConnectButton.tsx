"use client";

import { ConnectButton as RainbowConnectButton } from "@rainbow-me/rainbowkit";
import { Button } from "@/components/ui/button";

export function ConnectButton() {
  return (
    <RainbowConnectButton.Custom>
      {({ account, chain, openAccountModal, openConnectModal, mounted }) => {
        const ready = mounted;
        const connected = ready && account && chain;

        if (!connected) {
          return (
            <Button
              onClick={openConnectModal}
              className="bg-[#F7931A] text-black hover:bg-[#FFA640]"
              disabled={!ready}
            >
              Connect
            </Button>
          );
        }

        return (
          <Button
            variant="outline"
            onClick={openAccountModal}
            className="font-mono text-sm"
          >
            {account.displayName}
          </Button>
        );
      }}
    </RainbowConnectButton.Custom>
  );
}
