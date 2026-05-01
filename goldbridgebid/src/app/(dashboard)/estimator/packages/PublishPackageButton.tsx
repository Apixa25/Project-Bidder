"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud } from "lucide-react";
import { publishEstimatePackage } from "./actions";

interface PublishPackageButtonProps {
  packageId: string;
}

export default function PublishPackageButton({
  packageId,
}: PublishPackageButtonProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handlePublish() {
    setError(null);
    startTransition(async () => {
      const result = await publishEstimatePackage(packageId);

      if (result?.error) {
        setError(result.error);
        return;
      }

      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <button
        type="button"
        onClick={handlePublish}
        disabled={isPending}
        className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-secondary-dark disabled:cursor-not-allowed disabled:opacity-60"
      >
        <UploadCloud className="h-3.5 w-3.5" />
        {isPending ? "Publishing..." : "Publish"}
      </button>
      {error && <p className="max-w-48 text-xs text-red-600">{error}</p>}
    </div>
  );
}

