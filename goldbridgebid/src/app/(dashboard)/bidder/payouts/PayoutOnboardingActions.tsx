"use client";

import { useState, useTransition } from "react";
import {
  beginBidderPayoutOnboarding,
  refreshBidderPayoutStatus,
} from "./actions";

interface PayoutOnboardingActionsProps {
  hasStripeAccount: boolean;
  isReady: boolean;
}

export default function PayoutOnboardingActions({
  hasStripeAccount,
  isReady,
}: PayoutOnboardingActionsProps) {
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        {!isReady && (
          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                setMessage(null);

                const result = await beginBidderPayoutOnboarding();
                if (result?.error) {
                  setError(result.error);
                  return;
                }

                if (result && "url" in result && result.url) {
                  window.location.href = result.url;
                }
              })
            }
            className="rounded-lg bg-secondary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-secondary-dark disabled:opacity-60"
          >
            {isPending
              ? "Preparing..."
              : hasStripeAccount
                ? "Continue Stripe Onboarding"
                : "Start Stripe Onboarding"}
          </button>
        )}

        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              setMessage(null);

              const result = await refreshBidderPayoutStatus();
              if (result?.error) {
                setError(result.error);
                return;
              }

              setMessage("Payout status refreshed.");
              window.location.reload();
            })
          }
          className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-hover disabled:opacity-60"
        >
          {isPending ? "Refreshing..." : "Refresh Status"}
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      {message && <p className="mt-3 text-sm text-green-700">{message}</p>}
    </div>
  );
}
