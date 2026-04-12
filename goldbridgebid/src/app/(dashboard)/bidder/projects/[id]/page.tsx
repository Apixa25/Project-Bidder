import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  MapPin,
  Calendar,
  DollarSign,
  Clock,
  ClipboardCheck,
  MessageSquare,
  User,
  History,
  Heart,
  Star,
  BadgeDollarSign,
  ShieldCheck,
} from "lucide-react";
import { TRADE_LABELS, FORM_TRADES } from "@/types/database";
import type {
  TradeCategory,
  BidderCredentials,
  PaidEstimateClaim,
  ProjectPaidEstimatePool,
} from "@/types/database";
import BidForm from "./BidForm";
import ProjectPhotosBidder from "./ProjectPhotosBidder";
import { userHasRole } from "@/lib/auth/roles";
import ProjectQA from "@/components/ProjectQA";
import {
  CORE_CREDENTIAL_LABELS,
  getPaidEstimateEligibility,
  PAID_ESTIMATE_FILTER_LABELS,
} from "@/lib/paid-estimates/eligibility";
import { reconcilePaidEstimatePoolFunding } from "@/lib/paid-estimates/funding";
import {
  getRemainingPaidSlots,
  isPaidEstimatePoolFull,
  isPaidEstimatePoolVisibleAsPaid,
} from "@/lib/paid-estimates/pools";
import { getStripeServerClient } from "@/lib/stripe/server";

const FIELD_DISPLAY_NAMES: Record<string, string> = {
  title: "Title",
  description: "Description",
  completion_criteria: "Completion Criteria",
  trades: "Trades Required",
  location_address: "Street Address",
  location_city: "City",
  location_state: "State",
  location_zip: "ZIP Code",
  budget_min: "Budget Min",
  budget_max: "Budget Max",
  desired_start_date: "Desired Start Date",
  timeline: "Expected Duration",
};

export default async function BidderProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const admin = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  if (!(await userHasRole(user.id, "bidder"))) redirect("/login");

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .eq("status", "open")
    .single();

  if (!project) notFound();

  const { data: projectFiles } = await supabase
    .from("project_files")
    .select("*")
    .eq("project_id", id)
    .order("display_order", { ascending: true })
    .order("uploaded_at", { ascending: false });

  const { data: projectQuestions } = await supabase
    .from("project_questions")
    .select("*")
    .eq("project_id", id)
    .order("created_at", { ascending: true });

  const questionAskerIds = [
    ...new Set((projectQuestions || []).map((q) => q.asker_id)),
  ];
  const { data: askerProfiles } = questionAskerIds.length
    ? await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", questionAskerIds)
    : { data: [] };

  const askerNameMap = new Map(
    (askerProfiles || []).map((p) => [p.user_id, p.full_name])
  );

  const formattedQuestions = (projectQuestions || []).map((q) => ({
    ...q,
    asker_name: askerNameMap.get(q.asker_id) || "A contractor",
  }));

  const { data: bidderCredentials } = await supabase
    .from("bidder_credentials")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: paidPoolRow } = await admin
    .from("project_paid_estimate_pools")
    .select("*")
    .eq("project_id", id)
    .maybeSingle();

  const { data: priorClaims } = await admin
    .from("paid_estimate_claims")
    .select("*")
    .eq("project_id", id)
    .eq("bidder_id", user.id)
    .neq("claim_status", "unpaid_bid");

  const { data: customerProfile } = await supabase
    .from("profiles")
    .select("user_id, full_name, business_name, city, state, created_at, avatar_url")
    .eq("user_id", project.customer_id)
    .single();

  const { count: customerHeartCount } = await supabase
    .from("profile_hearts")
    .select("*", { count: "exact", head: true })
    .eq("target_user_id", project.customer_id);

  const { data: customerReviews } = await supabase
    .from("user_reviews")
    .select("rating_overall, review_type")
    .eq("reviewee_user_id", project.customer_id)
    .eq("status", "published");

  const customerVerifiedReviews = (customerReviews || []).filter(
    (review) => review.review_type === "verified_platform"
  );
  const customerVerifiedAverage =
    customerVerifiedReviews.length > 0
      ? customerVerifiedReviews.reduce(
          (sum, review) => sum + review.rating_overall,
          0
        ) / customerVerifiedReviews.length
      : null;

  const { data: existingBids } = await supabase
    .from("bids")
    .select("trade")
    .eq("project_id", id)
    .eq("bidder_id", user.id);

  const alreadyBidTrades = (existingBids || []).map((b) => b.trade);
  const projectTrades = (project.trades as TradeCategory[]);
  const biddableTrades = projectTrades.length > 0 ? projectTrades : FORM_TRADES;
  const availableTrades = biddableTrades.filter(
    (t) => !alreadyBidTrades.includes(t)
  );

  const { data: projectEdits } = await supabase
    .from("project_edits")
    .select("*")
    .eq("project_id", id)
    .order("edited_at", { ascending: false });

  let paidPool = (paidPoolRow || null) as ProjectPaidEstimatePool | null;
  if (
    paidPool &&
    !paidPool.funded_at &&
    (paidPool.stripe_checkout_session_id || paidPool.stripe_payment_intent_id)
  ) {
    try {
      const stripe = getStripeServerClient();
      const reconciliation = await reconcilePaidEstimatePoolFunding({
        admin,
        stripe,
        pool: paidPool,
        customerId: project.customer_id,
      });

      if (reconciliation.didMarkFunded) {
        const { data: refreshedPool } = await admin
          .from("project_paid_estimate_pools")
          .select("*")
          .eq("project_id", id)
          .maybeSingle();

        paidPool = (refreshedPool || null) as ProjectPaidEstimatePool | null;
      }
    } catch (error) {
      console.error("Bidder project paid estimate reconciliation failed:", error);
    }
  }
  const paidEstimateLive = isPaidEstimatePoolVisibleAsPaid(paidPool);
  const paidEligibility = paidPool
    ? getPaidEstimateEligibility(
        (bidderCredentials || null) as BidderCredentials | null,
        paidPool.filter
      )
    : null;
  const missingCoreLabels =
    paidEligibility?.missingCoreCredentials.map(
      (field) => CORE_CREDENTIAL_LABELS[field]
    ) || [];
  const paidPoolRemainingSlots = getRemainingPaidSlots(paidPool);
  const paidPoolFull = isPaidEstimatePoolFull(paidPool);
  const existingPaidClaim = ((priorClaims || []) as PaidEstimateClaim[])[0] || null;
  const paidEstimateMode = !paidEstimateLive
    ? "not_available"
    : existingPaidClaim
      ? "already_claimed"
      : paidPoolFull
        ? "full"
        : paidEligibility?.isEligible
          ? "eligible"
          : "ineligible";

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/bidder/projects"
          className="mb-4 inline-flex items-center gap-1 text-sm text-text-muted hover:text-text-primary transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Browse Projects
        </Link>

        <div className="flex items-start justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold text-text-primary">
                {project.title}
              </h1>
              {paidEstimateLive && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">
                  <BadgeDollarSign className="h-3.5 w-3.5" />
                  Paid Estimate
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-text-muted">
              Posted {new Date(project.created_at).toLocaleDateString()} •{" "}
              {project.bid_count} {project.bid_count === 1 ? "bid" : "bids"}{" "}
              received
            </p>
          </div>
          <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
            Open for Bidding
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Edits Warning */}
          {projectEdits && projectEdits.length > 0 && (
            <section className="rounded-xl border-2 border-amber-400 bg-amber-50/70 p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <History className="h-5 w-5 text-amber-700" />
                <h2 className="text-lg font-semibold text-amber-900">
                  ⚠️ Project Edited After Posting
                </h2>
                <span className="rounded-full bg-amber-200 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                  {projectEdits.length} change{projectEdits.length !== 1 ? "s" : ""}
                </span>
              </div>
              <p className="mb-4 text-xs text-amber-700">
                The project owner has made changes since the original posting.
                Your existing bids remain date-stamped to their original
                submission time. Review the changes below before submitting a new
                bid.
              </p>
              <div className="space-y-3">
                {projectEdits.map((edit) => (
                  <div
                    key={edit.id}
                    className="rounded-lg border border-amber-200 bg-white p-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-amber-900">
                        {FIELD_DISPLAY_NAMES[edit.field_name] || edit.field_name}
                      </span>
                      <span className="text-xs text-amber-600">
                        {new Date(edit.edited_at).toLocaleString()}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-text-muted mb-1">Before</p>
                        <p className="text-sm text-red-700 bg-red-50 rounded-md px-3 py-2 line-through break-words">
                          {edit.old_value || "(empty)"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-text-muted mb-1">After</p>
                        <p className="text-sm text-green-700 bg-green-50 rounded-md px-3 py-2 break-words">
                          {edit.new_value || "(empty)"}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Description */}
          <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold text-text-primary">
              Project Description
            </h2>
            <p className="whitespace-pre-wrap text-text-secondary leading-relaxed">
              {project.description}
            </p>
          </section>

          {/* Completion Criteria */}
          <section className="rounded-xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <ClipboardCheck className="h-5 w-5 text-amber-700" />
              <h2 className="text-lg font-semibold text-amber-900">
                Completion Criteria
              </h2>
            </div>
            <p className="whitespace-pre-wrap text-amber-800 leading-relaxed">
              {project.completion_criteria}
            </p>
          </section>


          {paidEstimateLive && paidPool && paidEligibility && (
            <section className="rounded-xl border border-border bg-surface p-6 shadow-sm ring-1 ring-amber-200">
              <div className="flex flex-wrap items-center gap-2">
                <BadgeDollarSign className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold text-text-primary">
                  Paid Estimate Offer
                </h2>
                <span className="rounded-full bg-surface px-2.5 py-0.5 text-xs font-medium text-text-primary">
                  {PAID_ESTIMATE_FILTER_LABELS[paidPool.filter]}
                </span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg bg-surface px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
                    Reward
                  </p>
                  <p className="text-money mt-1 text-lg font-bold">
                    ${Number(paidPool.reward_amount).toLocaleString()}
                  </p>
                </div>
                <div className="rounded-lg bg-surface px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
                    Remaining Slots
                  </p>
                  <p className="mt-1 text-lg font-bold text-text-primary">
                    {paidPoolRemainingSlots}
                  </p>
                </div>
                <div className="rounded-lg bg-surface px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
                    Paid Pool Scope
                  </p>
                  <p className="mt-1 text-sm font-semibold text-text-primary">
                    Project-wide
                  </p>
                </div>
              </div>
              <div className="mt-4 rounded-lg border border-border bg-surface px-4 py-4 text-sm text-text-secondary">
                {paidEstimateMode === "eligible" && (
                  <p className="flex items-start gap-2 text-green-800">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                    You qualify for this paid estimate pool. Submit soon to try
                    to claim one of the remaining paid slots.
                  </p>
                )}
                {paidEstimateMode === "ineligible" && (
                  <div className="space-y-2">
                    <p className="text-amber-800">
                      You do not meet the paid estimate requirements right now,
                      but you can still submit a normal unpaid bid on this
                      project.
                    </p>
                    {missingCoreLabels.length > 0 && (
                      <p>
                        Missing for paid eligibility:{" "}
                        <span className="font-medium text-text-primary">
                          {missingCoreLabels.join(", ")}
                        </span>
                      </p>
                    )}
                  </div>
                )}
                {paidEstimateMode === "full" && (
                  <p className="text-amber-800">
                    Paid estimate slots have already been filled. You may still
                    submit an unpaid bid on this project.
                  </p>
                )}
                {paidEstimateMode === "already_claimed" && (
                  <p className="text-text-primary">
                    You have already claimed a paid estimate slot on this
                    project. You may still submit another unpaid bid on a
                    different trade if needed.
                  </p>
                )}
              </div>
            </section>
          )}

          {/* Project media with annotation-aware photo view */}
          {projectFiles && projectFiles.length > 0 && (
            <ProjectPhotosBidder files={projectFiles} />
          )}

          {/* Bid Form */}
          <section
            id="bid-form"
            className="rounded-xl border-2 border-secondary/30 bg-surface p-6 shadow-sm"
          >
            <h2 className="mb-1 text-xl font-bold text-text-primary">
              Submit Your Bid 📝
            </h2>
            <p className="mb-6 text-sm text-text-secondary">
              Fill in your proposal details below. Bids are sealed — only the
              project owner will see your submission.
            </p>

            {availableTrades.length > 0 ? (
              <BidForm
                projectId={project.id}
                availableTrades={availableTrades}
                paidEstimateMode={paidEstimateMode}
                paidEstimateReward={
                  paidEstimateLive && paidPool
                    ? Number(paidPool.reward_amount)
                    : null
                }
                paidEstimateRemainingSlots={
                  paidEstimateLive ? paidPoolRemainingSlots : 0
                }
              />
            ) : (
              <div className="rounded-lg bg-green-50 px-6 py-8 text-center">
                <ClipboardCheck className="mx-auto h-10 w-10 text-green-500" />
                <p className="mt-3 text-sm font-medium text-green-800">
                  You&apos;ve already bid on all trades for this project!
                </p>
                <Link
                  href="/bidder/bids"
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-secondary px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-secondary-dark transition-colors"
                >
                  View My Bids →
                </Link>
              </div>
            )}
          </section>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Info */}
          <div className="rounded-xl border border-border bg-surface p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-semibold text-text-primary">
              Project Details
            </h3>

            <div className="flex items-center gap-3">
              <MapPin className="h-5 w-5 text-text-muted shrink-0" />
              <div>
                <p className="text-xs text-text-muted">Location</p>
                <p className="text-sm font-medium text-text-primary">
                  {project.location_address}
                </p>
                <p className="text-sm text-text-secondary">
                  {project.location_city}, {project.location_state}{" "}
                  {project.location_zip}
                </p>
              </div>
            </div>

            {project.desired_start_date && (
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-text-muted shrink-0" />
                <div>
                  <p className="text-xs text-text-muted">Desired Start</p>
                  <p className="text-sm font-medium text-text-primary">
                    {new Date(project.desired_start_date).toLocaleDateString()}
                  </p>
                </div>
              </div>
            )}

            {project.timeline && (
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-text-muted shrink-0" />
                <div>
                  <p className="text-xs text-text-muted">Expected Duration</p>
                  <p className="text-sm font-medium text-text-primary">
                    {project.timeline}
                  </p>
                </div>
              </div>
            )}

            {(project.budget_min || project.budget_max) && (
              <div className="flex items-center gap-3">
                <DollarSign className="h-5 w-5 text-text-muted shrink-0" />
                <div>
                  <p className="text-xs text-text-muted">Budget Range</p>
                  <p className="text-money text-sm font-medium">
                    {project.budget_min && project.budget_max
                      ? `$${Number(project.budget_min).toLocaleString()} – $${Number(project.budget_max).toLocaleString()}`
                      : project.budget_max
                        ? `Up to $${Number(project.budget_max).toLocaleString()}`
                        : `From $${Number(project.budget_min).toLocaleString()}`}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Trades Required */}
          <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-text-primary">
              Trades Required
            </h3>
            <div className="flex flex-wrap gap-2">
              {projectTrades.length > 0 ? (
                projectTrades.map((trade) => {
                  const alreadyBid = alreadyBidTrades.includes(trade);
                  return (
                    <span
                      key={trade}
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        alreadyBid
                          ? "bg-green-100 text-green-700"
                          : "bg-primary/10 text-primary"
                      }`}
                    >
                      {TRADE_LABELS[trade]}
                      {alreadyBid && " ✓"}
                    </span>
                  );
                })
              ) : (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                  Open to all trades
                </span>
              )}
            </div>
            {alreadyBidTrades.length > 0 && (
              <p className="mt-3 text-xs text-text-muted">
                ✓ = You&apos;ve already bid on this trade
              </p>
            )}
          </div>

          {/* Customer Actions */}
          <div className="space-y-2">
            <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                Customer Snapshot
              </p>
              <div className="mt-2 flex items-center gap-3">
                <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full border border-border bg-bg-warm">
                  {customerProfile?.avatar_url ? (
                    <Image
                      src={customerProfile.avatar_url}
                      alt={customerProfile.full_name}
                      fill
                      sizes="44px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/15 to-secondary/15 text-sm font-semibold text-text-primary">
                      {(customerProfile?.full_name || "Project Owner")
                        .split(" ")
                        .map((namePart: string) => namePart[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2)}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-text-primary">
                    {customerProfile?.full_name || "Project Owner"}
                  </h3>
                  {customerProfile?.business_name && (
                    <p className="mt-1 text-sm text-text-secondary">
                      {customerProfile.business_name}
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-bg-warm px-3 py-2">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-text-muted">
                    Rating
                  </p>
                  <p className="mt-1 text-base font-bold text-text-primary">
                    {customerVerifiedAverage === null
                      ? "New"
                      : customerVerifiedAverage.toFixed(1)}
                  </p>
                </div>
                <div className="rounded-lg bg-bg-warm px-3 py-2">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-text-muted">
                    Reviews
                  </p>
                  <p className="mt-1 flex items-center gap-1 text-base font-bold text-text-primary">
                    <Star className="h-3.5 w-3.5 text-amber-500" />
                    {customerReviews?.length || 0}
                  </p>
                </div>
                <div className="rounded-lg bg-bg-warm px-3 py-2">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-text-muted">
                    Hearts
                  </p>
                  <p className="mt-1 flex items-center gap-1 text-base font-bold text-text-primary">
                    <Heart className="h-3.5 w-3.5 text-primary" />
                    {customerHeartCount || 0}
                  </p>
                </div>
              </div>
              {customerProfile?.city && customerProfile?.state && (
                <p className="mt-3 text-sm text-text-secondary">
                  {customerProfile.city}, {customerProfile.state}
                </p>
              )}
              {customerProfile?.created_at && (
                <p className="mt-1 text-xs text-text-muted">
                  Member since{" "}
                  {new Date(customerProfile.created_at).toLocaleDateString()}
                </p>
              )}
            </div>
            <Link
              href={`/profile/${project.customer_id}`}
              className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface p-4 text-sm font-semibold text-text-primary hover:bg-surface-hover transition-colors"
            >
              <User className="h-5 w-5" />
              View Customer Profile
            </Link>
            <Link
              href={`/bidder/messages/${id}/${project.customer_id}`}
              className="flex items-center justify-center gap-2 rounded-xl border border-secondary bg-teal-50 p-4 text-sm font-semibold text-secondary hover:bg-teal-100 transition-colors"
            >
              <MessageSquare className="h-5 w-5" />
              Message Project Owner
            </Link>
          </div>

          {/* Q&A */}
          <ProjectQA
            projectId={id}
            questions={formattedQuestions}
            currentUserId={user.id}
            isProjectOwner={false}
          />

          {/* Quick Scroll to Bid */}
          {availableTrades.length > 0 && (
            <a
              href="#bid-form"
              className="block rounded-xl bg-secondary p-6 text-center text-white shadow-sm hover:bg-secondary-dark transition-colors"
            >
              <p className="text-lg font-bold">Ready to Bid?</p>
              <p className="mt-1 text-sm text-white/80">
                Scroll down to submit your proposal ↓
              </p>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
