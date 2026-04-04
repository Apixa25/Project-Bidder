"use client";

import { Download } from "lucide-react";

interface ExportButtonProps {
  data: Record<string, unknown>[];
  filename: string;
  columns: { key: string; label: string }[];
}

export default function ExportButton({
  data,
  filename,
  columns,
}: ExportButtonProps) {
  function handleExport() {
    const header = columns.map((c) => c.label).join(",");
    const rows = data.map((row) =>
      columns
        .map((c) => {
          const val = row[c.key];
          const str = val === null || val === undefined ? "" : String(val);
          return `"${str.replace(/"/g, '""')}"`;
        })
        .join(",")
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      className="inline-flex items-center gap-2 rounded-lg border border-white/25 bg-surface px-4 py-2.5 text-sm font-semibold text-accent-light shadow-md transition-colors hover:bg-surface-hover hover:border-white/40"
    >
      <Download className="h-4 w-4 shrink-0" />
      Export CSV
    </button>
  );
}
