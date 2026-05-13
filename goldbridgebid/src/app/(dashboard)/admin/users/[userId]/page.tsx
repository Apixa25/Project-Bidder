import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { BADGE_CONFIG } from "@/lib/badges";
import { TRADE_LABELS } from "@/types/database";
import type {
  BadgeLevel,
  BidderPayoutAccount,
  TradeCategory,
} from "@/types/database";
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Globe,
  ShieldOff,
} from "lucide-react";
import UserDetailTabs from "./UserDetailTabs";
import type { TimelineEvent } from "@/components/admin/UserActivityTimeline";

interface Props {
  params: Promise<{ userId: string }>;
}

export default async function AdminUserDetailPage({ params }: Props) {
  const { userId } = await params;
  const supabase = await createClient();
  const admin = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();
  if (adminProfile?.role !== "admin") redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (!profile) notFound();

  const { data: roleRows } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  const roles = Array.from(
    new Set([profile.role, ...((roleRows || []).map((row) => row.role))])
  );

  // Fetch role-specific data
  let credentials = null;
  let projects = null;
  let bids = null;
  let payoutAccount = null;

  if (roles.includes("bidder")) {
    const { data: creds } = await supabase
      .from("bidder_credentials")
      .select("*")
      .eq("user_id", userId)
      .single();
    credentials = creds;

    const { data: bidData } = await supabase
      .from("bids")
      .select("*, projects!bids_project_id_fkey(title, status)")
      .eq("bidder_id", userId)
      .order("created_at", { ascending: false });
    bids = bidData;

    const { data: payoutData } = await admin
      .from("bidder_payout_accounts")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    payoutAccount =
      (payoutData as BidderPayoutAccount | null | undefined) || null;
  }

  if (roles.includes("customer")) {
    const { data: projData } = await supabase
      .from("projects")
      .select("*")
      .eq("customer_id", userId)
      .order("created_at", { ascending: false });
    projects = projData;
  }

  const { count: messageCount } = await supabase
    .from("messages")
    .select("*", { count: "exact", head: true })
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);

  // Build chronological activity timeline
  const [
    { data: recentMessages },
    { data: recentReviews },
    { data: userRoleHistory },
  ] = await Promise.all([
    supabase
      .from("messages")
      .select("id, content, project_id, created_at")
      .or(`sender_id.eq.${userId}`)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("user_reviews")
      .select("id, review_title, rating_overall, reviewee_user_id, created_at")
      .or(`reviewer_user_id.eq.${userId},reviewee_user_id.eq.${userId}`)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("user_roles")
      .select("role, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true }),
  ]);

  const timeline: TimelineEvent[] = [];

  timeline.push({
    id: `signup-${userId}`,
    type: "signup",
    title: "Account created",
    detail: `Joined as ${profile.role}`,
    timestamp: profile.created_at,
  });

  for (const role of userRoleHistory || []) {
    if (role.created_at !== profile.created_at) {
      timeline.push({
        id: `role-${role.role}-${role.created_at}`,
        type: "signup",
        title: `${role.role.charAt(0).toUpperCase() + role.role.slice(1)} role enabled`,
        detail: `Added ${role.role} capabilities`,
        timestamp: role.created_at,
      });
    }
  }

  for (const p of projects || []) {
    timeline.push({
      id: `proj-${p.id}`,
      type: "project",
      title: `Posted project: ${p.title}`,
      detail: `${p.location_city}, ${p.location_state} · ${p.bid_count} bids · ${p.status}`,
      href: `/admin/projects/${p.id}`,
      timestamp: p.created_at,
    });
  }

  for (const b of bids || []) {
    const proj = b.projects as unknown as { title: string; status: string };
    timeline.push({
      id: `bid-${b.id}`,
      type: "bid",
      title: `Submitted $${Number(b.price).toLocaleString()} bid`,
      detail: proj.title,
      href: `/admin/projects/${b.project_id}`,
      timestamp: b.created_at,
    });
  }

  for (const m of recentMessages || []) {
    timeline.push({
      id: `msg-${m.id}`,
      type: "message",
      title: "Sent a message",
      detail: m.content.length > 80 ? m.content.slice(0, 80) + "..." : m.content,
      href: `/admin/messages?q=${m.id}`,
      timestamp: m.created_at,
    });
  }

  for (const r of recentReviews || []) {
    const isAuthor = r.reviewee_user_id !== userId;
    timeline.push({
      id: `review-${r.id}`,
      type: "review",
      title: isAuthor
        ? `Left a ${r.rating_overall}/5 review`
        : `Received a ${r.rating_overall}/5 review`,
      detail: r.review_title || "Review",
      timestamp: r.created_at,
    });
  }

  if (credentials) {
    const credDocs = [
      { key: "license_url", label: "Contractor License" },
      { key: "bond_url", label: "Bond" },
      { key: "insurance_url", label: "Insurance" },
      { key: "workers_comp_url", label: "Workers' Comp" },
      { key: "ein_url", label: "EIN" },
      { key: "references_url", label: "References" },
    ];
    for (const doc of credDocs) {
      if ((credentials as Record<string, unknown>)[doc.key]) {
        timeline.push({
          id: `cred-${doc.key}`,
          type: "credential",
          title: `Uploaded ${doc.label}`,
          detail: `Credential document uploaded`,
          timestamp: (credentials as Record<string, string>).updated_at || profile.created_at,
        });
      }
    }
  }

  timeline.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  // Fetch admin notes for this user
  const { data: adminNotes } = await supabase
    .from("admin_user_notes")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  // Fetch admin names for notes
  const noteAdminIds = [...new Set((adminNotes || []).map((n: { admin_id: string }) => n.admin_id))];
  const { data: noteAdminProfiles } = noteAdminIds.length
    ? await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", noteAdminIds)
    : { data: [] };
  const noteAdminMap = Object.fromEntries(
    (noteAdminProfiles || []).map((p: { user_id: string; full_name: string }) => [p.user_id, p.full_name])
  );

  const notesWithAdmin = (adminNotes || []).map((n: { id: string; admin_id: string; note: string; created_at: string }) => ({
    id: n.id,
    adminName: noteAdminMap[n.admin_id] || "Admin",
    note: n.note,
    created_at: n.created_at,
  }));

  const badge = credentials?.badge_level as BadgeLevel;
  const badgeInfo = badge ? BADGE_CONFIG[badge] : null;

  const credentialChecks = credentials
    ? [
        { label: "Contractor License", hasIt: !!credentials.license_url },
        { label: "Bond", hasIt: !!credentials.bond_url },
        { label: "Insurance", hasIt: !!credentials.insurance_url },
        { label: "Workers' Comp", hasIt: !!credentials.workers_comp_url },
        { label: "EIN", hasIt: !!credentials.ein_url },
        { label: "References", hasIt: !!credentials.references_url },
      ]
    : [];

  return (
    <div>
      <Link
        href="/admin/users"
        className="mb-4 inline-flex items-center gap-1 text-sm text-text-muted hover:text-primary transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Users
      </Link>

      {/* Header Card */}
      <div className="mb-6 rounded-xl border border-border bg-surface p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            {profile.avatar_url ? (
              <Image
                src={profile.avatar_url}
                alt={profile.full_name}
                width={64}
                height={64}
                className="h-16 w-16 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-2xl font-bold text-primary">
                {profile.full_name.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-text-primary">
                  {profile.full_name}
                </h1>
                <div className="flex flex-wrap gap-2">
                  {roles.map((role) => (
                    <span
                      key={role}
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                        role === "admin"
                          ? "bg-purple-100 text-purple-700"
                          : role === "customer"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-secondary/10 text-secondary"
                      }`}
                    >
                      {role.charAt(0).toUpperCase() + role.slice(1)}
                    </span>
                  ))}
                </div>
                {badgeInfo && (
                  <span
                    className={`inline-flex items-center gap-1 rounded-full ${badgeInfo.bgColor} px-2.5 py-1 text-xs font-medium ${badgeInfo.color}`}
                  >
                    {badgeInfo.icon} {badgeInfo.label}
                  </span>
                )}
              </div>
              {profile.business_name && (
                <p className="mt-1 text-sm text-text-secondary">
                  {profile.business_name}
                </p>
              )}
              {profile.is_banned && (
                <div className="mt-2 flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
                  <ShieldOff className="h-4 w-4 text-red-600" />
                  <span className="text-sm font-medium text-red-700">
                    BANNED
                  </span>
                  {profile.ban_reason && (
                    <span className="text-sm text-red-600">
                      — {profile.ban_reason}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Contact Strip */}
        <div className="mt-4 flex flex-wrap gap-4 text-sm text-text-secondary">
          <div className="flex items-center gap-1.5">
            <Mail className="h-4 w-4 text-text-muted" />
            {profile.email}
          </div>
          <div className="flex items-center gap-1.5">
            <Phone className="h-4 w-4 text-text-muted" />
            {profile.phone}
          </div>
          {profile.city && profile.state && (
            <div className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-text-muted" />
              {profile.city}, {profile.state} {profile.zip}
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4 text-text-muted" />
            Joined {new Date(profile.created_at).toLocaleDateString()}
          </div>
          {profile.website_url && (
            <a
              href={profile.website_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-primary hover:underline"
            >
              <Globe className="h-4 w-4" />
              Website
            </a>
          )}
        </div>
      </div>

      {/* Tabs */}
      <UserDetailTabs
        profile={profile}
        roles={roles}
        credentials={credentials}
        credentialChecks={credentialChecks}
        payoutAccount={payoutAccount}
        projects={
          projects?.map((p) => ({
            id: p.id,
            title: p.title,
            status: p.status,
            bid_count: p.bid_count,
            location: `${p.location_city}, ${p.location_state}`,
            created_at: p.created_at,
          })) || null
        }
        bids={
          bids?.map((b) => ({
            id: b.id,
            project_id: b.project_id,
            project_title: (
              b.projects as unknown as { title: string; status: string }
            ).title,
            project_status: (
              b.projects as unknown as { title: string; status: string }
            ).status,
            trade: TRADE_LABELS[b.trade as TradeCategory] || b.trade,
            price: Number(b.price),
            created_at: b.created_at,
          })) || null
        }
        messageCount={messageCount || 0}
        timeline={timeline}
        notes={notesWithAdmin}
      />
    </div>
  );
}
