"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface AdminPaginationProps {
  totalItems: number;
  pageSize?: number;
}

export default function AdminPagination({
  totalItems,
  pageSize = 25,
}: AdminPaginationProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentPage = Number(searchParams.get("page") || "1");
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  function goToPage(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (page <= 1) {
      params.delete("page");
    } else {
      params.set("page", String(page));
    }
    startTransition(() => {
      router.push(`?${params.toString()}`);
    });
  }

  if (totalPages <= 1) return null;

  const pages: (number | "...")[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (
      i === 1 ||
      i === totalPages ||
      (i >= currentPage - 1 && i <= currentPage + 1)
    ) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== "...") {
      pages.push("...");
    }
  }

  return (
    <div
      className={`flex items-center justify-between pt-4 ${isPending ? "opacity-60" : ""}`}
    >
      <p className="text-sm text-text-muted">
        Showing {Math.min((currentPage - 1) * pageSize + 1, totalItems)}–
        {Math.min(currentPage * pageSize, totalItems)} of {totalItems}
      </p>

      <div className="flex items-center gap-1">
        <button
          onClick={() => goToPage(currentPage - 1)}
          disabled={currentPage <= 1}
          className="rounded-lg p-1.5 text-text-muted hover:bg-surface-hover disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {pages.map((p, i) =>
          p === "..." ? (
            <span key={`dots-${i}`} className="px-1 text-text-muted">
              ...
            </span>
          ) : (
            <button
              key={p}
              onClick={() => goToPage(p)}
              className={`min-w-[32px] rounded-lg px-2 py-1 text-sm font-medium ${
                p === currentPage
                  ? "bg-primary text-slate-950"
                  : "text-text-secondary hover:bg-surface-hover"
              }`}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => goToPage(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="rounded-lg p-1.5 text-text-muted hover:bg-surface-hover disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
