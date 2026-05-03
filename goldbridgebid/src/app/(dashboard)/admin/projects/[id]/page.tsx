import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { TRADE_LABELS, EXPERTISE_LEVEL_LABELS } from "@/types/database";
import type { ExpertiseLevel } from "@/types/database";
import type {
  TradeCategory,
  BadgeLevel,
  ProjectPaidEstimatePool,
  PaidEstimateClaim,
  PaidEstimateDispute,
} from "@/types/database";
import { BADGE_CONFIG } from "@/lib/badges";
import {
  ArrowLeft,
  MapPin,
  Calendar,
  DollarSign,
  Clock,
  FileText,
} from "lucide-react";
import ProjectDetailTabs from "./ProjectDetailTabs";
import PrintProjectButton from "@/components/project/PrintProjectButton";
import ProjectAddressMap from "@/components/project/ProjectAddressMap";
import AddressWithMapPreview from "@/components/address-quotes/AddressWithMapPreview";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AdminProjectDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const admin = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();
  if (profile?.role !== "admin") redirect("/login");

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();

  if (!project) notFound();

  const [
    { data: customer },
    { data: bids },
    { data: edits },
    { data: messages },
    { data: files },
    { data: paidEstimatePool },
    { data: paidEstimateClaims },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("*")
      .eq("user_id", project.customer_id)
      .single(),
    supabase
      .from("bids")
      .select("*")
      .eq("project_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("project_edits")
      .select("*")
      .eq("project_id", id)
      .order("edited_at", { ascending: false }),
    supabase
      .from("messages")
      .select("*")
      .eq("project_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("project_files")
      .select("*")
      .eq("project_id", id)
      .order("uploaded_at", { ascending: true }),
    admin
      .from("project_paid_estimate_pools")
      .select("*")
      .eq("project_id", id)
      .maybeSingle(),
    admin
      .from("paid_estimate_claims")
      .select("*")
      .eq("project_id", id)
      .order("created_at", { ascending: false }),
  ]);

  const claimIds = (paidEstimateClaims || []).map((claim) => claim.id);
  const { data: paidEstimateDisputes } = claimIds.length
    ? await admin
        .from("paid_estimate_disputes")
        .select("*")
        .in("claim_id", claimIds)
    : { data: [] };

  // Fetch bidder profiles
  const bidderIds = [...new Set((bids || []).map((b) => b.bidder_id))];
  const { data: bidderProfiles } =
    bidderIds.length > 0
      ? await supabase
          .from("profiles")
          .select("user_id, full_name, email, business_name, phone")
          .in("user_id", bidderIds)
      : { data: [] };

  const { data: bidderCreds } =
    bidderIds.length > 0
      ? await supabase
          .from("bidder_credentials")
          .select("user_id, badge_level")
          .in("user_id", bidderIds)
      : { data: [] };

  const bidderMap = Object.fromEntries(
    (bidderProfiles || []).map((p) => [p.user_id, p])
  );
  const credMap = Object.fromEntries(
    (bidderCreds || []).map((c) => [c.user_id, c])
  );

  // Fetch message participant names
  const msgUserIds = [
    ...new Set(
      (messages || []).flatMap((m) => [m.sender_id, m.receiver_id])
    ),
  ];
  const { data: msgProfiles } =
    msgUserIds.length > 0
      ? await supabase
          .from("profiles")
          .select("user_id, full_name, role")
          .in("user_id", msgUserIds)
      : { data: [] };
  const msgProfileMap = Object.fromEntries(
    (msgProfiles || []).map((p) => [p.user_id, p])
  );

  const statusColor =
    project.status === "open"
      ? "bg-green-100 text-green-700"
      : project.status === "awarded"
        ? "bg-amber-100 text-amber-700"
        : "bg-gray-100 text-gray-600";

  return (
    <div>
      {/* Back Link */}
      <Link
        href="/admin/projects"
        className="mb-4 inline-flex items-center gap-1 text-sm text-text-muted hover:text-primary transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to All Projects
      </Link>

      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-text-primary">
              {project.title}
            </h1>
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${statusColor}`}
            >
              {project.status.charAt(0).toUpperCase() +
                project.status.slice(1)}
            </span>
          </div>
          <p className="mt-1 text-sm text-text-secondary">
            Posted by{" "}
            <Link
              href={`/admin/users/${project.customer_id}`}
              className="text-primary hover:underline"
            >
              {customer?.full_name || "Unknown"}
            </Link>{" "}
            on {new Date(project.created_at).toLocaleDateString()}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <PrintProjectButton
            projectId={project.id}
            variant="muted"
            label="Print Project"
            title="Print the project summary for moderation paperwork or offline review"
          />
        </div>
      </div>

      {/* Key Details Strip */}
      <div className="mb-6 flex flex-wrap gap-4 rounded-xl border border-border bg-surface p-4">
        <div className="flex items-center gap-2 text-sm">
          <MapPin className="h-4 w-4 text-text-muted" />
          <span className="text-text-primary">
            {project.location_city}, {project.location_state}{" "}
            {project.location_zip}
          </span>
        </div>
        {project.budget_min !== null && (
          <div className="flex items-center gap-2 text-sm">
            <DollarSign className="h-4 w-4 text-text-muted" />
            <span className="text-money">
              ${Number(project.budget_min).toLocaleString()}
              {project.budget_max !== null &&
                ` – $${Number(project.budget_max).toLocaleString()}`}
            </span>
          </div>
        )}
        {project.desired_start_date && (
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-text-muted" />
            <span className="text-text-primary">
              Start:{" "}
              {new Date(project.desired_start_date).toLocaleDateString()}
            </span>
          </div>
        )}
        {project.timeline && (
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-text-muted" />
            <span className="text-text-primary">{project.timeline}</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-sm">
          <FileText className="h-4 w-4 text-text-muted" />
          <span className="text-text-primary">
            {project.bid_count} bid{project.bid_count !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Project Location Map — gives moderators a visual on the job site */}
      {(project.location_address ||
        project.location_city ||
        project.location_state ||
        project.location_zip) && (
        <div className="mb-6 rounded-xl border border-border bg-surface p-4">
          <div className="grid gap-4 md:grid-cols-[1fr_2fr]">
            <AddressWithMapPreview
              label="Project Address"
              address={[
                project.location_address,
                project.location_city,
                project.location_state,
                project.location_zip,
              ]
                .filter(Boolean)
                .join(", ")}
              mapImageUrl={customer?.exact_address_map_image_url}
              className="text-sm"
            />
            <ProjectAddressMap
              address={project.location_address}
              city={project.location_city}
              state={project.location_state}
              zip={project.location_zip}
              heading=""
              heightPx={200}
              linkBehavior="view"
            />
          </div>
        </div>
      )}

      {/* Expertise Level / Trades */}
      <div className="mb-6 flex flex-wrap gap-2">
        {project.expertise_level ? (
          <span className="rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
            {EXPERTISE_LEVEL_LABELS[project.expertise_level as ExpertiseLevel]}
          </span>
        ) : (
          (project.trades as TradeCategory[]).map((t) => (
            <span
              key={t}
              className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary"
            >
              {TRADE_LABELS[t]}
            </span>
          ))
        )}
      </div>

      {/* Tabs */}
      <ProjectDetailTabs
        project={project}
        bids={(bids || []).map((b) => ({
          ...b,
          bidder: bidderMap[b.bidder_id] || null,
          badge: (credMap[b.bidder_id]?.badge_level as BadgeLevel) || null,
        }))}
        edits={edits || []}
        messages={(messages || []).map((m) => ({
          ...m,
          senderName: msgProfileMap[m.sender_id]?.full_name || "Unknown",
          senderRole: msgProfileMap[m.sender_id]?.role || "unknown",
        }))}
        files={files || []}
        paidEstimatePool={
          (paidEstimatePool as ProjectPaidEstimatePool | null | undefined) ||
          null
        }
        paidEstimateClaims={
          (paidEstimateClaims as PaidEstimateClaim[] | null | undefined) || []
        }
        paidEstimateDisputes={
          (paidEstimateDisputes as PaidEstimateDispute[] | null | undefined) ||
          []
        }
        badgeConfig={BADGE_CONFIG}
        tradeLabels={TRADE_LABELS}
      />
    </div>
  );
}
