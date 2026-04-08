"use client";

import { Loader2 } from "lucide-react";

interface ActionPendingOverlayProps {
  label: string;
}

export default function ActionPendingOverlay({
  label,
}: ActionPendingOverlayProps) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-surface/85 backdrop-blur-[2px]">
      <div className="rounded-xl border border-border bg-surface px-5 py-4 text-center shadow-lg">
        <div className="flex items-center justify-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm font-semibold text-text-primary">{label}</span>
        </div>
      </div>
    </div>
  );
}
