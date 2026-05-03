"use client";

import { useRouter } from "next/navigation";

export function BrowserBackButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium text-text-primary shadow-sm transition-colors hover:bg-surface-hover"
    >
      Go back
    </button>
  );
}
