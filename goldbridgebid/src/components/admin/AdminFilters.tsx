"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

export interface FilterOption {
  value: string;
  label: string;
}

interface FilterDropdownProps {
  paramName: string;
  label: string;
  options: FilterOption[];
  includeAll?: boolean;
  resetParams?: string[];
}

export function FilterDropdown({
  paramName,
  label,
  options,
  includeAll = true,
  resetParams = [],
}: FilterDropdownProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const current = searchParams.get(paramName) || "";

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(paramName, value);
    } else {
      params.delete(paramName);
    }

    for (const resetParam of resetParams) {
      params.delete(resetParam);
    }

    params.delete("page");
    startTransition(() => {
      router.push(`?${params.toString()}`);
    });
  }

  return (
    <div className="flex w-full flex-col gap-1.5 sm:w-auto sm:flex-row sm:items-center sm:gap-2">
      <label className="text-xs font-medium text-text-muted whitespace-nowrap">
        {label}
      </label>
      <select
        value={current}
        onChange={(e) => handleChange(e.target.value)}
        className={`w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:w-auto sm:py-1.5 ${isPending ? "opacity-60" : ""}`}
      >
        {includeAll && <option value="">All</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

interface AdminFilterBarProps {
  children: React.ReactNode;
}

export default function AdminFilterBar({ children }: AdminFilterBarProps) {
  return (
    <div className="grid gap-3 sm:flex sm:flex-wrap sm:items-center sm:gap-4">
      {children}
    </div>
  );
}
