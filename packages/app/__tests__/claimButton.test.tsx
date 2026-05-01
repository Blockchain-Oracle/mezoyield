import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

/**
 * STORY-008 BDD coverage for ClaimButton:
 *   - User has pending → "Claim X MUSD" + click submits
 *   - Pending == 0 → button disabled, label "No pending rewards"
 *   - Disconnected → component renders nothing (PositionCard handles
 *     the "Connect wallet" empty state)
 *   - In-flight transaction → button disabled with "Confirming…"
 */

const claimState: {
  value: {
    pendingWei: bigint;
    isLoadingPending: boolean;
    isRefetchingPending: boolean;
    status: "idle" | "writing" | "confirming" | "success" | "error";
    txHash?: `0x${string}`;
    errorMessage?: string;
    claim: () => Promise<void>;
    reset: () => void;
  };
} = {
  value: {
    pendingWei: 0n,
    isLoadingPending: false,
    isRefetchingPending: false,
    status: "idle",
    claim: vi.fn(),
    reset: vi.fn(),
  },
};

const accountState: { value: { address?: `0x${string}` } } = { value: {} };

vi.mock("@/hooks/useClaimRewards", () => ({
  useClaimRewards: () => claimState.value,
}));

vi.mock("wagmi", () => ({
  useAccount: () => accountState.value,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { ClaimButton } from "@/components/ClaimButton";

describe("ClaimButton", () => {
  beforeEach(() => {
    accountState.value = { address: "0xa0000000000000000000000000000000000000aa" };
    claimState.value = {
      pendingWei: 0n,
      isLoadingPending: false,
      isRefetchingPending: false,
      status: "idle",
      claim: vi.fn(),
      reset: vi.fn(),
    };
  });

  it("renders nothing when no wallet is connected", () => {
    accountState.value = {};
    const { container } = render(<ClaimButton />);
    expect(container.firstChild).toBeNull();
  });

  it("disables with 'No pending rewards' when pending is 0", () => {
    claimState.value = { ...claimState.value, pendingWei: 0n };
    render(<ClaimButton />);
    const btn = screen.getByTestId("claim-button");
    expect(btn).toBeDisabled();
    expect(btn).toHaveTextContent(/no pending rewards/i);
  });

  it("renders 'Claim X.XX MUSD' when pending > 0", () => {
    claimState.value = {
      ...claimState.value,
      pendingWei: 25n * 10n ** 18n,
    };
    render(<ClaimButton />);
    expect(screen.getByTestId("claim-button")).toHaveTextContent(
      /Claim 25\.00 MUSD/,
    );
  });

  it("calls claim() on click and the button is enabled", () => {
    const claimFn = vi.fn();
    claimState.value = {
      ...claimState.value,
      pendingWei: 12n * 10n ** 18n,
      claim: claimFn,
    };
    render(<ClaimButton />);
    const btn = screen.getByTestId("claim-button");
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);
    expect(claimFn).toHaveBeenCalledTimes(1);
  });

  it("shows 'Confirming…' and disables button while writing", () => {
    claimState.value = {
      ...claimState.value,
      pendingWei: 12n * 10n ** 18n,
      status: "writing",
    };
    render(<ClaimButton />);
    const btn = screen.getByTestId("claim-button");
    expect(btn).toBeDisabled();
    expect(btn).toHaveTextContent(/confirming/i);
  });

  it("shows 'Settling…' and disables button while confirming on-chain", () => {
    claimState.value = {
      ...claimState.value,
      pendingWei: 12n * 10n ** 18n,
      status: "confirming",
    };
    render(<ClaimButton />);
    const btn = screen.getByTestId("claim-button");
    expect(btn).toBeDisabled();
    expect(btn).toHaveTextContent(/settling/i);
  });

  it("stays disabled in the success → pending-refetch settle window (Codex P2 round 4)", () => {
    // Race: receipt landed → status="success" but the optimistic refetch of
    // pendingWei hasn't returned yet, so pendingWei is the stale pre-claim
    // value. Without the settle gate the button would re-enable here and a
    // second click would submit a duplicate tx.
    claimState.value = {
      ...claimState.value,
      pendingWei: 12n * 10n ** 18n,
      status: "success",
      isRefetchingPending: true,
    };
    render(<ClaimButton />);
    const btn = screen.getByTestId("claim-button");
    expect(btn).toBeDisabled();
    expect(btn).toHaveTextContent(/settling/i);
  });

  it("stays disabled in the post-reset refetch window even when status is idle", () => {
    // After ClaimButton's success effect calls claim.reset(), status flips
    // to "idle" but the refetch may still be in flight. The CTA must stay
    // disabled until pendingWei reflects the post-claim balance.
    claimState.value = {
      ...claimState.value,
      pendingWei: 12n * 10n ** 18n,
      status: "idle",
      isRefetchingPending: true,
    };
    render(<ClaimButton />);
    const btn = screen.getByTestId("claim-button");
    expect(btn).toBeDisabled();
    expect(btn).toHaveTextContent(/settling/i);
  });
});
