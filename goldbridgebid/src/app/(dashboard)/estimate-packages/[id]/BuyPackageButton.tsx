"use client";

import { useEffect, useState, useTransition } from "react";
import { CreditCard } from "lucide-react";
import { createEstimatePackageCheckoutSession } from "../actions";

interface BuyPackageButtonProps {
  packageId: string;
  priceLabel: string;
}

export default function BuyPackageButton({
  packageId,
  priceLabel,
}: BuyPackageButtonProps) {
  const [error, setError] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (checkoutUrl) {
      window.location.assign(checkoutUrl);
    }
  }, [checkoutUrl]);

  function handleCheckout() {
    setError(null);
    startTransition(async () => {
      const result = await createEstimatePackageCheckoutSession(packageId);

      if (result.error) {
        setError(result.error);
        return;
      }

      if (!result.checkoutUrl) {
        setError("Stripe checkout did not return a checkout URL.");
        return;
      }

      setCheckoutUrl(result.checkoutUrl);
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleCheckout}
        disabled={isPending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
      >
        <CreditCard className="h-4 w-4" />
        {isPending ? "Preparing Checkout..." : `Buy Package - ${priceLabel}`}
      </button>
      {error && (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

