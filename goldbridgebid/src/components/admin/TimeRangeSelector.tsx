"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { TimeRange } from "@/lib/time-range";
export {
  type TimeRange,
  getRangeCutoff,
  getPreviousRangeCutoff,
  getRangeDays,
  isValidRange,
} from "@/lib/time-range";

const RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
];

export default function TimeRangeSelector() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = (searchParams.get("range") as TimeRange) || "7d";

  function handleChange(range: TimeRange) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", range);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-1 rounded-lg border border-border bg-bg-warm p-1">
      {RANGE_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => handleChange(opt.value)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            current === opt.value
              ? "bg-surface text-primary shadow-sm"
              : "text-text-secondary hover:text-text-primary"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
