import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Mail,
  Phone,
  Globe,
  ExternalLink,
  Shield,
  Link2,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { BADGE_CONFIG } from "@/lib/badges";
import type { BadgeLevel } from "@/types/database";
import PortfolioGallery from "@/components/profile/PortfolioGallery";

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (!profile) notFound();

  const { data: credentials } =
    profile.role === "bidder"
      ? await supabase
          .from("bidder_credentials")
          .select("*")
          .eq("user_id", userId)
          .single()
      : { data: null };

  const { data: rawPortfolioItems } = await supabase
    .from("portfolio_items")
    .select("*")
    .eq("user_id", userId)
    .order("display_order", { ascending: true });

  const itemIds = (rawPortfolioItems || []).map((i) => i.id);
  const { data: allMedia } = itemIds.length > 0
    ? await supabase
        .from("portfolio_item_media")
        .select("*")
        .in("portfolio_item_id", itemIds)
        .order("display_order", { ascending: true })
    : { data: [] };

  const portfolioItems = (rawPortfolioItems || []).map((item) => ({
    ...item,
    media: (allMedia || []).filter((m) => m.portfolio_item_id === item.id),
  }));

  const badgeLevel = credentials?.badge_level as BadgeLevel;
  const badgeInfo = badgeLevel ? BADGE_CONFIG[badgeLevel] : null;

  const credChecks = credentials
    ? {
        License: credentials.license_url,
        Bond: credentials.bond_url,
        Insurance: credentials.insurance_url,
        "Workers' Comp": credentials.workers_comp_url,
        EIN: credentials.ein_url,
        References: credentials.references_url,
      }
    : null;

  const { data: viewerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  const backHref =
    viewerProfile?.role === "customer" ? "/customer" : "/bidder";

  const socialLinks = [
    { url: profile.website_url, label: "Website", icon: Globe },
    { url: profile.facebook_url, label: "Facebook", icon: ExternalLink },
    { url: profile.linkedin_url, label: "LinkedIn", icon: ExternalLink },
    { url: profile.instagram_url, label: "Instagram", icon: ExternalLink },
    {
      url: profile.other_link_url,
      label: profile.other_link_label || "Other",
      icon: Link2,
    },
  ].filter((l) => l.url);

  return (
    <div>
      <Link
        href={backHref}
        className="mb-6 inline-flex items-center gap-1 text-sm text-text-muted hover:text-text-primary transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Link>

      {/* Profile Header */}
      <div className="mb-8 rounded-xl border border-border bg-surface p-8 shadow-sm">
        <div className="flex items-start gap-6">
          {/* Avatar */}
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile.full_name}
              className="h-24 w-24 rounded-full object-cover border-4 border-white shadow-lg shrink-0"
            />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-dark text-2xl font-bold text-white border-4 border-white shadow-lg shrink-0">
              {profile.full_name
                .split(" ")
                .map((n: string) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2)}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-text-primary">
                {profile.full_name}
              </h1>
              {badgeInfo && (
                <span
                  className={`inline-flex items-center gap-1 rounded-full ${badgeInfo.bgColor} px-3 py-1 text-sm font-medium ${badgeInfo.color}`}
                >
                  {badgeInfo.icon} {badgeInfo.label}
                </span>
              )}
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary capitalize">
                {profile.role}
              </span>
            </div>

            {profile.business_name && (
              <p className="mt-1 text-lg text-text-secondary">
                {profile.business_name}
              </p>
            )}

            {profile.bio && (
              <p className="mt-3 text-sm text-text-secondary whitespace-pre-wrap leading-relaxed">
                {profile.bio}
              </p>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-text-muted">
              {profile.city && profile.state && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {profile.city}, {profile.state}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                Member since{" "}
                {new Date(profile.created_at).toLocaleDateString()}
              </span>
            </div>

            {/* Contact */}
            <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
              <a
                href={`mailto:${profile.email}`}
                className="flex items-center gap-1 text-primary hover:text-primary-dark transition-colors"
              >
                <Mail className="h-4 w-4" />
                {profile.email}
              </a>
              <a
                href={`tel:${profile.phone}`}
                className="flex items-center gap-1 text-primary hover:text-primary-dark transition-colors"
              >
                <Phone className="h-4 w-4" />
                {profile.phone}
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-8">
          {/* Portfolio */}
          {(portfolioItems && portfolioItems.length > 0) && (
            <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
              <PortfolioGallery
                items={portfolioItems}
                isOwner={false}
                ownerRole={profile.role}
              />
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Credentials (bidder only) */}
          {credChecks && (
            <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-text-primary flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Qualifications
              </h3>
              <div className="space-y-2">
                {Object.entries(credChecks).map(([label, url]) => (
                  <div
                    key={label}
                    className={`flex items-center gap-2 text-sm ${
                      url ? "text-green-700" : "text-gray-400"
                    }`}
                  >
                    {url ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 shrink-0" />
                    )}
                    {label}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Social Links */}
          {socialLinks.length > 0 && (
            <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-text-primary">
                🔗 Links
              </h3>
              <div className="space-y-2">
                {socialLinks.map((link) => (
                  <a
                    key={link.label}
                    href={link.url!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-primary hover:text-primary-dark transition-colors"
                  >
                    <link.icon className="h-4 w-4 shrink-0" />
                    {link.label}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
