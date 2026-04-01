"use client";

import { CheckCircle2, ExternalLink, XCircle } from "lucide-react";

interface CredentialChecklistItem {
  label: string;
  url: string | null | undefined;
}

interface CredentialChecklistProps {
  items: CredentialChecklistItem[];
}

export default function CredentialChecklist({
  items,
}: CredentialChecklistProps) {
  return (
    <div className="space-y-2">
      {items.map((item) => {
        const hasFile = !!item.url;

        return (
          <div
            key={item.label}
            className="flex items-center justify-between gap-3 rounded-lg border border-border bg-bg-warm px-3 py-2"
          >
            <div
              className={`flex min-w-0 items-center gap-2 text-sm ${
                hasFile ? "text-green-700" : "text-gray-400"
              }`}
            >
              {hasFile ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 shrink-0" />
              )}
              <span className="truncate">{item.label}</span>
            </div>

            {hasFile ? (
              <a
                href={item.url!}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-white px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-surface-hover"
              >
                <ExternalLink className="h-3 w-3" />
                Open
              </a>
            ) : (
              <span className="shrink-0 text-xs text-text-muted">Missing</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
