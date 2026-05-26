import { describe, it, expect } from "vitest";
import { isCosmosTtlError } from "@/features/strategies/useActivateStrategy";

/**
 * Locks the Cosmos-TTL revert pattern so we don't accidentally start
 * surfacing the "Re-sign Cosmos approval" CTA on unrelated errors. The
 * MEZO precompile's actual revert string varies slightly across
 * Mezo-EVM versions ("does not exist" vs "is expired") — the matcher
 * has to handle both.
 */
describe("isCosmosTtlError", () => {
  it("matches the 'does not exist' variant from older Mezo precompile builds", () => {
    expect(
      isCosmosTtlError(
        "execution reverted: MsgSend authorization type does not exist",
      ),
    ).toBe(true);
  });

  it("matches the 'is expired' variant from newer Mezo precompile builds", () => {
    expect(
      isCosmosTtlError(
        "Internal error: MsgSend authorization is expired for this grant",
      ),
    ).toBe(true);
  });

  it("matches case-insensitively (provider-specific error capitalization)", () => {
    expect(
      isCosmosTtlError("msgsend authorization is expired"),
    ).toBe(true);
  });

  it("does NOT match a generic revert", () => {
    expect(isCosmosTtlError("Transaction reverted on-chain.")).toBe(false);
  });

  it("does NOT match a different precompile error", () => {
    expect(
      isCosmosTtlError("insufficient balance for transfer"),
    ).toBe(false);
  });

  it("returns false for undefined / empty input", () => {
    expect(isCosmosTtlError(undefined)).toBe(false);
    expect(isCosmosTtlError("")).toBe(false);
  });
});
