"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileUp, PackagePlus, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { createEstimatePackage } from "../actions";
import { ESTIMATE_PACKAGE_FILE_ACCEPT } from "@/lib/file-uploads";
import {
  FORM_TRADES,
  TRADE_LABELS,
  type EstimatePackageType,
} from "@/types/database";

const PACKAGE_TYPE_OPTIONS: Array<{
  value: EstimatePackageType;
  label: string;
  description: string;
}> = [
  {
    value: "material_takeoff",
    label: "Material Takeoff",
    description: "Quantities, materials, and scope assumptions.",
  },
  {
    value: "bid_ready_scope",
    label: "Bid-Ready Scope",
    description: "A scope package contractors can use as a bid starting point.",
  },
  {
    value: "estimate_worksheet",
    label: "Estimate Worksheet",
    description: "Structured estimating logic, notes, and line-item guidance.",
  },
  {
    value: "plan_review",
    label: "Plan Review",
    description: "Constructability notes, missing items, and risk callouts.",
  },
  {
    value: "other",
    label: "Other",
    description: "A specialized estimating package that does not fit above.",
  },
];

export default function NewEstimatePackageForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createEstimatePackage(formData);

      if (result?.error) {
        setError(result.error);
        return;
      }

      router.push("/estimator/packages");
      router.refresh();
    });
  }

  function syncFileInput(nextFiles: File[]) {
    if (!fileInputRef.current) return;

    const dataTransfer = new DataTransfer();
    nextFiles.forEach((file) => dataTransfer.items.add(file));
    fileInputRef.current.files = dataTransfer.files;
  }

  function removeSelectedFile(index: number) {
    setFiles((current) => {
      const nextFiles = current.filter((_, itemIndex) => itemIndex !== index);
      syncFileInput(nextFiles);
      return nextFiles;
    });
  }

  return (
    <form action={handleSubmit} className="space-y-8">
      <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <div className="mb-6 flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <PackagePlus className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-text-primary">
              Package Basics
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-text-secondary">
              Create the marketplace listing and version 1 snapshot. You can
              keep it as a draft until it is ready to publish.
            </p>
          </div>
        </div>

        <div className="grid gap-5">
          <div>
            <label
              htmlFor="title"
              className="mb-1.5 block text-sm font-medium text-text-primary"
            >
              Package title
            </label>
            <input
              id="title"
              name="title"
              type="text"
              required
              placeholder="Example: Kitchen Remodel Material Takeoff"
              className="w-full rounded-lg border border-border bg-bg-warm px-4 py-2.5 text-sm text-text-primary outline-none transition-colors focus:border-primary"
            />
          </div>

          <div>
            <label
              htmlFor="summary"
              className="mb-1.5 block text-sm font-medium text-text-primary"
            >
              Marketplace summary
            </label>
            <textarea
              id="summary"
              name="summary"
              rows={4}
              required
              placeholder="Explain what the buyer gets, what project type this applies to, and what decisions still require local contractor judgment."
              className="w-full rounded-lg border border-border bg-bg-warm px-4 py-2.5 text-sm text-text-primary outline-none transition-colors focus:border-primary"
            />
          </div>

          <div>
            <label
              htmlFor="packageType"
              className="mb-1.5 block text-sm font-medium text-text-primary"
            >
              Package type
            </label>
            <select
              id="packageType"
              name="packageType"
              required
              defaultValue="material_takeoff"
              className="w-full rounded-lg border border-border bg-bg-warm px-4 py-2.5 text-sm text-text-primary outline-none transition-colors focus:border-primary"
            >
              {PACKAGE_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {PACKAGE_TYPE_OPTIONS.map((option) => (
                <p
                  key={option.value}
                  className="rounded-lg border border-border bg-bg-warm/50 px-3 py-2 text-xs text-text-muted"
                >
                  <span className="font-semibold text-text-secondary">
                    {option.label}:
                  </span>{" "}
                  {option.description}
                </p>
              ))}
            </div>
          </div>

          <div>
            <label
              htmlFor="price"
              className="mb-1.5 block text-sm font-medium text-text-primary"
            >
              Price in USD
            </label>
            <input
              id="price"
              name="price"
              type="number"
              min="0"
              step="0.01"
              defaultValue="0"
              className="w-full rounded-lg border border-border bg-bg-warm px-4 py-2.5 text-sm text-text-primary outline-none transition-colors focus:border-primary"
            />
            <p className="mt-1 text-xs text-text-muted">
              Use 0.00 for a free package. Paid purchase flow will be connected
              in a later milestone.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="mb-2 text-lg font-semibold text-text-primary">
          Scope Snapshot
        </h2>
        <p className="mb-5 text-sm leading-relaxed text-text-secondary">
          These details become version 1 of the package. Buyers should always
          know what assumptions and exclusions were attached to the version they
          accessed.
        </p>

        <div className="space-y-5">
          <div>
            <label
              htmlFor="scopeOverview"
              className="mb-1.5 block text-sm font-medium text-text-primary"
            >
              Scope overview
            </label>
            <textarea
              id="scopeOverview"
              name="scopeOverview"
              rows={5}
              placeholder="Describe what is included in this takeoff or estimate package."
              className="w-full rounded-lg border border-border bg-bg-warm px-4 py-2.5 text-sm text-text-primary outline-none transition-colors focus:border-primary"
            />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div>
              <label
                htmlFor="assumptions"
                className="mb-1.5 block text-sm font-medium text-text-primary"
              >
                Assumptions
              </label>
              <textarea
                id="assumptions"
                name="assumptions"
                rows={6}
                placeholder="One assumption per line"
                className="w-full rounded-lg border border-border bg-bg-warm px-4 py-2.5 text-sm text-text-primary outline-none transition-colors focus:border-primary"
              />
            </div>

            <div>
              <label
                htmlFor="exclusions"
                className="mb-1.5 block text-sm font-medium text-text-primary"
              >
                Exclusions
              </label>
              <textarea
                id="exclusions"
                name="exclusions"
                rows={6}
                placeholder="One exclusion per line"
                className="w-full rounded-lg border border-border bg-bg-warm px-4 py-2.5 text-sm text-text-primary outline-none transition-colors focus:border-primary"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <div className="mb-5 flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary/10">
            <FileUp className="h-6 w-6 text-secondary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-text-primary">
              Package Files
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-text-secondary">
              Attach scanned paper estimates, PDFs, spreadsheets, CAD exports,
              scope documents, or images while creating the package. You can
              still add or remove files later while the package is a draft.
            </p>
          </div>
        </div>

        <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-bg-warm px-4 py-8 text-center transition-colors hover:border-primary/60 hover:bg-primary/5">
          <FileUp className="mb-3 h-8 w-8 text-text-muted" />
          <span className="text-sm font-semibold text-text-primary">
            Choose package files
          </span>
          <span className="mt-1 text-xs text-text-muted">
            Images up to 12MB; PDFs, spreadsheets, CSVs, docs, and text files up
            to 50MB
          </span>
          <input
            type="file"
            name="files"
            multiple
            accept={ESTIMATE_PACKAGE_FILE_ACCEPT}
            ref={fileInputRef}
            onChange={(event) => {
              setFiles(Array.from(event.target.files || []));
            }}
            className="hidden"
          />
        </label>

        {files.length > 0 && (
          <div className="mt-4 space-y-2">
            {files.map((file, index) => (
              <div
                key={`${file.name}-${file.size}-${index}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-bg-warm px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-text-primary">
                    {file.name}
                  </p>
                  <p className="text-xs text-text-muted">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeSelectedFile(index)}
                  className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-red-50 hover:text-red-600"
                  aria-label={`Remove ${file.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="mb-2 text-lg font-semibold text-text-primary">Trades</h2>
        <p className="mb-5 text-sm leading-relaxed text-text-secondary">
          Select the trades this package applies to. Leaving all unchecked keeps
          it general.
        </p>
        <div className="grid max-h-80 gap-2 overflow-y-auto rounded-lg border border-border bg-bg-warm p-3 sm:grid-cols-2 lg:grid-cols-3">
          {FORM_TRADES.map((trade) => (
            <label
              key={trade}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-text-secondary transition-colors hover:bg-surface"
            >
              <input
                type="checkbox"
                name="trades"
                value={trade}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
              />
              {TRADE_LABELS[trade]}
            </label>
          ))}
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/estimator/packages"
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-surface px-5 py-2.5 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-hover"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Packages
        </Link>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent-light px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          {isPending ? "Creating..." : "Create Draft Package"}
        </button>
      </div>
    </form>
  );
}

