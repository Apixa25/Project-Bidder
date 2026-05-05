"use client";

import Image from "next/image";
import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import RichTextEditor from "@/components/ui/RichTextEditor";
import {
  ArrowLeft,
  X,
  Loader2,
  ImageIcon,
  Video,
  FileText as FileIcon,
  BadgeDollarSign,
  CreditCard,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { analyzeProjectDraft, createProject, getCostEstimates } from "../actions";
import {
  EXPERTISE_LEVELS,
  EXPERTISE_LEVEL_LABELS,
  EXPERTISE_LEVEL_DESCRIPTIONS,
} from "@/types/database";
import type { ExpertiseLevel } from "@/types/database";
import type { ProjectAiScopeItemDraft } from "@/lib/ai-scope-items";
import { compressFiles } from "@/lib/compress-image";
import { createBrowserClient } from "@supabase/ssr";
import {
  IMAGE_FILE_ACCEPT,
  PROJECT_VIDEO_FILE_ACCEPT,
  PROJECT_DOCUMENT_FILE_ACCEPT,
} from "@/lib/file-uploads";
import { PAID_ESTIMATE_FILTER_LABELS } from "@/lib/paid-estimates/eligibility";
import type {
  ProjectAiAnalysisResult,
  ProjectAiRecommendedQuestion,
} from "@/lib/ai-estimates";

type DraftAiAnalysis = ProjectAiAnalysisResult & {
  model_name?: string | null;
};

type DraftCustomScopeItem = {
  id: string;
  label: string;
};

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
  const [expertiseLevel, setExpertiseLevel] = useState<ExpertiseLevel | null>(null);
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
  const [aiAnalysis, setAiAnalysis] = useState<DraftAiAnalysis | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [draftScopeItems, setDraftScopeItems] = useState<ProjectAiScopeItemDraft[]>([]);
  const [draftExcludedKeys, setDraftExcludedKeys] = useState<Set<string>>(new Set());
  const [draftConfirmedKeys, setDraftConfirmedKeys] = useState<Set<string>>(new Set());
  const [draftCustomScopeItems, setDraftCustomScopeItems] = useState<
    DraftCustomScopeItem[]
  >([]);
  const [showDraftCustomItemForm, setShowDraftCustomItemForm] = useState(false);
  const [draftCustomItemLabel, setDraftCustomItemLabel] = useState("");
  const [draftClarificationAnswers, setDraftClarificationAnswers] = useState<
    Record<string, string[]>
  >({});

  useEffect(() => {
    getCostEstimates().then((data) => setCostEstimates(data));
  }, []);

  const matchedEstimates = costEstimates;

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

  const draftScopeItemClarificationPayload = useMemo(() => {
    return draftScopeItems
      .filter(
        (item) =>
          draftConfirmedKeys.has(item.item_key) ||
          draftExcludedKeys.has(item.item_key)
      )
      .map((item, index) => {
        const isIncluded = draftConfirmedKeys.has(item.item_key);

        return {
          question_key: `scope_item__${item.item_key}__include`,
          question_text: `Do you want to include "${item.item_label}" in your project scope?`,
          question_type: "single_select" as const,
          help_text:
            item.why_it_may_apply ||
            "This is a standard requirement for your project type.",
          placeholder: null,
          options: [
            { id: "yes", label: "Yes, include this" },
            { id: "no", label: "No, exclude this" },
            { id: "not_sure", label: "Not sure yet" },
          ],
          answer_value_json: isIncluded ? "yes" : "no",
          status: "answered" as const,
          display_order: index,
        };
      });
  }, [draftConfirmedKeys, draftExcludedKeys, draftScopeItems]);

  const serializedDraftScopeItemClarifications = useMemo(
    () => JSON.stringify(draftScopeItemClarificationPayload),
    [draftScopeItemClarificationPayload]
  );

  const serializedDraftCustomScopeItems = useMemo(
    () => JSON.stringify(draftCustomScopeItems),
    [draftCustomScopeItems]
  );


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

  function addDraftCustomScopeItem() {
    const label = draftCustomItemLabel.trim();
    if (!label) {
      return;
    }

    setDraftCustomScopeItems((prev) => [
      ...prev,
      {
        id: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        label,
      },
    ]);
    setDraftCustomItemLabel("");
    setShowDraftCustomItemForm(false);
  }

  async function handleAiScopeCheck() {
    if (!formRef.current) {
      return;
    }

    const formData = new FormData(formRef.current);
    setAiLoading(true);
    setAiError(null);

    try {
      const result = await analyzeProjectDraft({
        title: (formData.get("title") as string) || "",
        description: (formData.get("description") as string) || "",
        completionCriteria: (formData.get("completionCriteria") as string) || "",
        trades: [],
        expertiseLevel: expertiseLevel || undefined,
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
        })).concat(
          draftScopeItemClarificationPayload.map((clarification) => ({
            question_key: clarification.question_key,
            answer_value_json: clarification.answer_value_json,
            status: clarification.status,
          }))
        ),
      });

      if (result.error) {
        setAiError(result.error);
        return;
      }

      if (!result.analysis) {
        setAiError("AI Scope Check did not return an analysis.");
        return;
      }

      setAiAnalysis(result.analysis);
      if (result.scopeItemDrafts) {
        setDraftScopeItems(result.scopeItemDrafts);
        setDraftExcludedKeys(new Set());
        setDraftConfirmedKeys(new Set());
      }
      setDraftClarificationAnswers((prev) => {
        const nextState = { ...prev };

        for (const question of result.analysis.recommended_questions) {
          if (!nextState[question.question_key]) {
            nextState[question.question_key] = [];
          }
        }

        return nextState;
      });
    } catch (error) {
      console.error("AI Scope Check failed:", error);
      setAiError(
        "AI Scope Check could not finish. Please try again, or save the project and refresh the AI estimate from the project page."
      );
    } finally {
      setAiLoading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    setLoading(true);
    setError(null);

    if (expertiseLevel) {
      formData.set("expertiseLevel", expertiseLevel);
    }

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

      <section className="mb-6 rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
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
        <input
          type="hidden"
          name="draftAiItemClarifications"
          value={serializedDraftScopeItemClarifications}
        />
        <input
          type="hidden"
          name="draftCustomScopeItems"
          value={serializedDraftCustomScopeItems}
        />
        {/* Project Basics */}
        <section className="rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-6">
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
              <label className="block text-sm font-medium text-text-primary mb-1.5">
                Project Description <span className="text-red-500">*</span>
              </label>
              <RichTextEditor
                name="description"
                placeholder="Describe the full scope of work. Include as much detail as possible — materials, dimensions, special requirements, access considerations, etc."
              />
            </div>

            {/* Completion Criteria — disabled; description + AI questions cover this */}
          </div>
        </section>

        {/* Expertise Level */}
        <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <h2 className="mb-2 text-lg font-semibold text-text-primary">
            Level of Professional Needed
          </h2>
          <p className="mb-3 text-sm text-text-muted">
            What level of expertise does your project actually require? This
            helps us match you with the right pool of contractors.
          </p>

          {/* Price-vs-qualification primer — picking a higher level usually
              means higher bids from a smaller, more credentialed pool;
              picking a lower level usually means more bidders at lower
              prices. We surface this up-front so customers don't accidentally
              over-shop a small job. */}
          <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900">
            <p className="font-semibold text-amber-900">
              Quick tip on price 💡
            </p>
            <p className="mt-1">
              The <strong>more qualified</strong> the professional you require,
              the <strong>higher the bid prices</strong> tend to be — and the{" "}
              <strong>fewer bidders</strong> will be eligible. The{" "}
              <strong>less qualified</strong> the work needs, the{" "}
              <strong>lower the bid prices</strong> and the{" "}
              <strong>larger the pool</strong> of bidders. Pick the lowest
              level that still gets the job done right.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {EXPERTISE_LEVELS.map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setExpertiseLevel(level)}
                className={`rounded-xl border-2 p-4 text-left transition-all ${
                  expertiseLevel === level
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border bg-surface hover:border-primary/40"
                }`}
              >
                <p className="text-sm font-semibold text-text-primary">
                  {EXPERTISE_LEVEL_LABELS[level]}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-text-muted">
                  {EXPERTISE_LEVEL_DESCRIPTIONS[level]}
                </p>
              </button>
            ))}
          </div>
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

            {/* On mobile each field stacks full-width so the State <select>
                isn't crushed to ~35px. At sm+ we restore the original 6-column
                layout (city=3, state=1, zip=2). */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-6">
              <div className="sm:col-span-3">
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
              <div className="sm:col-span-1">
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
              <div className="sm:col-span-2">
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
            {/* Stack inputs full-width on phones; restore 2-column layout at sm+. */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

            {/* Dollar inputs need breathing room; stack on phones. */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                  Build Your Bid-Ready Scope
                </h2>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                Before contractors bid, ProjectXBidX helps turn your description
                into a clear scope checklist. This gives you a planning reference
                and gives contractors a cleaner list of items to price.
              </p>
            </div>

            <button
              type="button"
              onClick={handleAiScopeCheck}
              disabled={aiLoading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-primary-dark disabled:opacity-60 sm:w-auto"
            >
              {aiLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Building scope checklist...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Build My Scope Checklist
                </>
              )}
            </button>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-border bg-bg-warm px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                Step 1
              </p>
              <p className="mt-1 text-sm font-semibold text-text-primary">
                Identify the project type
              </p>
              <p className="mt-1 text-xs leading-relaxed text-text-secondary">
                The AI reads your description, location, timing, budget, and
                files to understand what kind of work this is.
              </p>
            </div>
            <div className="rounded-lg border border-border bg-bg-warm px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                Step 2
              </p>
              <p className="mt-1 text-sm font-semibold text-text-primary">
                Create a scope checklist
              </p>
              <p className="mt-1 text-xs leading-relaxed text-text-secondary">
                Standard items for this project type are suggested so important
                work does not get missed before bidding starts.
              </p>
            </div>
            <div className="rounded-lg border border-border bg-bg-warm px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                Step 3
              </p>
              <p className="mt-1 text-sm font-semibold text-text-primary">
                You stay in control
              </p>
              <p className="mt-1 text-xs leading-relaxed text-text-secondary">
                Include what applies, skip what does not, and use the result as
                a planning guide against real contractor bids.
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900">
            This is not a final contractor price. It is a scope-building tool
            that helps you define the work clearly before sealed bids come in.
          </div>

          {aiError && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {aiError}
            </div>
          )}

          {aiAnalysis ? (
            <div className="mt-5">
              {draftScopeItems.length > 0 && (
                <div className="mt-5 rounded-xl border border-border bg-bg-warm/60 p-5">
                  <h3 className="text-base font-semibold text-text-primary">
                    Review Suggested Scope Items
                  </h3>
                  <p className="mt-1 text-sm text-text-secondary">
                    These are common work items for this project type. Include
                    the items that belong in your project and skip anything that
                    does not apply. Your choices are saved with the project so
                    the scope can guide real contractor bids.
                  </p>

                  <div className="mt-4 space-y-2">
                    {draftScopeItems
                      .filter((item) => !draftExcludedKeys.has(item.item_key))
                      .map((item) => {
                        const isConfirmed =
                          item.customer_inclusion === "yes" ||
                          draftConfirmedKeys.has(item.item_key);
                        const isProposed = !isConfirmed;

                        if (isProposed) {
                          return (
                            <div
                              key={item.item_key}
                              className="flex items-start justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-text-primary">
                                  {item.item_label}
                                </p>
                                {item.required_status === "required" && (
                                  <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-primary">
                                    AI strongly recommends reviewing this item
                                  </p>
                                )}
                                {item.why_it_may_apply && (
                                  <p className="mt-1 text-xs text-text-secondary">
                                    {item.why_it_may_apply}
                                  </p>
                                )}
                              </div>
                              <div className="flex shrink-0 gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDraftConfirmedKeys((prev) =>
                                      new Set(prev).add(item.item_key)
                                    )
                                  }
                                  className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                                >
                                  Yes, include
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDraftExcludedKeys((prev) =>
                                      new Set(prev).add(item.item_key)
                                    )
                                  }
                                  className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-500 hover:border-red-300 hover:bg-red-50 hover:text-red-600"
                                >
                                  No, skip
                                </button>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={item.item_key}
                            className="flex items-center justify-between gap-3 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <svg className="h-4 w-4 shrink-0 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                              <div>
                                <p className="text-sm font-medium text-emerald-800">
                                  {item.item_label}
                                  {item.required_status === "required" && (
                                    <span className="ml-2 text-[11px] font-semibold uppercase text-emerald-600">AI recommended</span>
                                  )}
                                </p>
                                {item.description && (
                                  <p className="mt-0.5 text-xs text-emerald-700/70">
                                    {item.description}
                                  </p>
                                )}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setDraftConfirmedKeys((prev) => {
                                  const next = new Set(prev);
                                  next.delete(item.item_key);
                                  return next;
                                });
                                setDraftExcludedKeys((prev) =>
                                  new Set(prev).add(item.item_key)
                                );
                              }}
                              className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-500 hover:border-red-300 hover:bg-red-50 hover:text-red-600"
                            >
                              Skip
                            </button>
                          </div>
                        );
                      })}
                  </div>

                  {Array.from(draftExcludedKeys).length > 0 && (
                    <div className="mt-3 rounded-lg border border-dashed border-slate-300 bg-slate-50/50 p-3">
                      <p className="text-xs font-semibold text-text-muted mb-2">
                        Excluded ({draftExcludedKeys.size})
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {draftScopeItems
                          .filter((item) => draftExcludedKeys.has(item.item_key))
                          .map((item) => (
                            <button
                              key={item.item_key}
                              type="button"
                              onClick={() =>
                                setDraftExcludedKeys((prev) => {
                                  const next = new Set(prev);
                                  next.delete(item.item_key);
                                  return next;
                                })
                              }
                              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-text-secondary line-through hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 hover:no-underline"
                            >
                              {item.item_label} — Restore
                            </button>
                          ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-4 rounded-lg border border-dashed border-primary/30 bg-primary/5 p-3">
                    <p className="text-sm font-semibold text-text-primary">
                      Add anything else you want contractors to include
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-text-secondary">
                      This can be unrelated to the AI&apos;s project type, like
                      &quot;pick up trash in the driveway before leaving.&quot;
                    </p>

                    {draftCustomScopeItems.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {draftCustomScopeItems.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() =>
                              setDraftCustomScopeItems((prev) =>
                                prev.filter((current) => current.id !== item.id)
                              )
                            }
                            className="rounded-full border border-primary/20 bg-white px-3 py-1 text-xs font-medium text-text-primary hover:border-red-300 hover:bg-red-50 hover:text-red-600"
                          >
                            {item.label} — Remove
                          </button>
                        ))}
                      </div>
                    )}

                    {showDraftCustomItemForm ? (
                      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                        <input
                          type="text"
                          value={draftCustomItemLabel}
                          onChange={(event) =>
                            setDraftCustomItemLabel(event.target.value)
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              addDraftCustomScopeItem();
                            }
                          }}
                          placeholder="e.g., Pick up trash in the driveway"
                          className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                        <button
                          type="button"
                          onClick={addDraftCustomScopeItem}
                          disabled={!draftCustomItemLabel.trim()}
                          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-primary-dark disabled:opacity-50"
                        >
                          Add Item
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowDraftCustomItemForm(false);
                            setDraftCustomItemLabel("");
                          }}
                          className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-bg-warm"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowDraftCustomItemForm(true)}
                        className="mt-3 rounded-lg border border-dashed border-primary/40 bg-white px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/10"
                      >
                        Add Custom Scope Item
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="mt-4 rounded-lg border border-border bg-surface px-4 py-3 text-sm leading-relaxed text-text-secondary">
                After you post the project, contractors can use the approved
                scope as a starting point for their real bid. They still control
                their own quantities, labor, material prices, and final proposal.
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-lg border border-border bg-bg-warm px-4 py-4 text-sm text-text-secondary">
              No scope checklist yet. Fill in the main project details, then let
              AI build a first-pass checklist before you post the project.
            </div>
          )}
        </section>

        <section className="rounded-xl border border-border bg-surface p-4 shadow-sm ring-1 ring-amber-200 sm:p-6">
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
        <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <p className="text-sm text-text-muted">
            {enablePaidEstimate
              ? "Your project will be posted first, then Stripe Checkout will open so you can fund the paid estimate offer."
              : "Your project will be visible to all bidders immediately."}
          </p>
          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-slate-950 shadow-sm transition-colors hover:bg-primary-dark disabled:opacity-60 sm:w-auto sm:px-8"
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
