import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
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
  PaidEstimateClaim,
  TradeCategory,
} from "@/types/database";
import { userHasRole } from "@/lib/auth/roles";
import {
  BIDDER_PAYOUT_READINESS_LABELS,
  getBidderPayoutReadiness,
} from "@/lib/paid-estimates/payout-accounts";

export default async function MyBidsPage() {
  const supabase = await createClient();
  const admin = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  if (!(await userHasRole(user.id, "bidder"))) redirect("/login");

  const { data: bids } = await supabase
    .from("bids")
    .select(
      "*, bid_files(*), projects!inner(title, status, location_city, location_state, trades, awarded_bid_id)"
    )
    .eq("bidder_id", user.id)
    .order("created_at", { ascending: false });

  const bidIds = (bids || []).map((bid) => bid.id);
  const [{ data: claimRows }, { data: payoutAccountRow }] = await Promise.all([
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
  ]);

  const claimMap = new Map(
    ((claimRows || []) as PaidEstimateClaim[]).map((claim) => [claim.bid_id, claim])
  );
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
          <h1 className="text-2xl font-bold text-text-primary">My Bids 📋</h1>
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
        <div className="mb-6 rounded-xl border border-secondary/20 bg-secondary/5 px-4 py-3 text-sm text-text-secondary">
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
            const project = bid.projects as unknown as {
              title: string;
              status: string;
              location_city: string;
              location_state: string;
              trades: TradeCategory[];
              awarded_bid_id: string | null;
            };
            const bidFiles = bid.bid_files as unknown as {
              id: string;
              file_url: string;
              file_name: string;
              file_type: string;
            }[];
            const claim = claimMap.get(bid.id) || null;

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
                          project.status === "open"
                            ? "bg-green-100 text-green-700"
                            : project.status === "awarded" && project.awarded_bid_id === bid.id
                              ? "bg-secondary/15 text-secondary"
                              : project.status === "awarded"
                                ? "bg-amber-100 text-amber-700"
                              : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {project.status === "open"
                          ? "Open"
                          : project.status === "awarded" && project.awarded_bid_id === bid.id
                            ? "Awarded to You"
                            : project.status === "awarded"
                              ? "Awarded Elsewhere"
                            : "Closed"}
                      </span>
                    </div>

                    <div className="mt-3 grid gap-2 text-sm text-text-muted sm:mt-2 sm:flex sm:flex-wrap sm:items-center sm:gap-4 sm:text-xs">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {project.location_city}, {project.location_state}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        Bid submitted{" "}
                        {new Date(bid.created_at).toLocaleDateString()}
                      </span>
                      {claim && (
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
                          {claim.claim_status.replace(/_/g, " ")}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg bg-bg-warm px-4 py-3 sm:ml-6 sm:shrink-0 sm:bg-transparent sm:px-0 sm:py-0 sm:text-right">
                    <p className="text-xl font-bold text-primary sm:text-2xl">
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
                    <p className="text-sm text-text-secondary whitespace-pre-wrap line-clamp-3">
                      {bid.notes}
                    </p>
                  </div>
                )}

                {claim && (
                  <div className="mt-3 grid gap-3 rounded-lg bg-bg-warm px-4 py-3 text-sm text-text-secondary sm:grid-cols-3">
                    <div>
                      <p className="text-xs text-text-muted">Paid Estimate Reward</p>
                      <p className="font-medium text-text-primary">
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
