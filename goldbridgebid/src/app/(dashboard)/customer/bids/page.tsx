import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BriefcaseBusiness,
  Calendar,
  ClipboardList,
  FileText,
  FolderOpen,
  User,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { userHasRole } from "@/lib/auth/roles";
import { BADGE_CONFIG, hasCoreCredentials } from "@/lib/badges";
import CoreCredentialsCheck from "@/components/credentials/CoreCredentialsCheck";
import RichTextRenderer from "@/components/ui/RichTextRenderer";
import BidLineItemsTable from "@/components/bids/BidLineItemsTable";
import { TRADE_LABELS } from "@/types/database";
import type { BadgeLevel, BidLineItem, TradeCategory } from "@/types/database";

type BidWithProject = {
  id: string;
  project_id: string;
  bidder_id: string;
  trade: TradeCategory;
  price: number;
  price_breakdown: string | null;
  estimated_timeline: string;
  estimated_start_date: string;
  notes: string | null;
  created_at: string;
  bid_files?: {
    id: string;
    file_url: string;
    file_name: string;
    file_type: string;
  }[];
  projects: {
    id: string;
    title: string;
    status: string;
    awarded_bid_id: string | null;
  } | null;
};

export default async function CustomerBidsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  if (!(await userHasRole(user.id, "customer"))) redirect("/login");

  const { data: bidRows } = await supabase
    .from("bids")
    .select(
      "*, bid_files(*), projects!bids_project_id_fkey(id, title, status, awarded_bid_id)"
    )
    .order("created_at", { ascending: false });

  const bids = ((bidRows || []) as BidWithProject[]).filter((bid) => bid.projects);
  const bidIds = bids.map((bid) => bid.id);
  const bidderIds = Array.from(new Set(bids.map((bid) => bid.bidder_id)));

  const [
    { data: bidderProfiles },
    { data: bidderCredentials },
    { data: bidderSpecialties },
    { data: bidLineItemRows },
  ] = await Promise.all([
    bidderIds.length
      ? supabase
          .from("profiles")
          .select("user_id, full_name, business_name, avatar_url, email, phone")
          .in("user_id", bidderIds)
      : Promise.resolve({ data: [] }),
    bidderIds.length
      ? supabase.from("bidder_credentials").select("*").in("user_id", bidderIds)
      : Promise.resolve({ data: [] }),
    bidderIds.length
      ? supabase
          .from("bidder_specialties")
          .select("user_id, trade, display_order")
          .in("user_id", bidderIds)
          .order("display_order", { ascending: true })
      : Promise.resolve({ data: [] }),
    bidIds.length
      ? supabase
          .from("bid_line_items")
          .select("*")
          .in("bid_id", bidIds)
          .order("display_order", { ascending: true })
      : Promise.resolve({ data: [] }),
  ]);

  const profileMap = new Map(
    (bidderProfiles || []).map((profile) => [profile.user_id, profile])
  );
  const credentialMap = new Map(
    (bidderCredentials || []).map((credential) => [credential.user_id, credential])
  );
  const specialtyMap = new Map<string, string[]>();
  for (const specialty of bidderSpecialties || []) {
    const current = specialtyMap.get(specialty.user_id) || [];
    current.push(TRADE_LABELS[specialty.trade as TradeCategory]);
    specialtyMap.set(specialty.user_id, current);
  }
  const bidLineItemsMap = new Map<string, BidLineItem[]>();
  for (const lineItem of (bidLineItemRows || []) as BidLineItem[]) {
    const current = bidLineItemsMap.get(lineItem.bid_id) || [];
    current.push(lineItem);
    bidLineItemsMap.set(lineItem.bid_id, current);
  }

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-text-primary">
            <ClipboardList className="h-6 w-6 text-primary" />
            My Bids
          </h1>
          <p className="mt-1 text-text-secondary">
            Review every bid your projects have received in one place.
          </p>
        </div>
        <Link
          href="/customer/projects"
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-surface px-5 py-2.5 text-sm font-semibold text-text-primary shadow-sm transition-colors hover:bg-surface-hover"
        >
          <FolderOpen className="h-4 w-4" />
          Back to My Projects
        </Link>
      </div>

      {bids.length > 0 ? (
        <div className="space-y-4">
          {bids.map((bid) => {
            const project = bid.projects;
            const profile = profileMap.get(bid.bidder_id);
            const credentials = credentialMap.get(bid.bidder_id);
            const badgeLevel = credentials?.badge_level as BadgeLevel | undefined;
            const badgeInfo = badgeLevel ? BADGE_CONFIG[badgeLevel] : null;
            const hasCoreCheck = hasCoreCredentials(credentials);
            const specialtyLabels = specialtyMap.get(bid.bidder_id) || [];
            const bidLineItems = bidLineItemsMap.get(bid.id) || [];
            const bidFiles = bid.bid_files || [];

            return (
              <section
                key={bid.id}
                className="rounded-xl border border-border bg-surface p-5 shadow-sm"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <Link
                      href={`/customer/projects/${bid.project_id}`}
                      className="text-sm font-semibold text-primary hover:text-primary-dark"
                    >
                      {project?.title || "Project"}
                    </Link>
                    <div className="mt-3 flex items-start gap-3">
                      <Link href={`/profile/${bid.bidder_id}`} className="shrink-0">
                        {profile?.avatar_url ? (
                          <Image
                            src={profile.avatar_url}
                            alt={profile.full_name || "Bidder"}
                            width={44}
                            height={44}
                            className="h-11 w-11 rounded-full border-2 border-white object-cover shadow"
                          />
                        ) : (
                          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10">
                            <User className="h-5 w-5 text-primary" />
                          </div>
                        )}
                      </Link>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/profile/${bid.bidder_id}`}
                            className="font-semibold text-text-primary transition-colors hover:text-primary"
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
                          {project?.awarded_bid_id === bid.id && (
                            <span className="inline-flex rounded-full bg-secondary/15 px-2.5 py-0.5 text-xs font-semibold text-secondary">
                              Winning Bid
                            </span>
                          )}
                        </div>
                        {profile?.business_name && (
                          <p className="mt-1 text-sm text-text-muted">
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
                  </div>

                  <div className="rounded-lg bg-bg-warm px-4 py-3 lg:min-w-40 lg:text-right">
                    <p className="text-2xl font-bold text-secondary">
                      ${Number(bid.price).toLocaleString()}
                    </p>
                    <p className="mt-1 text-xs text-text-muted">
                      {TRADE_LABELS[bid.trade]}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-lg bg-bg-warm px-4 py-3">
                    <p className="text-xs text-text-muted">Timeline</p>
                    <p className="text-sm font-medium text-text-primary">
                      {bid.estimated_timeline}
                    </p>
                  </div>
                  <div className="rounded-lg bg-bg-warm px-4 py-3">
                    <p className="text-xs text-text-muted">Can Start</p>
                    <p className="text-sm font-medium text-text-primary">
                      {new Date(bid.estimated_start_date).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="rounded-lg bg-bg-warm px-4 py-3">
                    <p className="text-xs text-text-muted">Received</p>
                    <p className="flex items-center gap-1 text-sm font-medium text-text-primary">
                      <Calendar className="h-3.5 w-3.5" />
                      {new Date(bid.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {bid.notes && (
                  <div className="mt-4 rounded-lg bg-bg-warm px-4 py-3">
                    <p className="mb-1 text-xs text-text-muted">Notes</p>
                    <RichTextRenderer
                      content={bid.notes}
                      className="text-sm text-text-secondary"
                    />
                  </div>
                )}

                {bid.price_breakdown && (
                  <div className="mt-4 rounded-lg bg-bg-warm px-4 py-3">
                    <p className="mb-1 text-xs text-text-muted">Price Breakdown</p>
                    <p className="whitespace-pre-wrap text-sm text-text-secondary">
                      {bid.price_breakdown}
                    </p>
                  </div>
                )}

                {bidLineItems.length > 0 && (
                  <div className="mt-4">
                    <BidLineItemsTable lineItems={bidLineItems} />
                  </div>
                )}

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    {bidFiles.map((file) => (
                      <a
                        key={file.id}
                        href={file.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-accent-light transition-colors hover:bg-surface-hover hover:text-accent"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        {file.file_name}
                      </a>
                    ))}
                  </div>
                  <Link
                    href={`/customer/projects/${bid.project_id}`}
                    className="inline-flex items-center gap-2 rounded-lg bg-secondary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-secondary-dark"
                  >
                    View Project Bids
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface px-6 py-12 text-center shadow-sm">
          <ClipboardList className="mx-auto h-12 w-12 text-text-muted/40" />
          <h2 className="mt-4 text-lg font-semibold text-text-primary">
            No bids received yet
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-text-secondary">
            When contractors submit bids on your projects, they&apos;ll show up
            here for quick review.
          </p>
          <Link
            href="/customer/projects"
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-accent-light px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:brightness-110"
          >
            View My Projects
          </Link>
        </div>
      )}
    </div>
  );
}
