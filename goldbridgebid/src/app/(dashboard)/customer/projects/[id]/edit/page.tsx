"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Upload,
  X,
  Loader2,
  Info,
  ImageIcon,
  FileText as FileIcon,
  AlertTriangle,
} from "lucide-react";
import { updateProject } from "../../actions";
import { TRADE_LABELS, FORM_TRADES } from "@/types/database";
import type { TradeCategory } from "@/types/database";
import { createBrowserClient } from "@supabase/ssr";
import { compressFiles } from "@/lib/compress-image";
import {
  IMAGE_FILE_ACCEPT,
  PROJECT_DOCUMENT_FILE_ACCEPT,
} from "@/lib/file-uploads";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY",
];

interface ProjectData {
  id: string;
  title: string;
  description: string;
  completion_criteria: string;
  trades: TradeCategory[];
  location_address: string;
  location_city: string;
  location_state: string;
  location_zip: string;
  budget_min: number | null;
  budget_max: number | null;
  desired_start_date: string | null;
  timeline: string | null;
  status: string;
  bid_count: number;
}

export default function EditProjectPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [project, setProject] = useState<ProjectData | null>(null);
  const [selectedTrades, setSelectedTrades] = useState<TradeCategory[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<(string | null)[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    async function fetchProject() {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: roleRows } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const hasCustomerRole = (roleRows || []).some((row) => row.role === "customer");

      if (!hasCustomerRole) {
        router.replace("/customer");
        return;
      }

      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", params.id)
        .eq("customer_id", user.id)
        .single();

      if (error || !data) {
        setError("Project not found or you don't have permission to edit it.");
        setPageLoading(false);
        return;
      }

      setProject(data as ProjectData);
      setSelectedTrades(data.trades as TradeCategory[]);
      setPageLoading(false);
    }

    fetchProject();
  }, [params.id]);

  useEffect(() => {
    const urls: (string | null)[] = newFiles.map((file) =>
      file.type.startsWith("image/") ? URL.createObjectURL(file) : null
    );
    setPreviews(urls);
    return () => {
      urls.forEach((url) => url && URL.revokeObjectURL(url));
    };
  }, [newFiles]);

  function toggleTrade(trade: TradeCategory) {
    setSelectedTrades((prev) =>
      prev.includes(trade)
        ? prev.filter((t) => t !== trade)
        : [...prev, trade]
    );
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      const added = Array.from(e.target.files);
      setNewFiles((prev) => [...prev, ...added]);
    }
    e.target.value = "";
  }

  function removeNewFile(index: number) {
    setNewFiles((prev) => prev.filter((_, i) => i !== index));
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

    setCompressing(true);
    const { files: compressed } = await compressFiles(newFiles);
    setCompressing(false);

    compressed.forEach((file) => formData.append("files", file));

    const result = await updateProject(params.id, formData);
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

  if (pageLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="max-w-3xl py-20 text-center">
        <p className="text-text-muted">{error || "Project not found."}</p>
        <Link
          href="/customer/projects"
          className="mt-4 inline-block text-primary hover:text-primary-dark"
        >
          Back to My Projects
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="mb-8">
        <Link
          href={`/customer/projects/${project.id}`}
          className="mb-4 inline-flex items-center gap-1 text-sm text-text-muted hover:text-text-primary transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Project
        </Link>
        <h1 className="text-2xl font-bold text-text-primary">
          Edit Project ✏️
        </h1>
        <p className="mt-1 text-text-secondary">
          Make changes to your project. All edits will be tracked and existing
          bidders will be notified.
        </p>
      </div>

      {/* Warning banner when project has bids */}
      {project.bid_count > 0 && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-900">
              This project has {project.bid_count}{" "}
              {project.bid_count === 1 ? "bid" : "bids"}
            </p>
            <p className="mt-0.5 text-sm text-amber-800">
              All changes will be logged and highlighted. Existing bidders will
              receive a notification about your edits. Their bids remain
              date-stamped to the original posting.
            </p>
          </div>
        </div>
      )}

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
                defaultValue={project.title}
                className="mt-1.5 block w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
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
                defaultValue={project.description}
                className="mt-1.5 block w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
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
                defaultValue={project.completion_criteria}
                className="mt-2 block w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
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
            Select all trades needed for this project.
          </p>
          <div className="flex flex-wrap gap-2">
            {FORM_TRADES.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => toggleTrade(value)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                  selectedTrades.includes(value)
                    ? "border-primary bg-primary text-slate-950 shadow-sm"
                    : "border-border bg-surface text-text-secondary hover:border-primary/40 hover:text-text-primary"
                }`}
              >
                {TRADE_LABELS[value]}
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
                defaultValue={project.location_address}
                className="mt-1.5 block w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
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
                  defaultValue={project.location_city}
                  className="mt-1.5 block w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
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
                  defaultValue={project.location_state}
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
                  defaultValue={project.location_zip}
                  className="mt-1.5 block w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
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
                  defaultValue={project.desired_start_date ?? ""}
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
                  defaultValue={project.timeline ?? ""}
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
                    defaultValue={project.budget_min ?? ""}
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
                    defaultValue={project.budget_max ?? ""}
                    className="block w-full rounded-lg border border-border bg-surface pl-7 pr-4 py-2.5 text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="15,000"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Add More Files */}
        <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <h2 className="mb-2 text-lg font-semibold text-text-primary">
            📎 Add More Files
          </h2>
          <p className="mb-4 text-sm text-text-muted">
            Upload additional photos, documents, or videos. Existing files will
            remain attached to the project.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <label
              htmlFor="photo-upload"
              className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-amber-300 bg-bg-warm px-4 py-6 transition-colors hover:border-primary hover:bg-amber-50"
            >
              <ImageIcon className="h-8 w-8 text-primary" />
              <p className="mt-2 text-sm font-semibold text-primary">
                Add Photos
              </p>
              <p className="mt-1 text-xs text-text-muted">Up to 12MB each</p>
              <input
                id="photo-upload"
                type="file"
                multiple
                accept={IMAGE_FILE_ACCEPT}
                onChange={handleFileChange}
                className="hidden"
              />
            </label>

            <label
              htmlFor="doc-upload"
              className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border px-4 py-6 transition-colors hover:border-amber-300 hover:bg-bg-warm"
            >
              <FileIcon className="h-8 w-8 text-text-muted" />
              <p className="mt-2 text-sm font-medium text-text-primary">
                Add Documents
              </p>
              <p className="mt-1 text-xs text-text-muted">Up to 300MB each</p>
              <input
                id="doc-upload"
                type="file"
                multiple
                accept={PROJECT_DOCUMENT_FILE_ACCEPT}
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </div>

          {/* New file previews */}
          {newFiles.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-sm font-medium text-text-primary">
                {newFiles.length} new file{newFiles.length !== 1 ? "s" : ""} to
                upload
              </p>
              {newFiles.map((file, i) => (
                <div
                  key={`new-${file.name}-${i}`}
                  className="flex items-center justify-between rounded-lg border border-border bg-bg-warm px-4 py-3"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {file.type.startsWith("image/") ? (
                      <ImageIcon className="h-5 w-5 text-primary shrink-0" />
                    ) : (
                      <FileIcon className="h-5 w-5 text-primary shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-text-primary truncate">
                        {file.name}
                      </p>
                      <p className="text-xs text-text-muted">
                        {formatFileSize(file.size)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeNewFile(i)}
                    className="ml-3 rounded-md p-1.5 text-text-muted hover:bg-red-50 hover:text-red-600 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Submit */}
        <div className="flex items-center justify-between rounded-xl border border-border bg-surface p-6 shadow-sm">
          <p className="text-sm text-text-muted">
            All edits will be tracked and highlighted for bidders.
          </p>
          <div className="flex items-center gap-3">
            <Link
              href={`/customer/projects/${project.id}`}
              className="rounded-lg border border-border px-6 py-3 text-sm font-medium text-text-secondary hover:bg-surface-hover transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 rounded-lg bg-primary px-8 py-3 text-sm font-semibold text-slate-950 shadow-sm hover:bg-primary-dark transition-colors disabled:opacity-60"
            >
              {compressing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Compressing images...
                </>
              ) : loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving Changes...
                </>
              ) : (
                "Save Changes"
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
