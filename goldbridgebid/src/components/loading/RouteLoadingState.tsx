"use client";

import { Loader2 } from "lucide-react";
import { BrandWordmark } from "@/components/BrandWordmark";

interface RouteLoadingStateProps {
  title?: string;
  message?: string;
  compact?: boolean;
}

export default function RouteLoadingState({
  title = "Loading your page",
  message = "We are pulling the latest project, bid, and account details for you.",
  compact = false,
}: RouteLoadingStateProps) {
  return (
    <div
      className={`flex w-full items-center justify-center ${
        compact ? "min-h-[40vh]" : "min-h-screen"
      } px-4 py-10`}
      aria-live="polite"
      aria-busy="true"
    >
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface px-6 py-8 text-center shadow-sm">
        <div className="flex justify-center">
          <BrandWordmark
            asLink={false}
            className="h-7 w-auto max-w-[220px] object-contain"
          />
        </div>

        <div className="mt-6 flex items-center justify-center gap-3">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-primary/20 bg-primary/8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </span>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-primary [animation-delay:0ms]" />
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-secondary [animation-delay:200ms]" />
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-accent-light [animation-delay:400ms]" />
          </div>
        </div>

        <h2 className="mt-5 text-lg font-semibold text-text-primary">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          {message}
        </p>
      </div>
    </div>
  );
}
