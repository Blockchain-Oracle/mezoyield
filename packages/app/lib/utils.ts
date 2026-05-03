import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Truncate an EVM address to `0x1234…ABCD`. Mirrors Neko's helper of
 * the same name (their version handles Stellar G-prefix addresses too;
 * we only ever pass 0x… so the simpler 6-prefix / 4-suffix slice is
 * equivalent).
 */
export function truncateAddress(address: string): string {
  if (!address) return "";
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
