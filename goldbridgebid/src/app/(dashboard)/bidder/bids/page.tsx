import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import RichTextRenderer from "@/components/ui/RichTextRenderer";
import {
  ClipboardList,
  FolderOpen,
  MapPin,
  Calendar,
  FileText,
} from "lucide-react";
import { TRADE_LABELS } from "@/types/database";
import type {
  BidderPayoutAccount,
  BidLineItem,
  PaidEstimateClaim,
  TradeCategory,
} from "@/types/database";
import BidLineItemsTable from "@/components/bids/BidLineItemsTable";
import { userHasRole } from "@/lib/auth/roles";
import {
  BIDDER_PAYOUT_READINESS_LABELS,
  getBidderPayoutReadiness,
} from "@/lib/paid-estimates/payout-accounts";
import {
  PAID_ESTIMATE_CLAIM_STATUS_DESCRIPTIONS,
  getPaidEstimateClaimStatusLabel,
} from "@/lib/paid-estimates/claim-status";
import HelpHint from "@/components/help/HelpHint";

export default async function MyBidsPage() {
  const supabase = await createClient();
  const admin = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  if (!(await userHasRole(user.id, "bidder"))) redirect("/login");

  const { data: bidRows } = await supabase
    .from("bids")
    .select("*")
    .eq("bidder_id", user.id)
    .order("created_at", { ascending: false });

  const bids = bidRows || [];
  const bidIds = bids.map((bid) => bid.id);
  const projectIds = Array.from(new Set(bids.map((bid) => bid.project_id)));
  const [
    { data: claimRows },
    { data: payoutAccountRow },
    { data: projectRows },
    { data: bidFileRows },
    { data: bidLineItemRows },
  ] = await Promise.all([
    bidIds.length
      ? admin
          .from("paid_estimate_claims")
          .select("*")
          .in("bid_id", bidIds)
      : Promise.resolve({ data: [] }),
    admin
      .from("bidder_payout_accounts")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle(),
    projectIds.length
      ? supabase
          .from("projects")
          .select("id, title, status, location_city, location_state, trades, awarded_bid_id, customer_id")
          .in("id", projectIds)
      : Promise.resolve({ data: [] }),
    bidIds.length
      ? supabase
          .from("bid_files")
          .select("*")
          .in("bid_id", bidIds)
      : Promise.resolve({ data: [] }),
    bidIds.length
      ? supabase
          .from("bid_line_items")
          .select("*")
          .in("bid_id", bidIds)
          .order("display_order", { ascending: true })
      : Promise.resolve({ data: [] }),
  ]);

  const claimMap = new Map(
    ((claimRows || []) as PaidEstimateClaim[]).map((claim) => [claim.bid_id, claim])
  );
  const projectMap = new Map(
    (projectRows || []).map((project) => [project.id, project])
  );

  // Find every project where this bidder has already left a verified review
  // so we can suppress the "Leave a Review" nudge on bids tied to those
  // projects. We query in a single round-trip for all the bidder's projects.
  const { data: existingVerifiedReviewRows } = projectIds.length
    ? await supabase
        .from("user_reviews")
        .select("project_id")
        .eq("reviewer_user_id", user.id)
        .eq("review_type", "verified_platform")
        .in("project_id", projectIds)
    : { data: [] };

  const reviewedProjectIds = new Set(
    (existingVerifiedReviewRows || [])
      .map((row) => row.project_id)
      .filter((id): id is string => Boolean(id))
  );
  const bidFilesMap = new Map<string, {
    id: string;
    file_url: string;
    file_name: string;
    file_type: string;
  }[]>();
  for (const file of bidFileRows || []) {
    const existing = bidFilesMap.get(file.bid_id) || [];
    existing.push(file);
    bidFilesMap.set(file.bid_id, existing);
  }
  const bidLineItemsMap = new Map<string, BidLineItem[]>();
  for (const lineItem of (bidLineItemRows || []) as BidLineItem[]) {
    const existing = bidLineItemsMap.get(lineItem.bid_id) || [];
    existing.push(lineItem);
    bidLineItemsMap.set(lineItem.bid_id, existing);
  }
  const payoutAccount =
    (payoutAccountRow as BidderPayoutAccount | null | undefined) || null;
  const payoutReadiness = getBidderPayoutReadiness(payoutAccount);
  const queuedPayouts = (claimRows || []).filter(
    (claim) => claim.claim_status === "payout_pending"
  ).length;

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-text-primary">My Bids 📋</h1>
            <HelpHint
              id="my-bids-claim-status-overview"
              variant="icon"
              title="What do the colored status chips mean?"
            >
              Each bid you submit on a Paid Estimate project gets a{" "}
              <strong>claim status</strong> that tracks whether you&apos;ll
              earn the reward and when it pays out. Hover the small{" "}
              <span className="inline-flex items-center rounded-full bg-amber-50 px-1.5 py-0.5 text-amber-700">
                💡
              </span>{" "}
              icon next to any status to see what that specific stage
              means. <br />
              <br />
              Common stages: <strong>Reserved</strong> → review window →{" "}
              <strong>Payout Queued</strong> → <strong>Paid Out</strong>.
            </HelpHint>
          </div>
          <p className="mt-1 text-text-secondary">
            Track all your bid submissions and their project status.
          </p>
        </div>
        <Link
          href="/bidder/projects"
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-secondary px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-secondary-dark sm:w-auto sm:py-2.5"
        >
          <FolderOpen className="h-4 w-4" />
          Browse Projects
        </Link>
      </div>

      {queuedPayouts > 0 && (
        <div className="mb-6 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text-secondary shadow-sm ring-1 ring-secondary/25">
          <span className="font-semibold text-text-primary">
            {queuedPayouts} paid estimate payout{queuedPayouts === 1 ? "" : "s"} queued.
          </span>{" "}
          Current payout readiness:{" "}
          <span className="font-semibold text-secondary">
            {BIDDER_PAYOUT_READINESS_LABELS[payoutReadiness]}
          </span>
          .{" "}
          <Link href="/bidder/payouts" className="text-primary hover:underline">
            Manage payout setup
          </Link>
        </div>
      )}

      {bids && bids.length > 0 ? (
        <div className="space-y-4">
          {bids.map((bid) => {
            const project = projectMap.get(bid.project_id) as
              | {
                  id: string;
                  title: string;
                  status: string;
                  location_city: string;
                  location_state: string;
                  trades: TradeCategory[];
                  awarded_bid_id: string | null;
                  customer_id: string;
                }
              | undefined;
            const bidFiles = bidFilesMap.get(bid.id) || [];
            const bidLineItems = bidLineItemsMap.get(bid.id) || [];
            const claim = claimMap.get(bid.id) || null;

            if (!project) {
              return null;
            }

            const projectDetails = project as {
              title: string;
              status: string;
              location_city: string;
              location_state: string;
              trades: TradeCategory[];
              awarded_bid_id: string | null;
              customer_id: string;
            };

            // Bidder is eligible to leave a verified review when the project
            // was awarded to THIS bid (i.e. the bidder won) and they haven't
            // already submitted a verified review for this project.
            const isAwardedToMe =
              projectDetails.awarded_bid_id === bid.id &&
              (projectDetails.status === "awarded" ||
                projectDetails.status === "completed");
            const showLeaveReviewCta =
              isAwardedToMe && !reviewedProjectIds.has(project.id);
            const alreadyReviewedAwarded =
              isAwardedToMe && reviewedProjectIds.has(project.id);

            return (
              <div
                key={bid.id}
                className="rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-6"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                      <Link
                        href={`/bidder/projects/${bid.project_id}`}
                        className="text-lg font-semibold leading-tight text-text-primary transition-colors hover:text-primary"
                      >
                        {project.title}
                      </Link>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          projectDetails.status === "open"
                            ? "bg-green-100 text-green-700"
                            : projectDetails.status === "awarded" && projectDetails.awarded_bid_id === bid.id
                              ? "bg-secondary/15 text-secondary"
                              : projectDetails.status === "awarded"
                                ? "bg-amber-100 text-amber-700"
                              : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {projectDetails.status === "open"
                          ? "Open"
                          : projectDetails.status === "awarded" && projectDetails.awarded_bid_id === bid.id
                            ? "Awarded to You"
                            : projectDetails.status === "awarded"
                              ? "Awarded Elsewhere"
                            : "Closed"}
                      </span>
                    </div>

                    <div className="mt-3 grid gap-2 text-sm text-text-muted sm:mt-2 sm:flex sm:flex-wrap sm:items-center sm:gap-4 sm:text-xs">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {projectDetails.location_city}, {projectDetails.location_state}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        Bid submitted{" "}
                        {new Date(bid.created_at).toLocaleDateString()}
                      </span>
                      {claim && (
                        <span className="inline-flex items-center gap-1">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              claim.claim_status === "paid_out"
                                ? "bg-green-100 text-green-700"
                                : claim.claim_status === "payout_pending"
                                  ? "bg-blue-100 text-blue-700"
                                  : claim.claim_status === "disputed"
                                    ? "bg-amber-100 text-amber-800"
                                    : claim.claim_status === "payout_denied_refunded"
                                      ? "bg-red-100 text-red-700"
                                      : claim.claim_status === "paid_reserved"
                                        ? "bg-primary/10 text-primary"
                                        : "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {getPaidEstimateClaimStatusLabel(claim.claim_status)}
                          </span>
                          {/* Per-row HelpHint that explains exactly what THIS
                              status means. We pass no `id` so the chip
                              stays available — the label changes per row,
                              so we don't want a single dismissal to hide
                              all of them at once. */}
                          <HelpHint
                            variant="icon"
                            title={getPaidEstimateClaimStatusLabel(
                              claim.claim_status
                            )}
                            align="right"
                            className="-ml-0.5"
                          >
                            {PAID_ESTIMATE_CLAIM_STATUS_DESCRIPTIONS[
                              claim.claim_status
                            ] ||
                              "Unknown status. Reach out to support if this looks wrong."}
                          </HelpHint>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg bg-bg-warm px-4 py-3 sm:ml-6 sm:shrink-0 sm:bg-transparent sm:px-0 sm:py-0 sm:text-right">
                    <p className="text-money text-xl font-bold sm:text-2xl">
                      ${Number(bid.price).toLocaleString()}
                    </p>
                    <span className="mt-2 inline-flex rounded-full bg-secondary/10 px-2.5 py-0.5 text-xs font-medium text-secondary">
                      {TRADE_LABELS[bid.trade as TradeCategory]}
                    </span>
                  </div>
                </div>

                {/* Bid Details */}
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
                  <div className="rounded-lg bg-bg-warm px-3 py-2">
                    <p className="text-xs text-text-muted">Timeline</p>
                    <p className="text-sm font-medium text-text-primary">
                      {bid.estimated_timeline}
                    </p>
                  </div>
                  <div className="rounded-lg bg-bg-warm px-3 py-2">
                    <p className="text-xs text-text-muted">Can Start</p>
                    <p className="text-sm font-medium text-text-primary">
                      {new Date(bid.estimated_start_date).toLocaleDateString()}
                    </p>
                  </div>
                  {bid.price_breakdown && (
                    <div className="rounded-lg bg-bg-warm px-3 py-2 sm:col-span-2">
                      <p className="text-xs text-text-muted">Price Breakdown</p>
                      <p className="text-sm text-text-secondary whitespace-pre-wrap line-clamp-2">
                        {bid.price_breakdown}
                      </p>
                    </div>
                  )}
                </div>

                {bid.notes && (
                  <div className="mt-3 rounded-lg bg-bg-warm px-4 py-3">
                    <p className="text-xs text-text-muted mb-1">Your Notes</p>
                    <RichTextRenderer
                      content={bid.notes}
                      className="text-sm text-text-secondary line-clamp-3"
                    />
                  </div>
                )}

                {bidLineItems.length > 0 && (
                  <div className="mt-3">
                    <BidLineItemsTable
                      lineItems={bidLineItems}
                      title="Your Quick Bid Line Items"
                      compact
                    />
                  </div>
                )}

                {claim && (
                  <div className="mt-3 grid gap-3 rounded-lg bg-bg-warm px-4 py-3 text-sm text-text-secondary sm:grid-cols-3">
                    <div>
                      <p className="text-xs text-text-muted">Paid Estimate Reward</p>
                      <p className="text-money font-medium">
                        {claim.reward_amount
                          ? `$${Number(claim.reward_amount).toLocaleString()}`
                          : "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-text-muted">Payout Due</p>
                      <p className="font-medium text-text-primary">
                        {claim.payout_due_at
                          ? new Date(claim.payout_due_at).toLocaleString()
                          : "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-text-muted">Paid Out</p>
                      <p className="font-medium text-text-primary">
                        {claim.paid_out_at
                          ? new Date(claim.paid_out_at).toLocaleString()
                          : "Not yet"}
                      </p>
                    </div>
                  </div>
                )}

                {/* "Leave a Review" prompt — only on bids that were awarded
                    to this bidder and where the bidder hasn't yet posted a
                    verified review for the customer on this project. The CTA
                    drops them onto the customer's public profile, where the
                    existing VerifiedReviewForm in the sidebar handles the
                    actual submission. */}
                {showLeaveReviewCta && (
                  <div className="mt-3 flex flex-col gap-3 rounded-lg border border-secondary/30 bg-teal-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-text-primary">
                        How was working with this customer? ⭐
                      </p>
                      <p className="mt-0.5 text-xs text-text-secondary">
                        Leave a quick verified review — it helps fellow
                        contractors vet customers in the future.
                      </p>
                    </div>
                    <Link
                      href={`/profile/${projectDetails.customer_id}`}
                      className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-secondary px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-secondary-dark"
                    >
                      Leave a Review
                    </Link>
                  </div>
                )}

                {alreadyReviewedAwarded && (
                  <p className="mt-3 text-xs text-text-muted">
                    You&apos;ve already left a verified review for this customer on this project. 🙌
                  </p>
                )}

                {/* Bid Files */}
                {bidFiles && bidFiles.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {bidFiles.map((file) => (
                      <a
                        key={file.id}
                        href={file.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-text-secondary hover:bg-surface-hover transition-colors"
                      >
                        <FileText className="h-3 w-3" />
                        {file.file_name}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface py-16 text-center shadow-sm">
          <ClipboardList className="mx-auto h-12 w-12 text-text-muted/40" />
          <p className="mt-4 text-lg font-medium text-text-secondary">
            No bids yet
          </p>
          <p className="mt-1 text-sm text-text-muted">
            Browse open projects and submit your first bid!
          </p>
          <Link
            href="/bidder/projects"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-secondary px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-secondary-dark transition-colors"
          >
            <FolderOpen className="h-4 w-4" />
            Browse Projects
          </Link>
        </div>
      )}
    </div>
  );
}
