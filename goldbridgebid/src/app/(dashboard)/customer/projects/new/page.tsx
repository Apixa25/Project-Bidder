"use client";

import Image from "next/image";
import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  X,
  Loader2,
  Info,
  ImageIcon,
  Video,
  FileText as FileIcon,
  BadgeDollarSign,
  CreditCard,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { analyzeProjectDraft, createProject, getCostEstimates } from "../actions";
import { TRADE_LABELS, FORM_TRADES } from "@/types/database";
import type { TradeCategory } from "@/types/database";
import { compressFiles } from "@/lib/compress-image";
import { createBrowserClient } from "@supabase/ssr";
import {
  IMAGE_FILE_ACCEPT,
  PROJECT_VIDEO_FILE_ACCEPT,
  PROJECT_DOCUMENT_FILE_ACCEPT,
} from "@/lib/file-uploads";
import { PAID_ESTIMATE_FILTER_LABELS } from "@/lib/paid-estimates/eligibility";
import AiEstimateSummary from "@/components/ai/AiEstimateSummary";
import type {
  ProjectAiAnalysisResult,
  ProjectAiRecommendedQuestion,
} from "@/lib/ai-estimates";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY",
];

function hasDraftClarificationAnswer(value: string | string[]) {
  return Array.isArray(value) ? value.length > 0 : value.trim().length > 0;
}

function getDraftClarificationValue(
  question: ProjectAiRecommendedQuestion,
  answers: Record<string, string[]>
) {
  const values = answers[question.question_key] || [];

  if (question.question_type === "multi_select") {
    return values.filter(Boolean);
  }

  return values[0] || "";
}

export default function NewProjectPage() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement | null>(null);
  const [selectedTrades, setSelectedTrades] = useState<TradeCategory[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [accessReady, setAccessReady] = useState(false);
  const [enablePaidEstimate, setEnablePaidEstimate] = useState(false);
  const [rewardAmount, setRewardAmount] = useState("100");
  const [maxPaidSlots, setMaxPaidSlots] = useState("3");
  const [paidEstimateFilter, setPaidEstimateFilter] = useState<
    "open_to_anyone" | "core_verified_only"
  >("open_to_anyone");
  const [costEstimates, setCostEstimates] = useState<
    Array<{ trade: string; label: string; avg: number; min: number; max: number; count: number }>
  >([]);
  const [aiAnalysis, setAiAnalysis] = useState<ProjectAiAnalysisResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [draftClarificationAnswers, setDraftClarificationAnswers] = useState<
    Record<string, string[]>
  >({});

  useEffect(() => {
    getCostEstimates().then((data) => setCostEstimates(data));
  }, []);

  const matchedEstimates = costEstimates.filter((est) =>
    selectedTrades.includes(est.trade as TradeCategory)
  );

  const previews = useMemo(
    () =>
      files.map((file) =>
        file.type.startsWith("image/") ? URL.createObjectURL(file) : null
      ),
    [files]
  );
  const paidEstimateReward = Number.parseFloat(rewardAmount);
  const paidEstimateSlots = Number.parseInt(maxPaidSlots, 10);
  const estimatedFundingTotal =
    Number.isFinite(paidEstimateReward) &&
    Number.isInteger(paidEstimateSlots) &&
    paidEstimateReward > 0 &&
    paidEstimateSlots > 0
      ? paidEstimateReward * paidEstimateSlots
      : 0;

  useEffect(() => {
    async function checkAccess() {
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

      setAccessReady(true);
    }

    checkAccess();
  }, [router]);

  useEffect(
    () => () => {
      previews.forEach((url) => url && URL.revokeObjectURL(url));
    },
    [previews]
  );

  const draftClarificationPayload = useMemo(() => {
    if (!aiAnalysis) {
      return [];
    }

    return aiAnalysis.recommended_questions.map((question, index) => {
      const answerValue = getDraftClarificationValue(
        question,
        draftClarificationAnswers
      );

      return {
        question_key: question.question_key,
        question_text: question.question_text,
        question_type: question.question_type,
        help_text: question.help_text,
        placeholder: question.placeholder,
        options: question.options,
        answer_value_json: answerValue,
        status: hasDraftClarificationAnswer(answerValue) ? "answered" : "pending",
        display_order: index,
      };
    });
  }, [aiAnalysis, draftClarificationAnswers]);

  const serializedDraftClarifications = useMemo(
    () => JSON.stringify(draftClarificationPayload),
    [draftClarificationPayload]
  );

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

  function setDraftSingleValue(questionKey: string, value: string) {
    setDraftClarificationAnswers((prev) => ({
      ...prev,
      [questionKey]: [value],
    }));
  }

  function toggleDraftMultiValue(questionKey: string, optionId: string) {
    setDraftClarificationAnswers((prev) => {
      const existing = prev[questionKey] || [];
      const nextValues = existing.includes(optionId)
        ? existing.filter((value) => value !== optionId)
        : [...existing, optionId];

      return {
        ...prev,
        [questionKey]: nextValues,
      };
    });
  }

  async function handleAiScopeCheck() {
    if (!formRef.current) {
      return;
    }

    const formData = new FormData(formRef.current);
    setAiLoading(true);
    setAiError(null);

    const result = await analyzeProjectDraft({
      title: (formData.get("title") as string) || "",
      description: (formData.get("description") as string) || "",
      completionCriteria: (formData.get("completionCriteria") as string) || "",
      trades: selectedTrades,
      locationAddress: (formData.get("locationAddress") as string) || "",
      locationCity: (formData.get("locationCity") as string) || "",
      locationState: (formData.get("locationState") as string) || "",
      locationZip: (formData.get("locationZip") as string) || "",
      budgetMin: formData.get("budgetMin")
        ? Number(formData.get("budgetMin"))
        : null,
      budgetMax: formData.get("budgetMax")
        ? Number(formData.get("budgetMax"))
        : null,
      desiredStartDate: (formData.get("desiredStartDate") as string) || "",
      timeline: (formData.get("timeline") as string) || "",
      files: files.map((file) => ({
        file_name: file.name,
        file_type: file.type,
      })),
      clarificationAnswers: draftClarificationPayload.map((clarification) => ({
        question_key: clarification.question_key,
        answer_value_json: clarification.answer_value_json,
        status: clarification.status as "pending" | "answered",
      })),
    });

    if (result.error) {
      setAiError(result.error);
      setAiLoading(false);
      return;
    }

    if (!result.analysis) {
      setAiError("AI Scope Check did not return an analysis.");
      setAiLoading(false);
      return;
    }

    setAiAnalysis(result.analysis);
    setDraftClarificationAnswers((prev) => {
      const nextState = { ...prev };

      for (const question of result.analysis.recommended_questions) {
        if (!nextState[question.question_key]) {
          nextState[question.question_key] = [];
        }
      }

      return nextState;
    });
    setAiLoading(false);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    setLoading(true);
    setError(null);

    if (selectedTrades.length === 0) {
      setError("Please select at least one trade category.");
      setLoading(false);
      return;
    }

    selectedTrades.forEach((trade) => formData.append("trades", trade));

    setCompressing(true);
    const { files: compressed } = await compressFiles(files);
    setCompressing(false);

    compressed.forEach((file) => formData.append("files", file));

    formData.set("enablePaidEstimate", enablePaidEstimate ? "true" : "false");
    if (enablePaidEstimate) {
      formData.set("filter", paidEstimateFilter);
    }

    const result = await createProject(formData);
    if (result?.redirectUrl) {
      window.location.assign(result.redirectUrl);
      return;
    }

    if (result?.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    setLoading(false);
  }

  function formatFileSize(bytes: number) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(1) + " MB";
  }

  if (!accessReady) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
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

      <section className="mb-6 rounded-xl border border-border bg-surface p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">
              Project Type
            </p>
            <h2 className="mt-2 text-lg font-semibold text-text-primary">
              Choose how you want contractors to respond
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              Start with a normal free project, or launch with a funded paid
              estimate offer immediately.
            </p>
          </div>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              enablePaidEstimate
                ? "bg-primary/15 text-primary"
                : "bg-gray-100 text-gray-700"
            }`}
          >
            {enablePaidEstimate ? "Paid estimate project" : "Free project"}
          </span>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <button
            type="button"
            onClick={() => setEnablePaidEstimate(false)}
            className={`rounded-xl border px-4 py-4 text-left transition-colors ${
              !enablePaidEstimate
                ? "border-secondary bg-secondary/10 shadow-sm"
                : "border-border bg-bg-warm hover:border-secondary/40"
            }`}
          >
            <p className="text-sm font-semibold text-text-primary">
              Free project
            </p>
            <p className="mt-1 text-xs leading-relaxed text-text-muted">
              Post normally and let contractors submit unpaid bids right away.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setEnablePaidEstimate(true)}
            className={`rounded-xl border px-4 py-4 text-left transition-colors ${
              enablePaidEstimate
                ? "border-primary bg-amber-50 shadow-sm"
                : "border-border bg-bg-warm hover:border-primary/40"
            }`}
          >
            <p className="text-sm font-semibold text-text-primary">
              Paid estimate project
            </p>
            <p className="mt-1 text-xs leading-relaxed text-text-muted">
              Post the project first, then continue to Stripe so you can fund
              paid estimate slots.
            </p>
          </button>
        </div>
      </section>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form ref={formRef} onSubmit={handleSubmit} className="space-y-8">
        <input
          type="hidden"
          name="draftAiClarifications"
          value={serializedDraftClarifications}
        />
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

            {matchedEstimates.length > 0 && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
                <p className="text-sm font-semibold text-text-primary mb-2">
                  💰 Bid Insights for Your Selected Trades
                </p>
                <div className="space-y-1.5">
                  {matchedEstimates.map((est) => (
                    <div
                      key={est.trade}
                      className="flex flex-wrap items-center gap-2 text-sm text-text-secondary"
                    >
                      <span className="font-medium text-text-primary">
                        {est.label}:
                      </span>
                      <span>
                        ${est.min.toLocaleString()} – ${est.max.toLocaleString()}
                      </span>
                      <span className="text-text-muted">
                        (avg ${est.avg.toLocaleString()} from {est.count} bids)
                      </span>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-xs text-text-muted">
                  Based on bids received across the platform. Your project may vary.
                </p>
              </div>
            )}

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

        <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold text-text-primary">
                  AI Scope Check
                </h2>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                This supports the project vision by helping customers define a
                clearer scope before bidding starts. Run it any time while filling
                out the form to see missing details, estimate readiness, and a
                planning baseline range.
              </p>
            </div>

            <button
              type="button"
              onClick={handleAiScopeCheck}
              disabled={aiLoading}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-primary-dark disabled:opacity-60"
            >
              {aiLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Running AI Scope Check...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Run AI Scope Check
                </>
              )}
            </button>
          </div>

          {aiError && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {aiError}
            </div>
          )}

          {aiAnalysis ? (
            <div className="mt-5">
              <AiEstimateSummary
                status={aiAnalysis.status}
                score={aiAnalysis.scope_completeness_score}
                confidence={aiAnalysis.confidence_level}
                summary={aiAnalysis.summary}
                baselineLow={aiAnalysis.baseline_low}
                baselineHigh={aiAnalysis.baseline_high}
                assumptions={aiAnalysis.assumptions}
                exclusions={aiAnalysis.exclusions}
                missingItems={aiAnalysis.missing_items}
                questions={[]}
                tradeBreakdown={aiAnalysis.trade_breakdown}
              />
              {aiAnalysis.recommended_questions.length > 0 && (
                <div className="mt-5 rounded-xl border border-border bg-bg-warm px-5 py-4">
                  <h3 className="text-sm font-semibold text-text-primary">
                    Clarification workflow
                  </h3>
                  <p className="mt-1 text-sm text-text-secondary">
                    Answer these now to strengthen the scope before you post.
                    These draft clarification answers will carry into the project
                    after posting so the AI baseline starts from the improved
                    version of the scope.
                  </p>

                  <div className="mt-4 space-y-4">
                    {aiAnalysis.recommended_questions.map((question) => (
                      <div
                        key={question.question_key}
                        className="rounded-lg border border-border bg-surface px-4 py-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-text-primary">
                              {question.question_text}
                            </p>
                            {question.help_text && (
                              <p className="mt-1 text-xs leading-relaxed text-text-muted">
                                {question.help_text}
                              </p>
                            )}
                          </div>
                          <span className="rounded-full bg-bg-warm px-2.5 py-1 text-xs font-medium text-text-secondary">
                            {question.question_type === "upload_request"
                              ? "Upload needed"
                              : hasDraftClarificationAnswer(
                                    getDraftClarificationValue(
                                      question,
                                      draftClarificationAnswers
                                    )
                                  )
                                ? "Answered"
                                : "Action needed"}
                          </span>
                        </div>

                        <div className="mt-3">
                          {question.question_type === "text" && (
                            <textarea
                              value={
                                draftClarificationAnswers[question.question_key]?.[0] ||
                                ""
                              }
                              onChange={(event) =>
                                setDraftSingleValue(
                                  question.question_key,
                                  event.target.value
                                )
                              }
                              rows={3}
                              placeholder={question.placeholder || ""}
                              className="block w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                            />
                          )}

                          {question.question_type === "number" && (
                            <input
                              type="number"
                              value={
                                draftClarificationAnswers[question.question_key]?.[0] ||
                                ""
                              }
                              onChange={(event) =>
                                setDraftSingleValue(
                                  question.question_key,
                                  event.target.value
                                )
                              }
                              placeholder={question.placeholder || ""}
                              className="block w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                            />
                          )}

                          {question.question_type === "single_select" && (
                            <select
                              value={
                                draftClarificationAnswers[question.question_key]?.[0] ||
                                ""
                              }
                              onChange={(event) =>
                                setDraftSingleValue(
                                  question.question_key,
                                  event.target.value
                                )
                              }
                              className="block w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                            >
                              <option value="">Select an answer</option>
                              {question.options.map((option) => (
                                <option
                                  key={option.id || option.label}
                                  value={option.id || option.label || ""}
                                >
                                  {option.label || option.id}
                                </option>
                              ))}
                            </select>
                          )}

                          {question.question_type === "multi_select" && (
                            <div className="space-y-2">
                              {question.options.map((option) => {
                                const optionValue = option.id || option.label || "";
                                const isChecked =
                                  draftClarificationAnswers[
                                    question.question_key
                                  ]?.includes(optionValue) || false;

                                return (
                                  <label
                                    key={optionValue}
                                    className="flex items-center gap-2 text-sm text-text-secondary"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() =>
                                        toggleDraftMultiValue(
                                          question.question_key,
                                          optionValue
                                        )
                                      }
                                    />
                                    <span>{option.label || option.id}</span>
                                  </label>
                                );
                              })}
                            </div>
                          )}

                          {question.question_type === "upload_request" && (
                            <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 px-4 py-3 text-sm text-text-secondary">
                              Add the requested photos, video, or documents in the
                              upload sections on this page, then run the AI scope
                              check again.
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-4">
                    <p className="text-sm text-text-secondary">
                      Re-run the assistant after answering questions so it can
                      update the score, baseline, and remaining missing
                      information before you post.
                    </p>
                    <button
                      type="button"
                      onClick={handleAiScopeCheck}
                      disabled={aiLoading}
                      className="inline-flex items-center gap-2 rounded-lg bg-secondary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-secondary-dark disabled:opacity-60"
                    >
                      {aiLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Updating AI Scope Check...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" />
                          Apply Answers and Re-run AI Scope Check
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
              <p className="mt-4 text-xs leading-relaxed text-text-muted">
                The AI estimate is a planning baseline, not a contractor quote.
                Draft clarification answers entered here will be included when
                you post the project, and you can continue refining the AI
                workflow from the project detail page afterward.
              </p>
            </div>
          ) : (
            <div className="mt-5 rounded-lg border border-border bg-bg-warm px-4 py-4 text-sm text-text-secondary">
              No AI analysis yet. Fill in the main project details, then run the
              scope check to see what information is still missing.
            </div>
          )}
        </section>

        <section className="rounded-xl border border-border bg-surface p-6 shadow-sm ring-1 ring-amber-200">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <BadgeDollarSign className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold text-text-primary">
                  Paid Estimates
                </h2>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                Optional: launch this project with a funded paid estimate offer
                right away, or leave it off now and convert the project later
                from the project detail page.
              </p>
            </div>
          </div>

          {enablePaidEstimate ? (
            <div className="mt-5 space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label
                    htmlFor="rewardAmount"
                    className="block text-sm font-medium text-text-primary"
                  >
                    Reward per estimate
                  </label>
                  <input
                    id="rewardAmount"
                    name="rewardAmount"
                    type="number"
                    min="1"
                    step="0.01"
                    value={rewardAmount}
                    onChange={(event) => setRewardAmount(event.target.value)}
                    required={enablePaidEstimate}
                    className="mt-1.5 block w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-text-primary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label
                    htmlFor="maxPaidSlots"
                    className="block text-sm font-medium text-text-primary"
                  >
                    Number of paid slots
                  </label>
                  <input
                    id="maxPaidSlots"
                    name="maxPaidSlots"
                    type="number"
                    min="1"
                    step="1"
                    value={maxPaidSlots}
                    onChange={(event) => setMaxPaidSlots(event.target.value)}
                    required={enablePaidEstimate}
                    className="mt-1.5 block w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-text-primary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label
                    htmlFor="filter"
                    className="block text-sm font-medium text-text-primary"
                  >
                    Paid eligibility filter
                  </label>
                  <select
                    id="filter"
                    name="filter"
                    value={paidEstimateFilter}
                    onChange={(event) =>
                      setPaidEstimateFilter(
                        event.target.value as
                          | "open_to_anyone"
                          | "core_verified_only"
                      )
                    }
                    className="mt-1.5 block w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-text-primary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="open_to_anyone">
                      {PAID_ESTIMATE_FILTER_LABELS.open_to_anyone}
                    </option>
                    <option value="core_verified_only">
                      {PAID_ESTIMATE_FILTER_LABELS.core_verified_only}
                    </option>
                  </select>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-bg-warm px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                  Estimated Funding Summary
                </p>
                <p className="mt-2 text-lg font-bold text-text-primary">
                  ${estimatedFundingTotal.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
                <p className="mt-1 text-sm text-text-secondary">
                  ${Number.isFinite(paidEstimateReward) ? paidEstimateReward.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }) : "0.00"} per estimate x{" "}
                  {Number.isInteger(paidEstimateSlots) && paidEstimateSlots > 0
                    ? paidEstimateSlots
                    : 0}{" "}
                  paid slot
                  {paidEstimateSlots === 1 ? "" : "s"}.
                </p>
              </div>

              <div className="rounded-lg border border-border bg-surface px-4 py-4 text-sm text-text-secondary">
                <div className="flex items-start gap-2">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
                  <p>
                    The project is still posted normally first. The public{" "}
                    <span className="font-semibold text-text-primary">
                      Paid Estimate
                    </span>{" "}
                    badge appears only after Stripe funding succeeds.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-lg border border-border bg-surface px-4 py-4 text-sm text-text-secondary">
              <p>
                This will post as a normal free project. You can still turn on a
                funded paid estimate offer later from the project detail page if
                you want to attract more serious bidders.
              </p>
            </div>
          )}
        </section>

        {/* Photos & Images */}
        <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <h2 className="mb-2 text-lg font-semibold text-text-primary">
            📸 Project Photos
          </h2>
          <p className="mb-4 text-sm text-text-muted">
            Upload photos of the project site, specific areas of concern, pipe
            locations, existing conditions — anything that helps contractors
            understand what they&apos;re bidding on.
          </p>

          <label
            htmlFor="photo-upload"
            className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-amber-300 bg-bg-warm px-6 py-8 transition-colors hover:border-primary hover:bg-amber-50"
          >
            <ImageIcon className="h-10 w-10 text-primary" />
            <p className="mt-3 text-sm font-semibold text-primary">
              Click to add photos
            </p>
            <p className="mt-1 text-xs text-text-muted">
              JPG, PNG, GIF, WEBP — up to 12MB each
            </p>
            <input
              id="photo-upload"
              type="file"
              multiple
              accept={IMAGE_FILE_ACCEPT}
              onChange={handleFileChange}
              className="hidden"
            />
          </label>

          {/* Image Previews Grid */}
          {files.some((f) => f.type.startsWith("image/")) && (
            <div className="mt-4">
              <p className="mb-2 text-sm font-medium text-text-primary">
                {files.filter((f) => f.type.startsWith("image/")).length}{" "}
                photo
                {files.filter((f) => f.type.startsWith("image/")).length !== 1
                  ? "s"
                  : ""}{" "}
                added
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {files.map((file, i) =>
                  file.type.startsWith("image/") && previews[i] ? (
                    <div
                      key={`img-${file.name}-${i}`}
                      className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-gray-100"
                    >
                      <Image
                        src={previews[i]!}
                        alt={file.name}
                        fill
                        unoptimized
                        className="h-full w-full object-cover"
                      />
                      <div className="absolute inset-0 flex flex-col justify-between bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => removeFile(i)}
                          className="self-end m-2 rounded-full bg-red-500 p-1.5 text-white shadow-lg hover:bg-red-600 transition-colors"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                        <div className="px-2 pb-2">
                          <p className="text-xs text-white truncate font-medium">
                            {file.name}
                          </p>
                          <p className="text-xs text-white/70">
                            {formatFileSize(file.size)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : null
                )}
              </div>
            </div>
          )}
        </section>

        {/* Project Videos */}
        <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <h2 className="mb-2 text-lg font-semibold text-text-primary">
            🎥 Project Videos
          </h2>
          <p className="mb-4 text-sm text-text-muted">
            Add short walkthrough videos when motion or site context will help
            contractors understand the work more clearly.
          </p>

          <label
            htmlFor="video-upload"
            className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border px-6 py-6 transition-colors hover:border-primary/40 hover:bg-bg-warm"
          >
            <Video className="h-8 w-8 text-primary" />
            <p className="mt-2 text-sm font-medium text-text-primary">
              Click to upload project videos
            </p>
            <p className="mt-1 text-xs text-text-muted">
              MP4, MOV, WEBM, M4V — up to 75MB each, max 2 videos per project
            </p>
            <input
              id="video-upload"
              type="file"
              multiple
              accept={PROJECT_VIDEO_FILE_ACCEPT}
              onChange={handleFileChange}
              className="hidden"
            />
          </label>

          {files.some((f) => f.type.startsWith("video/")) && (
            <div className="mt-4 space-y-2">
              {files.map((file, i) =>
                file.type.startsWith("video/") ? (
                  <div
                    key={`video-${file.name}-${i}`}
                    className="flex items-center justify-between rounded-lg border border-border bg-bg-warm px-4 py-3"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <Video className="h-5 w-5 shrink-0 text-primary" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-text-primary">
                          {file.name}
                        </p>
                        <p className="text-xs text-text-muted">
                          {formatFileSize(file.size)}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="ml-3 rounded-md p-1.5 text-text-muted transition-colors hover:bg-red-50 hover:text-red-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : null
              )}
            </div>
          )}
        </section>

        {/* Documents & Other Files */}
        <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <h2 className="mb-2 text-lg font-semibold text-text-primary">
            📄 Documents & Plans
          </h2>
          <p className="mb-4 text-sm text-text-muted">
            Upload blueprints, permits, PDFs, spreadsheets, and other supporting
            documents that help define the project scope.
          </p>

          <label
            htmlFor="doc-upload"
            className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border px-6 py-6 transition-colors hover:border-amber-300 hover:bg-bg-warm"
          >
            <FileIcon className="h-8 w-8 text-text-muted" />
            <p className="mt-2 text-sm font-medium text-text-primary">
              Click to upload documents
            </p>
            <p className="mt-1 text-xs text-text-muted">
              PDFs, Word docs, spreadsheets, text files — up to 50MB each
            </p>
            <input
              id="doc-upload"
              type="file"
              multiple
              accept={PROJECT_DOCUMENT_FILE_ACCEPT}
              onChange={handleFileChange}
              className="hidden"
            />
          </label>

          {/* Document List */}
          {files.some(
            (f) => !f.type.startsWith("image/") && !f.type.startsWith("video/")
          ) && (
            <div className="mt-4 space-y-2">
              {files.map((file, i) =>
                !file.type.startsWith("image/") && !file.type.startsWith("video/") ? (
                  <div
                    key={`doc-${file.name}-${i}`}
                    className="flex items-center justify-between rounded-lg border border-border bg-bg-warm px-4 py-3"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <FileIcon className="h-5 w-5 text-primary shrink-0" />
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
                      onClick={() => removeFile(i)}
                      className="ml-3 rounded-md p-1.5 text-text-muted hover:bg-red-50 hover:text-red-600 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : null
              )}
            </div>
          )}
        </section>

        {/* Submit */}
        <div className="flex items-center justify-between rounded-xl border border-border bg-surface p-6 shadow-sm">
          <p className="text-sm text-text-muted">
            {enablePaidEstimate
              ? "Your project will be posted first, then Stripe Checkout will open so you can fund the paid estimate offer."
              : "Your project will be visible to all bidders immediately."}
          </p>
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
                {enablePaidEstimate
                  ? "Creating Project & Preparing Checkout..."
                  : "Posting Project..."}
              </>
            ) : (
              <span className="inline-flex items-center gap-2">
                {enablePaidEstimate && <CreditCard className="h-4 w-4" />}
                {enablePaidEstimate
                  ? "Post Project & Continue to Stripe"
                  : "Post Project"}
              </span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
