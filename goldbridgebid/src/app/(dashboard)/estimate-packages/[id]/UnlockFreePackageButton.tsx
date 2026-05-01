"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LockOpen } from "lucide-react";
import { unlockFreeEstimatePackage } from "../actions";

interface UnlockFreePackageButtonProps {
  packageId: string;
}

export default function UnlockFreePackageButton({
  packageId,
}: UnlockFreePackageButtonProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleUnlock() {
    setError(null);
    startTransition(async () => {
      const result = await unlockFreeEstimatePackage(packageId);

      if (result?.error) {
        setError(result.error);
        return;
      }

      router.refresh();
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleUnlock}
        disabled={isPending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-secondary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-secondary-dark disabled:cursor-not-allowed disabled:opacity-60"
      >
        <LockOpen className="h-4 w-4" />
        {isPending ? "Unlocking..." : "Unlock Free Package"}
      </button>
      {error && (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

