"use client";

import { CheckCircle2 } from "lucide-react";

interface CoreCredentialsCheckProps {
  className?: string;
  showLabel?: boolean;
}

export default function CoreCredentialsCheck({
  className = "",
  showLabel = false,
}: CoreCredentialsCheckProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-emerald-600 ${className}`}
      title="Core Verified: contractor license, surety bond, and general liability insurance uploaded."
      aria-label="Core Verified: contractor license, surety bond, and general liability insurance uploaded."
    >
      <CheckCircle2 className="h-4 w-4 shrink-0 fill-emerald-100" />
      {showLabel && <span className="text-xs font-semibold">Core Verified</span>}
    </span>
  );
}
