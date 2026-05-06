import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { userHasRole } from "@/lib/auth/roles";
import {
  ClipboardList,
  FolderOpen,
  Shield,
  MessageSquare,
  Star,
  ArrowRight,
  WalletCards,
} from "lucide-react";
import { BADGE_CONFIG } from "@/lib/badges";
import {
  BIDDER_PAYOUT_READINESS_LABELS,
  getBidderPayoutReadiness,
} from "@/lib/paid-estimates/payout-accounts";
import ProjectStatusPill from "@/components/project/ProjectStatusPill";
import HelpHint from "@/components/help/HelpHint";
import { TRADE_LABELS } from "@/types/database";
import type {
  BadgeLevel,
  BidderPayoutAccount,
  TradeCategory,
} from "@/types/database";

export default async function BidderDashboard() {
  const supabase = await createClient();
  const admin = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!profile || !(await userHasRole(user.id, "bidder"))) redirect("/login");

  const { data: credentials } = await supabase
    .from("bidder_credentials")
    .select("*")
    .eq("user_id", user.id)
    .single();

  const { data: bidRows, count: bidCount } = await supabase
    .from("bids")
    .select("*", { count: "exact" })
    .eq("bidder_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5);

  const bids = bidRows || [];
  const bidProjectIds = Array.from(new Set(bids.map((bid) => bid.project_id)));

  const { count: openProjectCount } = await supabase
    .from("projects")
    .select("*", { count: "exact", head: true })
    .eq("status", "open");

  const { count: unreadMessages } = await supabase
    .from("messages")
    .select("*", { count: "exact", head: true })
    .eq("receiver_id", user.id)
    .eq("read", false);

  const [{ data: payoutAccountRow }, { count: payoutPendingCount }, { data: bidProjects }] =
    await Promise.all([
      admin
        .from("bidder_payout_accounts")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle(),
      admin
        .from("paid_estimate_claims")
        .select("*", { count: "exact", head: true })
        .eq("bidder_id", user.id)
        .eq("claim_status", "payout_pending"),
      bidProjectIds.length
        ? supabase
            .from("projects")
            .select("id, title, status, location_city, location_state")
            .in("id", bidProjectIds)
        : Promise.resolve({ data: [] }),
    ]);

  const badgeLevel = credentials?.badge_level as BadgeLevel;
  const badgeInfo = badgeLevel ? BADGE_CONFIG[badgeLevel] : null;
  const payoutAccount =
    (payoutAccountRow as BidderPayoutAccount | null | undefined) || null;
  const payoutReadiness = getBidderPayoutReadiness(payoutAccount);
  const bidProjectMap = new Map(
    (bidProjects || []).map((project) => [project.id, project])
  );

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            Welcome back, {profile.full_name.split(" ")[0]}! 👷
          </h1>
          <p className="mt-1 text-text-secondary">
            Here&apos;s your bidding activity at a glance.
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

      {/* Badge & Credential Status */}
      {credentials && (
        <div className="mb-8 rounded-xl border border-border bg-surface p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              {badgeInfo ? (
                <div
                  className={`flex items-center gap-2 rounded-full ${badgeInfo.bgColor} px-4 py-2`}
                >
                  <span className="text-xl">{badgeInfo.icon}</span>
                  <span className={`text-sm font-semibold ${badgeInfo.color}`}>
                    {badgeInfo.label}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-full bg-gray-100 px-4 py-2">
                  <Star className="h-5 w-5 text-gray-400" />
                  <span className="text-sm font-medium text-gray-500">
                    No Badge Yet
                  </span>
                </div>
              )}
              <p className="text-sm text-text-muted">
                Upload credentials to earn a higher badge and stand out to
                customers.
              </p>
            </div>
            <Link
              href="/bidder/credentials"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary transition-colors hover:text-primary-dark"
            >
              Manage Credentials
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}

      <div className="mb-8 rounded-xl border border-border bg-surface p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary/10">
              <WalletCards className="h-6 w-6 text-secondary" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold text-text-primary">
                  Payout Readiness
                </h2>
                <HelpHint
                  id="payout-readiness-explainer"
                  variant="icon"
                  title="What is Payout Readiness?"
                >
                  This shows whether your <strong>Stripe payout account</strong>{" "}
                  is set up to receive money. We use it for{" "}
                  <strong>Paid Estimates</strong> — when a customer funds a
                  Paid Estimate Pool and you submit a real bid, you earn a
                  small reward that gets paid out through Stripe. <br />
                  <br />
                  <strong>Not Connected</strong> = no Stripe account linked
                  yet. <strong>Restricted</strong> = Stripe needs more info
                  (e.g., tax ID, bank verification). <strong>Ready</strong> =
                  good to go. Bid all you want without it; you just won&apos;t
                  collect paid-estimate rewards until Stripe says ready.
                </HelpHint>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    payoutReadiness === "ready"
                      ? "bg-green-100 text-green-700"
                      : payoutReadiness === "restricted"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {BIDDER_PAYOUT_READINESS_LABELS[payoutReadiness]}
                </span>
                {(payoutPendingCount || 0) > 0 && (
                  <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                    {payoutPendingCount} payout{payoutPendingCount === 1 ? "" : "s"} queued
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-text-muted">
                Connect Stripe onboarding when you are ready so paid estimates
                can move from queued to real payout operations later.
              </p>
            </div>
          </div>
          <Link
            href="/bidder/payouts"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary-dark transition-colors"
          >
            Manage Payouts
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <ClipboardList className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-text-primary">
                {bidCount || 0}
              </p>
              <p className="text-sm text-text-muted">Total Bids Placed</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/10">
              <FolderOpen className="h-5 w-5 text-secondary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-text-primary">
                {openProjectCount || 0}
              </p>
              <p className="text-sm text-text-muted">Open Projects</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
              <Shield className="h-5 w-5 text-amber-700" />
            </div>
            <div>
              <p className="text-2xl font-bold text-text-primary capitalize">
                {badgeLevel || "None"}
              </p>
              <p className="text-sm text-text-muted">Badge Level</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
              <MessageSquare className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-text-primary">
                {unreadMessages || 0}
              </p>
              <p className="text-sm text-text-muted">Unread Messages</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-8">
        <Link
          href="/bidder/projects"
          className="flex w-full items-center justify-center gap-3 rounded-xl bg-secondary px-6 py-5 text-base font-bold text-white shadow-lg shadow-secondary/20 transition-all hover:-translate-y-0.5 hover:bg-secondary-dark hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-secondary/30 sm:text-lg"
        >
          <FolderOpen className="h-5 w-5" />
          Browse Projects
          <ArrowRight className="h-5 w-5" />
        </Link>
      </div>

      {/* Recent Bids */}
      <div className="rounded-xl border border-border bg-surface shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-6">
          <h2 className="text-lg font-semibold text-text-primary">
            Recent Bids
          </h2>
          <Link
            href="/bidder/bids"
            className="text-sm font-medium text-primary hover:text-primary-dark transition-colors"
          >
            View All →
          </Link>
        </div>
        {bids && bids.length > 0 ? (
          <div className="divide-y divide-border">
            {bids.map((bid) => {
              const project = bidProjectMap.get(bid.project_id) as
                | {
                    id: string;
                    title: string;
                    status: string;
                    location_city: string;
                    location_state: string;
                  }
                | undefined;

              if (!project) {
                return null;
              }

              return (
                <div
                  key={bid.id}
                  className="flex flex-col gap-3 px-4 py-4 transition-colors hover:bg-surface-hover sm:flex-row sm:items-center sm:justify-between sm:px-6"
                >
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-medium text-text-primary truncate">
                      {project.title}
                    </h3>
                    <p className="mt-0.5 text-xs text-text-muted">
                      {project.location_city}, {project.location_state} •{" "}
                      {TRADE_LABELS[bid.trade as TradeCategory]} •{" "}
                      {new Date(bid.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex w-full flex-wrap items-center justify-between gap-3 sm:ml-4 sm:w-auto sm:justify-start sm:gap-4">
                    <span className="text-money text-sm font-semibold">
                      ${Number(bid.price).toLocaleString()}
                    </span>
                    <ProjectStatusPill status={project.status} />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="px-6 py-12 text-center">
            <ClipboardList className="mx-auto h-12 w-12 text-text-muted/40" />
            <p className="mt-4 text-sm font-medium text-text-secondary">
              No bids yet
            </p>
            <p className="mt-1 text-sm text-text-muted">
              Browse open projects and submit your first bid!
            </p>
            <Link
              href="/bidder/projects"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-secondary px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-secondary-dark transition-colors"
            >
              <FolderOpen className="h-4 w-4" />
              Browse Projects
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
