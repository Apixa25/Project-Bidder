import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  MapPin,
  Calendar,
  DollarSign,
  Clock,
  ClipboardCheck,
  CheckCircle2,
  XCircle,
  User,
  Phone,
  Mail,
  MessageSquare,
  History,
} from "lucide-react";
import { TRADE_LABELS } from "@/types/database";
import { BADGE_CONFIG } from "@/lib/badges";
import type { TradeCategory, BadgeLevel } from "@/types/database";
import ProjectStatusActions from "./ProjectStatusActions";
import ProjectPhotos from "./ProjectPhotos";

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

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .eq("customer_id", user.id)
    .single();

  if (!project) notFound();

  const { data: projectFiles } = await supabase
    .from("project_files")
    .select("*")
    .eq("project_id", id)
    .order("uploaded_at", { ascending: false });

  const { data: bids } = await supabase
    .from("bids")
    .select("*, bid_files(*)")
    .eq("project_id", id)
    .order("created_at", { ascending: true });

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

  // Fetch edit history
  const { data: projectEdits } = await supabase
    .from("project_edits")
    .select("*")
    .eq("project_id", id)
    .order("edited_at", { ascending: false });

  const profileMap = new Map(
    (bidderProfiles || []).map((p) => [p.user_id, p])
  );
  const credentialMap = new Map(
    (bidderCredentials || []).map((c) => [c.user_id, c])
  );

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

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-text-primary">
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
            </div>
            <p className="mt-1 text-sm text-text-muted">
              Posted {new Date(project.created_at).toLocaleDateString()} •{" "}
              {project.bid_count} {project.bid_count === 1 ? "bid" : "bids"}{" "}
              received
            </p>
          </div>

          <ProjectStatusActions
            projectId={project.id}
            currentStatus={project.status}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="col-span-2 space-y-6">
          {/* Description */}
          <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold text-text-primary">
              Description
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

          {/* Edit History */}
          {projectEdits && projectEdits.length > 0 && (
            <section className="rounded-xl border border-amber-300 bg-amber-50/50 p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <History className="h-5 w-5 text-amber-700" />
                <h2 className="text-lg font-semibold text-amber-900">
                  Edit History ⚠️
                </h2>
                <span className="rounded-full bg-amber-200 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                  {projectEdits.length} change{projectEdits.length !== 1 ? "s" : ""}
                </span>
              </div>
              <p className="mb-4 text-xs text-amber-700">
                This project has been edited after the original posting. All
                existing bids are date-stamped to their original submission time.
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

          {/* Project Photos & Documents with Annotation */}
          {projectFiles && projectFiles.length > 0 && (
            <ProjectPhotos files={projectFiles} />
          )}

          {/* Bids Section */}
          <section className="rounded-xl border border-border bg-surface shadow-sm">
            <div className="border-b border-border px-6 py-4">
              <h2 className="text-lg font-semibold text-text-primary">
                Bids Received ({bids?.length || 0})
              </h2>
            </div>

            {bids && bids.length > 0 ? (
              <div className="divide-y divide-border">
                {bids.map((bid) => {
                  const profile = profileMap.get(bid.bidder_id);
                  const creds = credentialMap.get(bid.bidder_id);
                  const badgeLevel = creds?.badge_level as BadgeLevel;
                  const badgeInfo = badgeLevel
                    ? BADGE_CONFIG[badgeLevel]
                    : null;

                  const credChecks = {
                    License: creds?.license_url,
                    Bond: creds?.bond_url,
                    Insurance: creds?.insurance_url,
                    "Workers' Comp": creds?.workers_comp_url,
                    EIN: creds?.ein_url,
                    References: creds?.references_url,
                  };

                  return (
                    <div key={bid.id} className="p-6">
                      {/* Bidder Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <Link
                            href={`/profile/${bid.bidder_id}`}
                            className="shrink-0"
                          >
                            {profile?.avatar_url ? (
                              <img
                                src={profile.avatar_url}
                                alt={profile.full_name}
                                className="h-10 w-10 rounded-full object-cover border-2 border-white shadow"
                              />
                            ) : (
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                                <User className="h-5 w-5 text-primary" />
                              </div>
                            )}
                          </Link>
                          <div>
                            <div className="flex items-center gap-2">
                              <Link
                                href={`/profile/${bid.bidder_id}`}
                                className="font-semibold text-text-primary hover:text-primary transition-colors"
                              >
                                {profile?.full_name || "Unknown Bidder"}
                              </Link>
                              {badgeInfo && (
                                <span
                                  className={`inline-flex items-center gap-1 rounded-full ${badgeInfo.bgColor} px-2 py-0.5 text-xs font-medium ${badgeInfo.color}`}
                                >
                                  {badgeInfo.icon} {badgeInfo.label}
                                </span>
                              )}
                            </div>
                            {profile?.business_name && (
                              <p className="text-sm text-text-muted">
                                {profile.business_name}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-primary">
                            ${Number(bid.price).toLocaleString()}
                          </p>
                          <p className="text-xs text-text-muted">
                            {TRADE_LABELS[bid.trade as TradeCategory]}
                          </p>
                        </div>
                      </div>

                      {/* Bid Details */}
                      <div className="grid grid-cols-2 gap-4 mb-4">
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
                          <p className="text-sm text-text-secondary whitespace-pre-wrap">
                            {bid.notes}
                          </p>
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

                      {/* Credential Checks */}
                      <div className="mb-4 flex flex-wrap gap-2">
                        {Object.entries(credChecks).map(([label, url]) => (
                          <span
                            key={label}
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              url
                                ? "bg-green-100 text-green-700"
                                : "bg-gray-100 text-gray-400"
                            }`}
                          >
                            {url ? (
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            ) : (
                              <XCircle className="h-3.5 w-3.5" />
                            )}
                            {label}
                          </span>
                        ))}
                      </div>

                      {/* Contact Info */}
                      <div className="flex items-center gap-4 text-sm">
                        {profile?.email && (
                          <a
                            href={`mailto:${profile.email}`}
                            className="flex items-center gap-1 text-primary hover:text-primary-dark transition-colors"
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
                      </div>

                      {/* Bid date stamp */}
                      <p className="mt-3 text-xs text-text-muted">
                        Bid submitted:{" "}
                        {new Date(bid.created_at).toLocaleString()}
                      </p>
                    </div>
                  );
                })}
              </div>
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
                  <p className="text-sm font-medium text-text-primary">
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

          {/* Trades */}
          <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-text-primary">
              Trades Required
            </h3>
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
          </div>
        </div>
      </div>
    </div>
  );
}
