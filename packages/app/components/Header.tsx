import { ReactNode } from "react";

type HeaderProps = {
  tabs: ReactNode;
  connectSlot: ReactNode;
};

export function Header({ tabs, connectSlot }: HeaderProps) {
  return (
    <header className="flex items-center justify-between border-b border-border px-6 py-4">
      <div className="flex items-baseline gap-2">
        <span className="text-xl font-semibold tracking-tight text-mezo">
          MezoYield
        </span>
        <span className="hidden text-xs text-muted-foreground sm:inline">
          set-and-forget MEZO yield
        </span>
      </div>
      <div className="flex-1 flex justify-center">{tabs}</div>
      <div className="min-w-[160px] flex justify-end">{connectSlot}</div>
    </header>
  );
}
