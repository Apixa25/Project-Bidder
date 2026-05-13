"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

export type TimeRange = "today" | "7d" | "30d" | "90d";

const RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
];

export function getRangeCutoff(range: TimeRange): string {
  const ms: Record<TimeRange, number> = {
    today: 24 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
    "30d": 30 * 24 * 60 * 60 * 1000,
    "90d": 90 * 24 * 60 * 60 * 1000,
  };
  return new Date(Date.now() - ms[range]).toISOString();
}

export function getPreviousRangeCutoff(range: TimeRange): string {
  const ms: Record<TimeRange, number> = {
    today: 24 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
    "30d": 30 * 24 * 60 * 60 * 1000,
    "90d": 90 * 24 * 60 * 60 * 1000,
  };
  return new Date(Date.now() - 2 * ms[range]).toISOString();
}

export function getRangeDays(range: TimeRange): number {
  const days: Record<TimeRange, number> = {
    today: 1,
    "7d": 7,
    "30d": 30,
    "90d": 90,
  };
  return days[range];
}

export function isValidRange(value: string | undefined): value is TimeRange {
  return !!value && ["today", "7d", "30d", "90d"].includes(value);
}

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
