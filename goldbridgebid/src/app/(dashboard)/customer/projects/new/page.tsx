"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Upload, X, Loader2, Info } from "lucide-react";
import { createProject } from "../actions";
import { TRADE_LABELS } from "@/types/database";
import type { TradeCategory } from "@/types/database";

const TRADE_OPTIONS = Object.entries(TRADE_LABELS) as [TradeCategory, string][];

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY",
];

export default function NewProjectPage() {
  const [selectedTrades, setSelectedTrades] = useState<TradeCategory[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function toggleTrade(trade: TradeCategory) {
    setSelectedTrades((prev) =>
      prev.includes(trade)
        ? prev.filter((t) => t !== trade)
        : [...prev, trade]
    );
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setFiles((prev) => [...prev, ...newFiles]);
    }
    e.target.value = "";
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);

    if (selectedTrades.length === 0) {
      setError("Please select at least one trade category.");
      setLoading(false);
      return;
    }

    selectedTrades.forEach((trade) => formData.append("trades", trade));
    files.forEach((file) => formData.append("files", file));

    const result = await createProject(formData);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  function formatFileSize(bytes: number) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(1) + " MB";
  }

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/customer"
          className="mb-4 inline-flex items-center gap-1 text-sm text-text-muted hover:text-text-primary transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-text-primary">
          Post a New Project 🏗️
        </h1>
        <p className="mt-1 text-text-secondary">
          Describe your project in detail so contractors can give you accurate
          bids.
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form action={handleSubmit} className="space-y-8">
        {/* Project Basics */}
        <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <h2 className="mb-5 text-lg font-semibold text-text-primary">
            Project Details
          </h2>

          <div className="space-y-5">
            <div>
              <label
                htmlFor="title"
                className="block text-sm font-medium text-text-primary"
              >
                Project Title <span className="text-red-500">*</span>
              </label>
              <input
                id="title"
                name="title"
                type="text"
                required
                className="mt-1.5 block w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="e.g., Kitchen Remodel — Full Renovation"
              />
            </div>

            <div>
              <label
                htmlFor="description"
                className="block text-sm font-medium text-text-primary"
              >
                Project Description <span className="text-red-500">*</span>
              </label>
              <textarea
                id="description"
                name="description"
                required
                rows={6}
                className="mt-1.5 block w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="Describe the full scope of work. Include as much detail as possible — materials, dimensions, special requirements, access considerations, etc."
              />
            </div>

            <div>
              <label
                htmlFor="completionCriteria"
                className="block text-sm font-medium text-text-primary"
              >
                Completion Criteria <span className="text-red-500">*</span>
              </label>
              <div className="mt-1 flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                <Info className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  This is mandatory. Define exactly what &ldquo;done&rdquo;
                  means for this project so there&apos;s no ambiguity.
                </span>
              </div>
              <textarea
                id="completionCriteria"
                name="completionCriteria"
                required
                rows={4}
                className="mt-2 block w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="e.g., Project is complete when all wiring is tested and passes inspection, all fixtures are installed and functional, drywall is patched and painted, and a final walkthrough is signed off."
              />
            </div>
          </div>
        </section>

        {/* Trade Categories */}
        <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <h2 className="mb-2 text-lg font-semibold text-text-primary">
            Trades Required <span className="text-red-500">*</span>
          </h2>
          <p className="mb-4 text-sm text-text-muted">
            Select all trades needed for this project. Contractors will bid on
            their specific trade.
          </p>
          <div className="flex flex-wrap gap-2.5">
            {TRADE_OPTIONS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => toggleTrade(value)}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition-all ${
                  selectedTrades.includes(value)
                    ? "border-primary bg-primary text-white shadow-sm"
                    : "border-border bg-surface text-text-secondary hover:border-primary/40 hover:text-text-primary"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {selectedTrades.length > 0 && (
            <p className="mt-3 text-sm text-secondary font-medium">
              {selectedTrades.length} trade
              {selectedTrades.length !== 1 ? "s" : ""} selected
            </p>
          )}
        </section>

        {/* Location */}
        <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <h2 className="mb-5 text-lg font-semibold text-text-primary">
            Project Location <span className="text-red-500">*</span>
          </h2>

          <div className="space-y-5">
            <div>
              <label
                htmlFor="locationAddress"
                className="block text-sm font-medium text-text-primary"
              >
                Street Address
              </label>
              <input
                id="locationAddress"
                name="locationAddress"
                type="text"
                required
                className="mt-1.5 block w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="123 Main Street"
              />
            </div>

            <div className="grid grid-cols-6 gap-4">
              <div className="col-span-3">
                <label
                  htmlFor="locationCity"
                  className="block text-sm font-medium text-text-primary"
                >
                  City
                </label>
                <input
                  id="locationCity"
                  name="locationCity"
                  type="text"
                  required
                  className="mt-1.5 block w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="Crescent City"
                />
              </div>
              <div className="col-span-1">
                <label
                  htmlFor="locationState"
                  className="block text-sm font-medium text-text-primary"
                >
                  State
                </label>
                <select
                  id="locationState"
                  name="locationState"
                  required
                  defaultValue="CA"
                  className="mt-1.5 block w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-text-primary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  {US_STATES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label
                  htmlFor="locationZip"
                  className="block text-sm font-medium text-text-primary"
                >
                  ZIP Code
                </label>
                <input
                  id="locationZip"
                  name="locationZip"
                  type="text"
                  required
                  className="mt-1.5 block w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="95531"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Timeline & Budget */}
        <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <h2 className="mb-5 text-lg font-semibold text-text-primary">
            Timeline & Budget
          </h2>

          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="desiredStartDate"
                  className="block text-sm font-medium text-text-primary"
                >
                  Desired Start Date
                </label>
                <input
                  id="desiredStartDate"
                  name="desiredStartDate"
                  type="date"
                  className="mt-1.5 block w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-text-primary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label
                  htmlFor="timeline"
                  className="block text-sm font-medium text-text-primary"
                >
                  Expected Duration
                </label>
                <input
                  id="timeline"
                  name="timeline"
                  type="text"
                  className="mt-1.5 block w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="e.g., 2–3 weeks"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="budgetMin"
                  className="block text-sm font-medium text-text-primary"
                >
                  Budget Min{" "}
                  <span className="text-text-muted">(optional)</span>
                </label>
                <div className="relative mt-1.5">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">
                    $
                  </span>
                  <input
                    id="budgetMin"
                    name="budgetMin"
                    type="number"
                    min="0"
                    step="0.01"
                    className="block w-full rounded-lg border border-border bg-surface pl-7 pr-4 py-2.5 text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="5,000"
                  />
                </div>
              </div>
              <div>
                <label
                  htmlFor="budgetMax"
                  className="block text-sm font-medium text-text-primary"
                >
                  Budget Max{" "}
                  <span className="text-text-muted">(optional)</span>
                </label>
                <div className="relative mt-1.5">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">
                    $
                  </span>
                  <input
                    id="budgetMax"
                    name="budgetMax"
                    type="number"
                    min="0"
                    step="0.01"
                    className="block w-full rounded-lg border border-border bg-surface pl-7 pr-4 py-2.5 text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="15,000"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* File Uploads */}
        <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <h2 className="mb-2 text-lg font-semibold text-text-primary">
            Project Files
          </h2>
          <p className="mb-4 text-sm text-text-muted">
            Upload photos, documents, plans, or videos to help contractors
            understand the scope.
          </p>

          <label
            htmlFor="file-upload"
            className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border px-6 py-8 transition-colors hover:border-primary/40 hover:bg-primary/5"
          >
            <Upload className="h-8 w-8 text-text-muted" />
            <p className="mt-2 text-sm font-medium text-text-primary">
              Click to upload files
            </p>
            <p className="mt-1 text-xs text-text-muted">
              Photos, PDFs, documents, videos — up to 50MB each
            </p>
            <input
              id="file-upload"
              type="file"
              multiple
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,video/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>

          {files.length > 0 && (
            <div className="mt-4 space-y-2">
              {files.map((file, i) => (
                <div
                  key={`${file.name}-${i}`}
                  className="flex items-center justify-between rounded-lg border border-border bg-bg-warm px-4 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text-primary truncate">
                      {file.name}
                    </p>
                    <p className="text-xs text-text-muted">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    className="ml-3 rounded-md p-1 text-text-muted hover:bg-red-50 hover:text-red-600 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <p className="text-sm text-text-muted">
                {files.length} file{files.length !== 1 ? "s" : ""} selected
              </p>
            </div>
          )}
        </section>

        {/* Submit */}
        <div className="flex items-center justify-between rounded-xl border border-border bg-surface p-6 shadow-sm">
          <p className="text-sm text-text-muted">
            Your project will be visible to all bidders immediately.
          </p>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-primary px-8 py-3 text-sm font-semibold text-white shadow-sm hover:bg-primary-dark transition-colors disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Posting Project...
              </>
            ) : (
              "Post Project"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
