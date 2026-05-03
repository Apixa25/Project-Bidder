import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import RichTextRenderer from "@/components/ui/RichTextRenderer";
import {
  ArrowLeft,
  MapPin,
  Calendar,
  DollarSign,
  Clock,
  ClipboardCheck,
  FileText,
  User,
  Phone,
  Mail,
  MessageSquare,
  BriefcaseBusiness,
} from "lucide-react";
import { TRADE_LABELS, EXPERTISE_LEVEL_LABELS } from "@/types/database";
import type { ExpertiseLevel } from "@/types/database";
import { BADGE_CONFIG } from "@/lib/badges";
import { hasCoreCredentials } from "@/lib/badges";
import type {
  TradeCategory,
  BadgeLevel,
  ProjectPaidEstimatePool,
  PaidEstimateClaim,
  PaidEstimateDispute,
  BidLineItem,
} from "@/types/database";
import ProjectStatusActions from "./ProjectStatusActions";
import PrintProjectButton from "@/components/project/PrintProjectButton";
import ProjectAddressMap from "@/components/project/ProjectAddressMap";
import ProjectPhotos from "./ProjectPhotos";
import ProjectEditHistoryCollapsible from "@/components/project/ProjectEditHistoryCollapsible";
import AwardBidButton from "./AwardBidButton";
import { userHasRole } from "@/lib/auth/roles";
import CredentialChecklist from "@/components/credentials/CredentialChecklist";
import CoreCredentialsCheck from "@/components/credentials/CoreCredentialsCheck";
import PaidEstimatePoolPanel from "./PaidEstimatePoolPanel";
import DisputePaidEstimateButton from "./DisputePaidEstimateButton";
import ProjectAiEstimatePanel from "./ProjectAiEstimatePanel";
import { isPaidEstimatePoolVisibleAsPaid } from "@/lib/paid-estimates/pools";
import ProjectQA from "@/components/ProjectQA";
import BidComparisonToggle from "@/components/BidComparisonToggle";
import BidLineItemsTable from "@/components/bids/BidLineItemsTable";
import { reconcilePaidEstimatePoolFunding } from "@/lib/paid-estimates/funding";
import { getStripeServerClient } from "@/lib/stripe/server";
import type {
  ProjectAiRecommendedQuestion,
  ProjectAiTradeBreakdownItem,
} from "@/lib/ai-estimates";
import type {
  ProjectAiScopeItemEvidenceSignal,
  ProjectAiScopeItemQuantityDriver,
} from "@/lib/ai-scope-items";


export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const supabase = await createClient();
  const admin = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  if (!(await userHasRole(user.id, "customer"))) redirect("/login");

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .eq("customer_id", user.id)
    .single();

  if (!project) {
    console.error(
      `[project-detail] 404 for project ${id}, user ${user.id}, error:`,
      projectError
    );
    notFound();
  }

  const { data: projectFiles } = await supabase
    .from("project_files")
    .select("*")
    .eq("project_id", id)
    .order("display_order", { ascending: true })
    .order("uploaded_at", { ascending: false });

  const { data: aiEstimate } = await supabase
    .from("project_ai_estimates")
    .select("*")
    .eq("project_id", id)
    .maybeSingle();

  const { data: aiClarifications } = await supabase
    .from("project_ai_clarifications")
    .select("*")
    .eq("project_id", id)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });

  const { data: aiScopeItems } = await supabase
    .from("project_ai_scope_items")
    .select("*")
    .eq("project_id", id)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });

  const { data: aiItemClarifications } = await supabase
    .from("project_ai_item_clarifications")
    .select("*")
    .eq("project_id", id)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });

  const { data: latestAiRun } = await supabase
    .from("project_ai_analysis_runs")
    .select("model_name")
    .eq("project_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: paidEstimatePool } = await admin
    .from("project_paid_estimate_pools")
    .select("*")
    .eq("project_id", id)
    .maybeSingle();

  const { data: bids } = await supabase
    .from("bids")
    .select("*, bid_files(*)")
    .eq("project_id", id)
    .order("created_at", { ascending: true });

  const bidIds = (bids || []).map((bid) => bid.id);
  const { data: bidLineItemRows } = bidIds.length
    ? await supabase
        .from("bid_line_items")
        .select("*")
        .in("bid_id", bidIds)
        .order("display_order", { ascending: true })
    : { data: [] };

  const bidCount = bids?.length ?? 0;

  const { data: paidEstimateClaims } = await admin
    .from("paid_estimate_claims")
    .select("*")
    .eq("project_id", id);

  // Fetch bidder profiles and credentials for each bid
  const bidderIds = bids?.map((b) => b.bidder_id) || [];
  const { data: bidderProfiles } = bidderIds.length > 0
    ? await supabase
        .from("profiles")
        .select("*")
        .in("user_id", bidderIds)
    : { data: [] };

  const { data: bidderCredentials } = bidderIds.length > 0
    ? await supabase
        .from("bidder_credentials")
        .select("*")
        .in("user_id", bidderIds)
    : { data: [] };

  const { data: bidderSpecialties } = bidderIds.length > 0
    ? await supabase
        .from("bidder_specialties")
        .select("user_id, trade, display_order")
        .in("user_id", bidderIds)
        .order("display_order", { ascending: true })
    : { data: [] };

  // Pull every published review for every bidder we're comparing so we can
  // surface their reputation inline in the bid comparison table. We aggregate
  // in JS rather than via a Postgres aggregate function to avoid needing a new
  // RPC — the row volume is small (max ~10 bidders × their lifetime reviews).
  const { data: bidderReviewRows } = bidderIds.length > 0
    ? await supabase
        .from("user_reviews")
        .select("reviewee_user_id, rating_overall")
        .in("reviewee_user_id", bidderIds)
        .eq("status", "published")
    : { data: [] };

  const reviewStatsMap = new Map<
    string,
    { avg: number; count: number }
  >();
  for (const row of bidderReviewRows || []) {
    const current = reviewStatsMap.get(row.reviewee_user_id) || {
      avg: 0,
      count: 0,
    };
    const newCount = current.count + 1;
    const newAvg =
      (current.avg * current.count + row.rating_overall) / newCount;
    reviewStatsMap.set(row.reviewee_user_id, {
      avg: newAvg,
      count: newCount,
    });
  }

  // Fetch edit history
  const { data: projectEdits } = await supabase
    .from("project_edits")
    .select("*")
    .eq("project_id", id)
    .order("edited_at", { ascending: false });

  // Fetch Q&A
  const { data: projectQuestions } = await supabase
    .from("project_questions")
    .select("*")
    .eq("project_id", id)
    .order("created_at", { ascending: true });

  const questionAskerIds = [
    ...new Set((projectQuestions || []).map((q) => q.asker_id)),
  ];
  const { data: qaAskerProfiles } = questionAskerIds.length
    ? await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", questionAskerIds)
    : { data: [] };

  const qaAskerNameMap = new Map(
    (qaAskerProfiles || []).map((p) => [p.user_id, p.full_name])
  );

  const formattedQuestions = (projectQuestions || []).map((q) => ({
    ...q,
    asker_name: qaAskerNameMap.get(q.asker_id) || "A contractor",
  }));

  const claimIds = (paidEstimateClaims || []).map((claim) => claim.id);
  const { data: paidEstimateDisputes } = claimIds.length
    ? await admin
        .from("paid_estimate_disputes")
        .select("*")
        .in("claim_id", claimIds)
    : { data: [] };

  const profileMap = new Map(
    (bidderProfiles || []).map((p) => [p.user_id, p])
  );
  const credentialMap = new Map(
    (bidderCredentials || []).map((c) => [c.user_id, c])
  );
  const claimMap = new Map(
    ((paidEstimateClaims || []) as PaidEstimateClaim[]).map((claim) => [
      claim.bid_id,
      claim,
    ])
  );
  const disputeMap = new Map(
    ((paidEstimateDisputes || []) as PaidEstimateDispute[]).map((dispute) => [
      dispute.claim_id,
      dispute,
    ])
  );
  const bidLineItemsMap = new Map<string, BidLineItem[]>();
  for (const lineItem of (bidLineItemRows || []) as BidLineItem[]) {
    const current = bidLineItemsMap.get(lineItem.bid_id) || [];
    current.push(lineItem);
    bidLineItemsMap.set(lineItem.bid_id, current);
  }
  const specialtyMap = new Map<string, string[]>();
  for (const specialty of bidderSpecialties || []) {
    const current = specialtyMap.get(specialty.user_id) || [];
    current.push(TRADE_LABELS[specialty.trade as TradeCategory]);
    specialtyMap.set(specialty.user_id, current);
  }
  const awardedProfile = project.awarded_bidder_id
    ? profileMap.get(project.awarded_bidder_id)
    : null;

  // For the "Leave a Review" nudge on awarded/completed projects: check if
  // the customer has already left a verified review for the awarded bidder
  // on THIS project. If they have, we suppress the CTA; if they haven't, we
  // show it prominently inside the Winning Bid Selected card.
  const customerVerifiedReviewedThisProject = project.awarded_bidder_id
    ? Boolean(
        (
          await supabase
            .from("user_reviews")
            .select("id")
            .eq("reviewer_user_id", user.id)
            .eq("reviewee_user_id", project.awarded_bidder_id)
            .eq("project_id", project.id)
            .eq("review_type", "verified_platform")
            .maybeSingle()
        ).data
      )
    : false;
  let paidPool = (paidEstimatePool || null) as ProjectPaidEstimatePool | null;

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
      console.error("Paid estimate funding reconciliation error:", error);
    }
  }

  const paidEstimateLive = isPaidEstimatePoolVisibleAsPaid(paidPool);
  const checkoutMessage =
    query.paidEstimateCheckout === "success"
      ? "Stripe checkout completed. If payment confirmation has already arrived, your paid estimate offer is now live."
      : query.paidEstimateCheckout === "cancelled"
        ? "Stripe checkout was cancelled. Your paid estimate offer stays inactive until funding succeeds."
        : query.paidEstimateSetup === "failed"
          ? "Your project was created, but the paid estimate checkout was not prepared. You can retry from the Paid Estimate Pool panel below."
        : null;

  const comparisonBids = (bids || []).map((bid) => {
    const p = profileMap.get(bid.bidder_id);
    const c = credentialMap.get(bid.bidder_id);
    const reviewStats = reviewStatsMap.get(bid.bidder_id) || null;
    return {
      id: bid.id,
      bidder_user_id: bid.bidder_id as string,
      bidder_name: p?.full_name || "Unknown",
      business_name: p?.business_name || null,
      badge_level: (c?.badge_level as BadgeLevel) || null,
      trade: bid.trade as TradeCategory,
      price: bid.price,
      estimated_timeline: bid.estimated_timeline,
      estimated_start_date: bid.estimated_start_date,
      notes: bid.notes,
      created_at: bid.created_at,
      review_avg: reviewStats ? reviewStats.avg : null,
      review_count: reviewStats ? reviewStats.count : 0,
    };
  });

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/customer/projects"
          className="mb-4 inline-flex items-center gap-1 text-sm text-text-muted hover:text-text-primary transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to My Projects
        </Link>

        {/* Title + actions row.
            On phones we stack the actions UNDER the title — otherwise the title
            (often a long sentence) gets squeezed into a single-word-per-line
            column while the action buttons hog the right half and one of them
            (Delete) clips off the viewport edge. See mobile audit, batch 3. */}
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h1 className="text-2xl font-bold text-text-primary break-words">
                {project.title}
              </h1>
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                  project.status === "open"
                    ? "bg-green-100 text-green-700"
                    : project.status === "awarded"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-gray-100 text-gray-600"
                }`}
              >
                {project.status === "open"
                  ? "Open"
                  : project.status === "awarded"
                    ? "Awarded"
                    : "Closed"}
              </span>
              {paidEstimateLive && (
                <span className="inline-flex items-center rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">
                  Paid Estimate
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-text-muted">
              Posted {new Date(project.created_at).toLocaleDateString()} •{" "}
              {bidCount} {bidCount === 1 ? "bid" : "bids"} received
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 md:shrink-0">
            <PrintProjectButton
              projectId={project.id}
              label="Print Project"
              title="Print or save your project posting as a PDF — handy for sharing with bidders offline"
            />
            <ProjectStatusActions
              projectId={project.id}
              currentStatus={project.status}
            />
          </div>
        </div>
      </div>

      {checkoutMessage && (
        <div className="mb-6 rounded-xl border border-border bg-surface px-5 py-4 text-sm text-text-primary shadow-sm ring-1 ring-amber-200">
          {checkoutMessage}
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Main Content */}
        <div className="space-y-6 lg:col-span-2">
          <PaidEstimatePoolPanel
            projectId={project.id}
            projectStatus={project.status}
            existingPool={paidPool}
          />

          {/* Description */}
          <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold text-text-primary">
              Description
            </h2>
            <RichTextRenderer
              content={project.description}
              className="text-text-secondary"
            />
          </section>

          {/* Completion Criteria — disabled; description + AI questions cover this */}

          <ProjectAiEstimatePanel
            projectId={project.id}
            estimate={
              aiEstimate
                ? {
                    status: aiEstimate.status,
                    scope_completeness_score: aiEstimate.scope_completeness_score,
                    confidence_level: aiEstimate.confidence_level,
                    summary: aiEstimate.summary,
                    baseline_low: aiEstimate.baseline_low,
                    baseline_high: aiEstimate.baseline_high,
                    assumptions_json: aiEstimate.assumptions_json,
                    exclusions_json: aiEstimate.exclusions_json,
                    missing_items_json: aiEstimate.missing_items_json,
                    recommended_questions_json:
                      aiEstimate.recommended_questions_json as ProjectAiRecommendedQuestion[],
                    trade_breakdown_json:
                      aiEstimate.trade_breakdown_json as ProjectAiTradeBreakdownItem[],
                    published_to_bidders: aiEstimate.published_to_bidders,
                    stale_after_edit: aiEstimate.stale_after_edit,
                    last_analyzed_at: aiEstimate.last_analyzed_at,
                    analysis_version: aiEstimate.analysis_version,
                  }
                : null
            }
            latestRunModelName={latestAiRun?.model_name || null}
            clarifications={
              (aiClarifications || []).map((clarification) => ({
                id: clarification.id,
                question_key: clarification.question_key,
                question_text: clarification.question_text,
                question_type: clarification.question_type,
                help_text: clarification.help_text,
                placeholder: clarification.placeholder,
                options_json: clarification.options_json as Array<{
                  id?: string;
                  label?: string;
                }>,
                answer_value_json: clarification.answer_value_json,
                status: clarification.status,
              }))
            }
            scopeItems={
              (aiScopeItems || []).map((item) => ({
                id: item.id,
                item_key: item.item_key,
                item_label: item.item_label,
                item_category: item.item_category,
                required_status: item.required_status,
                confidence_level: item.confidence_level,
                description: item.description,
                why_it_may_apply: item.why_it_may_apply,
                confidence_reason: item.confidence_reason,
                estimated_low: item.estimated_low,
                estimated_high: item.estimated_high,
                labor_low: item.labor_low,
                labor_high: item.labor_high,
                material_low: item.material_low,
                material_high: item.material_high,
                equipment_low: item.equipment_low,
                equipment_high: item.equipment_high,
                quantity_drivers_json:
                  item.quantity_drivers_json as ProjectAiScopeItemQuantityDriver[],
                evidence_signals_json:
                  item.evidence_signals_json as ProjectAiScopeItemEvidenceSignal[],
                assumptions_json: item.assumptions_json,
                exclusions_json: item.exclusions_json,
                source_method: item.source_method,
                needs_clarification: item.needs_clarification,
                customer_inclusion: item.customer_inclusion,
                material_calc_mode:
                  (item as { material_calc_mode?: string }).material_calc_mode === "add"
                    ? ("add" as const)
                    : ("multiply" as const),
                labor_calc_mode:
                  (item as { labor_calc_mode?: string }).labor_calc_mode === "add"
                    ? ("add" as const)
                    : ("multiply" as const),
              }))
            }
            itemClarifications={
              (aiItemClarifications || []).map((clarification) => ({
                id: clarification.id,
                scope_item_id: clarification.scope_item_id,
                question_key: clarification.question_key,
                question_text: clarification.question_text,
                question_type: clarification.question_type,
                help_text: clarification.help_text,
                placeholder: clarification.placeholder,
                options_json: clarification.options_json as Array<{
                  id?: string;
                  label?: string;
                }>,
                answer_value_json: clarification.answer_value_json,
                status: clarification.status,
              }))
            }
          />

          {/* Edit History */}
          {projectEdits && projectEdits.length > 0 && (
            <ProjectEditHistoryCollapsible edits={projectEdits} />
          )}

          {/* Project Photos & Documents with Annotation */}
          {projectFiles && projectFiles.length > 0 && (
            <ProjectPhotos files={projectFiles} />
          )}

          {(project.status === "awarded" || project.status === "completed") && (
            <section className="rounded-xl border border-secondary/30 bg-teal-50 p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-text-primary">
                {project.status === "completed"
                  ? "Project Completed"
                  : "Winning Bid Selected"}
              </h2>
              <p className="mt-2 text-sm text-text-secondary">
                {awardedProfile
                  ? `${awardedProfile.full_name}${awardedProfile.business_name ? ` • ${awardedProfile.business_name}` : ""}`
                  : "A winning contractor has been selected for this project."}
              </p>
              {project.awarded_at && (
                <p className="mt-1 text-xs text-text-muted">
                  Awarded on {new Date(project.awarded_at).toLocaleString()}
                </p>
              )}

              {/* "Leave a verified review" nudge — only render if we have an
                  awarded bidder and the customer hasn't already reviewed them
                  for this specific project. The link drops the customer onto
                  the contractor's public profile, where the existing
                  VerifiedReviewForm in the sidebar is preselected for this
                  project. */}
              {project.awarded_bidder_id && !customerVerifiedReviewedThisProject && (
                <div className="mt-4 rounded-lg border border-secondary/40 bg-white/70 p-4">
                  <p className="text-sm font-semibold text-text-primary">
                    How was working with {awardedProfile?.full_name || "this contractor"}? ⭐
                  </p>
                  <p className="mt-1 text-xs text-text-secondary">
                    Leaving a quick verified review helps future customers pick
                    great contractors with confidence — and helps this
                    contractor build their reputation.
                  </p>
                  <Link
                    href={`/profile/${project.awarded_bidder_id}`}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-secondary-dark"
                  >
                    Leave a Review
                  </Link>
                </div>
              )}

              {project.awarded_bidder_id && customerVerifiedReviewedThisProject && (
                <p className="mt-4 text-xs text-text-muted">
                  You&apos;ve already left a verified review for this project. Thanks for sharing your experience! 🙌
                </p>
              )}
            </section>
          )}

          {/* Bids Section */}
          <section className="rounded-xl border border-border bg-surface shadow-sm">
            <div className="border-b border-border px-6 py-4">
              <h2 className="text-lg font-semibold text-text-primary">
                Bids Received ({bids?.length || 0})
              </h2>
            </div>

            {bids && bids.length > 0 ? (
              <BidComparisonToggle bids={comparisonBids}>
              <div className="divide-y divide-border">
                {bids.map((bid) => {
                  const profile = profileMap.get(bid.bidder_id);
                  const creds = credentialMap.get(bid.bidder_id);
                  const badgeLevel = creds?.badge_level as BadgeLevel;
                  const badgeInfo = badgeLevel
                    ? BADGE_CONFIG[badgeLevel]
                    : null;
                  const hasCoreCheck = hasCoreCredentials(creds);
                  const bidFiles = (bid.bid_files || []) as {
                    id: string;
                    file_url: string;
                    file_name: string;
                    file_type: string;
                  }[];
                  const bidLineItems = bidLineItemsMap.get(bid.id) || [];
                  const specialtyLabels = specialtyMap.get(bid.bidder_id) || [];
                  const claim = claimMap.get(bid.id) || null;
                  const dispute = claim ? disputeMap.get(claim.id) || null : null;

                  const credChecks = [
                    { label: "License", url: creds?.license_url },
                    { label: "Bond", url: creds?.bond_url },
                    { label: "Insurance", url: creds?.insurance_url },
                    { label: "Workers' Comp", url: creds?.workers_comp_url },
                    { label: "EIN", url: creds?.ein_url },
                    { label: "References", url: creds?.references_url },
                  ];

                  return (
                    <div key={bid.id} className="p-4 sm:p-6">
                      {/* Bidder Header */}
                      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex min-w-0 items-start gap-3">
                          <Link
                            href={`/profile/${bid.bidder_id}`}
                            className="shrink-0"
                          >
                            {profile?.avatar_url ? (
                              <Image
                                src={profile.avatar_url}
                                alt={profile.full_name}
                                width={40}
                                height={40}
                                className="h-10 w-10 rounded-full object-cover border-2 border-white shadow"
                              />
                            ) : (
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                                <User className="h-5 w-5 text-primary" />
                              </div>
                            )}
                          </Link>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <Link
                                href={`/profile/${bid.bidder_id}`}
                                className="min-w-0 break-words font-semibold text-text-primary transition-colors hover:text-primary"
                              >
                                {profile?.full_name || "Unknown Bidder"}
                              </Link>
                              {hasCoreCheck && <CoreCredentialsCheck />}
                              {badgeInfo && (
                                <span
                                  className={`inline-flex items-center gap-1 rounded-full ${badgeInfo.bgColor} px-2 py-0.5 text-xs font-medium ${badgeInfo.color}`}
                                >
                                  {badgeInfo.icon} {badgeInfo.label}
                                </span>
                              )}
                            </div>
                            {profile?.business_name && (
                              <p className="break-words text-sm text-text-muted">
                                {profile.business_name}
                              </p>
                            )}
                            {specialtyLabels.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {specialtyLabels.slice(0, 4).map((label) => (
                                  <span
                                    key={`${bid.bidder_id}-${label}`}
                                    className="inline-flex items-center gap-1 rounded-full bg-secondary/10 px-2 py-0.5 text-[11px] font-medium text-secondary"
                                  >
                                    <BriefcaseBusiness className="h-3 w-3" />
                                    {label}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="rounded-lg bg-bg-warm px-4 py-3 sm:bg-transparent sm:px-0 sm:py-0 sm:text-right">
                          {project.awarded_bid_id === bid.id && (
                            <span className="mb-2 inline-flex items-center rounded-full bg-secondary/15 px-2.5 py-0.5 text-xs font-semibold text-secondary">
                              Winning Bid
                            </span>
                          )}
                          {claim && (
                            <div className="mb-2 flex flex-col items-start gap-1 sm:items-end">
                              <span
                                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                  claim.claim_status === "paid_reserved"
                                    ? "bg-primary/15 text-primary"
                                    : claim.claim_status === "disputed"
                                      ? "bg-amber-100 text-amber-800"
                                      : claim.claim_status === "payout_pending"
                                        ? "bg-blue-100 text-blue-700"
                                        : claim.claim_status === "paid_out"
                                          ? "bg-green-100 text-green-700"
                                          : "bg-gray-100 text-gray-600"
                                }`}
                              >
                                {claim.claim_status === "paid_reserved"
                                  ? "Paid Slot Reserved"
                                  : claim.claim_status === "disputed"
                                    ? "Under Dispute Review"
                                    : claim.claim_status === "payout_pending"
                                      ? "Payout Pending"
                                      : claim.claim_status === "paid_out"
                                        ? "Paid Out"
                                        : "Unpaid Bid"}
                              </span>
                              {claim.claim_status === "paid_reserved" &&
                                claim.payout_due_at && (
                                  <span className="text-[11px] text-text-muted">
                                    Auto-pays after{" "}
                                    {new Date(
                                      claim.payout_due_at
                                    ).toLocaleString()}
                                  </span>
                                )}
                            </div>
                          )}
                          <p className="text-2xl font-bold text-secondary">
                            ${Number(bid.price).toLocaleString()}
                          </p>
                          <p className="text-xs text-text-muted">
                            {TRADE_LABELS[bid.trade as TradeCategory]}
                          </p>
                        </div>
                      </div>

                      {/* Bid Details — stack on phones, side-by-side at sm+. */}
                      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="rounded-lg bg-bg-warm px-4 py-3">
                          <p className="text-xs text-text-muted">Timeline</p>
                          <p className="text-sm font-medium text-text-primary">
                            {bid.estimated_timeline}
                          </p>
                        </div>
                        <div className="rounded-lg bg-bg-warm px-4 py-3">
                          <p className="text-xs text-text-muted">
                            Can Start
                          </p>
                          <p className="text-sm font-medium text-text-primary">
                            {new Date(
                              bid.estimated_start_date
                            ).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      {bid.notes && (
                        <div className="mb-4 rounded-lg bg-bg-warm px-4 py-3">
                          <p className="text-xs text-text-muted mb-1">Notes</p>
                          <RichTextRenderer
                            content={bid.notes}
                            className="text-sm text-text-secondary"
                          />
                        </div>
                      )}

                      {bid.price_breakdown && (
                        <div className="mb-4 rounded-lg bg-bg-warm px-4 py-3">
                          <p className="text-xs text-text-muted mb-1">
                            Price Breakdown
                          </p>
                          <p className="text-sm text-text-secondary whitespace-pre-wrap">
                            {bid.price_breakdown}
                          </p>
                        </div>
                      )}

                      {bidLineItems.length > 0 && (
                        <div className="mb-4">
                          <BidLineItemsTable lineItems={bidLineItems} />
                        </div>
                      )}

                      {bidFiles.length > 0 && (
                        <div className="mb-4">
                          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-muted">
                            Bid Attachments
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {bidFiles.map((file) => (
                              <a
                                key={file.id}
                                href={file.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-accent-light hover:bg-surface-hover hover:text-accent transition-colors"
                              >
                                <FileText className="h-3.5 w-3.5" />
                                {file.file_name}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Contact Info — wrap on mobile so long emails don't push overflow. */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                        {profile?.email && (
                          <a
                            href={`mailto:${profile.email}`}
                            className="flex items-center gap-1 text-accent-light hover:text-accent transition-colors"
                          >
                            <Mail className="h-4 w-4" />
                            {profile.email}
                          </a>
                        )}
                        {profile?.phone && (
                          <a
                            href={`tel:${profile.phone}`}
                            className="flex items-center gap-1 text-primary hover:text-primary-dark transition-colors"
                          >
                            <Phone className="h-4 w-4" />
                            {profile.phone}
                          </a>
                        )}
                        <Link
                          href={`/customer/messages/${id}/${bid.bidder_id}`}
                          className="flex items-center gap-1 rounded-lg bg-secondary/10 px-3 py-1.5 text-secondary hover:bg-secondary/20 transition-colors font-medium"
                        >
                          <MessageSquare className="h-4 w-4" />
                          Message
                        </Link>
                        {project.status === "open" && (
                          <AwardBidButton
                            projectId={project.id}
                            bidId={bid.id}
                            bidderName={profile?.full_name || "this contractor"}
                          />
                        )}
                      </div>

                      {/* Bid date stamp */}
                      <p className="mt-3 text-xs text-text-muted">
                        Bid submitted:{" "}
                        {new Date(bid.created_at).toLocaleString()}
                      </p>

                      {claim?.claim_status === "paid_reserved" && !dispute && (
                        <DisputePaidEstimateButton claimId={claim.id} />
                      )}

                      {dispute && (
                        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                          <p className="font-semibold">
                            Paid estimate dispute is open
                          </p>
                          <p className="mt-1">
                            Reason: {dispute.reason.replace(/_/g, " ")}.
                          </p>
                          {dispute.customer_message && (
                            <p className="mt-1 text-amber-900">
                              Notes: {dispute.customer_message}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Credential Checks */}
                      <div className="mt-4">
                        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-muted">
                          Qualifications
                        </p>
                        <CredentialChecklist items={credChecks} />
                      </div>
                    </div>
                  );
                })}
              </div>
              </BidComparisonToggle>
            ) : (
              <div className="px-6 py-12 text-center">
                <ClipboardCheck className="mx-auto h-10 w-10 text-text-muted/40" />
                <p className="mt-3 text-sm text-text-muted">
                  No bids yet. Contractors will see your project and start
                  bidding!
                </p>
              </div>
            )}
          </section>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Info */}
          <div className="rounded-xl border border-border bg-surface p-6 shadow-sm space-y-4">
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

            <ProjectAddressMap
              address={project.location_address}
              city={project.location_city}
              state={project.location_state}
              zip={project.location_zip}
              heading=""
              linkBehavior="view"
            />

            {project.desired_start_date && (
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-text-muted shrink-0" />
                <div>
                  <p className="text-xs text-text-muted">Desired Start</p>
                  <p className="text-sm font-medium text-text-primary">
                    {new Date(
                      project.desired_start_date
                    ).toLocaleDateString()}
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

          {/* Expertise Level */}
          <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-text-primary">
              Level of Professional Needed
            </h3>
            {project.expertise_level ? (
              <span className="inline-block rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
                {EXPERTISE_LEVEL_LABELS[project.expertise_level as ExpertiseLevel]}
              </span>
            ) : (project.trades as TradeCategory[]).length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {(project.trades as TradeCategory[]).map((trade) => (
                  <span
                    key={trade}
                    className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                  >
                    {TRADE_LABELS[trade]}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-sm text-text-muted">Not specified</span>
            )}
          </div>

          {/* Q&A */}
          <ProjectQA
            projectId={id}
            questions={formattedQuestions}
            currentUserId={user.id}
            isProjectOwner={true}
          />
        </div>
      </div>
    </div>
  );
}
