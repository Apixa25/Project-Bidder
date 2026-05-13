"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, X, User, FolderOpen, ClipboardList, MessageSquare } from "lucide-react";
import {
  globalAdminSearch,
  type GlobalSearchResult,
} from "@/app/(dashboard)/admin/actions";

const TYPE_ICONS = {
  user: User,
  project: FolderOpen,
  bid: ClipboardList,
  message: MessageSquare,
};

const TYPE_COLORS = {
  user: "bg-blue-100 text-blue-600",
  project: "bg-primary/10 text-primary",
  bid: "bg-secondary/10 text-secondary",
  message: "bg-amber-100 text-amber-700",
};

export default function GlobalSearchModal() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GlobalSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setResults([]);
      setSelectedIdx(0);
    }
  }, [open]);

  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await globalAdminSearch(q.trim());
      setResults(res);
      setSelectedIdx(0);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  function handleChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 300);
  }

  function navigate(result: GlobalSearchResult) {
    setOpen(false);
    router.push(result.href);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && results[selectedIdx]) {
      e.preventDefault();
      navigate(results[selectedIdx]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />
      <div className="relative z-10 w-full max-w-lg rounded-xl border border-border bg-surface shadow-2xl">
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Search className="h-5 w-5 text-text-muted shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search users, projects, bids, messages..."
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none"
          />
          <button
            onClick={() => setOpen(false)}
            className="rounded-md p-1 text-text-muted hover:text-text-primary transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto p-2">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          )}

          {!loading && query.trim().length >= 2 && results.length === 0 && (
            <p className="py-8 text-center text-sm text-text-muted">
              No results for &ldquo;{query}&rdquo;
            </p>
          )}

          {!loading && query.trim().length < 2 && (
            <p className="py-8 text-center text-sm text-text-muted">
              Type at least 2 characters to search
            </p>
          )}

          {!loading &&
            results.map((result, i) => {
              const Icon = TYPE_ICONS[result.type];
              const color = TYPE_COLORS[result.type];
              return (
                <button
                  key={`${result.type}-${result.id}`}
                  onClick={() => navigate(result)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                    i === selectedIdx
                      ? "bg-primary/10"
                      : "hover:bg-surface-hover"
                  }`}
                >
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${color}`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-text-primary">
                      {result.title}
                    </p>
                    <p className="truncate text-xs text-text-muted">
                      {result.subtitle}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-bg-warm px-2 py-0.5 text-[10px] font-medium text-text-muted">
                    {result.type}
                  </span>
                </button>
              );
            })}
        </div>

        {/* Footer hint */}
        <div className="border-t border-border px-4 py-2 text-[11px] text-text-muted">
          <span className="font-medium">↑↓</span> navigate ·{" "}
          <span className="font-medium">↵</span> open ·{" "}
          <span className="font-medium">esc</span> close
        </div>
      </div>
    </div>
  );
}

export function GlobalSearchTrigger() {
  const [, setOpen] = useState(false);

  function handleClick() {
    const event = new KeyboardEvent("keydown", {
      key: "k",
      metaKey: true,
      bubbles: true,
    });
    window.dispatchEvent(event);
    setOpen((prev) => !prev);
  }

  return (
    <button
      onClick={handleClick}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-text-secondary hover:bg-surface-hover transition-colors"
      title="Search (⌘K)"
    >
      <Search className="h-5 w-5 shrink-0" />
      <span className="flex-1 text-left">Search</span>
      <kbd className="hidden rounded border border-border bg-bg-warm px-1.5 py-0.5 text-[10px] font-medium text-text-muted sm:inline-block">
        ⌘K
      </kbd>
    </button>
  );
}
