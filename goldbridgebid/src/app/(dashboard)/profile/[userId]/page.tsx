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
} from "lucide-react";
import { BADGE_CONFIG } from "@/lib/badges";
import type { BadgeLevel } from "@/types/database";
import PortfolioGallery from "@/components/profile/PortfolioGallery";
import ProfileHeartButton from "@/components/profile/ProfileHeartButton";
import ProfileReviewSummary from "@/components/profile/ProfileReviewSummary";
import ProfileReviewsList from "@/components/profile/ProfileReviewsList";
import PublicReviewForm from "@/components/profile/PublicReviewForm";
import VerifiedReviewForm from "@/components/profile/VerifiedReviewForm";
import { getUserRoles } from "@/lib/auth/roles";
import CredentialChecklist from "@/components/credentials/CredentialChecklist";

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
    ? [
        { label: "License", url: credentials.license_url },
        { label: "Bond", url: credentials.bond_url },
        { label: "Insurance", url: credentials.insurance_url },
        { label: "Workers' Comp", url: credentials.workers_comp_url },
        { label: "EIN", url: credentials.ein_url },
        { label: "References", url: credentials.references_url },
      ]
    : null;

  const isOwnProfile = user.id === userId;

  const { count: heartCount } = await supabase
    .from("profile_hearts")
    .select("*", { count: "exact", head: true })
    .eq("target_user_id", userId);

  const { count: viewerHeartCount } = isOwnProfile
    ? { count: 0 }
    : await supabase
        .from("profile_hearts")
        .select("*", { count: "exact", head: true })
        .eq("target_user_id", userId)
        .eq("giver_user_id", user.id);

  const { data: reviews } = await supabase
    .from("user_reviews")
    .select("*")
    .eq("reviewee_user_id", userId)
    .eq("status", "published")
    .order("created_at", { ascending: false });

  const reviewerIds = Array.from(new Set((reviews || []).map((review) => review.reviewer_user_id)));
  const { data: reviewerProfiles } = reviewerIds.length
    ? await supabase
        .from("profiles")
        .select("user_id, full_name, role")
        .in("user_id", reviewerIds)
    : { data: [] };

  const reviewerMap = new Map(
    (reviewerProfiles || []).map((reviewer) => [reviewer.user_id, reviewer])
  );

  const verifiedReviews = (reviews || []).filter(
    (review) => review.review_type === "verified_platform"
  );
  const publicReviews = (reviews || []).filter(
    (review) => review.review_type === "public_reference"
  );
  const verifiedAverageRating =
    verifiedReviews.length > 0
      ? verifiedReviews.reduce((sum, review) => sum + review.rating_overall, 0) /
        verifiedReviews.length
      : null;

  const reviewItems = (reviews || []).slice(0, 10).map((review) => ({
    ...review,
    reviewer: reviewerMap.get(review.reviewer_user_id) || null,
  }));

  const { data: existingPublicReview } = isOwnProfile
    ? { data: null }
    : await supabase
        .from("user_reviews")
        .select("id")
        .eq("reviewer_user_id", user.id)
        .eq("reviewee_user_id", userId)
        .eq("review_type", "public_reference")
        .maybeSingle();

  const { data: existingVerifiedReviews } = isOwnProfile
    ? { data: [] }
    : await supabase
        .from("user_reviews")
        .select("project_id")
        .eq("reviewer_user_id", user.id)
        .eq("reviewee_user_id", userId)
        .eq("review_type", "verified_platform");

  const reviewedProjectIds = new Set(
    (existingVerifiedReviews || [])
      .map((review) => review.project_id)
      .filter(Boolean)
  );

  const { data: customerAwardedProjects } = isOwnProfile
    ? { data: [] }
    : await supabase
        .from("projects")
        .select("id, title")
        .eq("status", "awarded")
        .eq("customer_id", user.id)
        .eq("awarded_bidder_id", userId);

  const { data: bidderAwardedProjects } = isOwnProfile
    ? { data: [] }
    : await supabase
        .from("projects")
        .select("id, title")
        .eq("status", "awarded")
        .eq("customer_id", userId)
        .eq("awarded_bidder_id", user.id);

  const eligibleProjects = [...(customerAwardedProjects || []), ...(bidderAwardedProjects || [])]
    .filter((project) => !reviewedProjectIds.has(project.id))
    .map((project) => ({
      id: project.id,
      title: project.title,
    }));

  const viewerRoles = await getUserRoles(user.id);
  const backHref = viewerRoles.includes("admin")
    ? "/admin"
    : viewerRoles.includes("customer")
      ? "/customer"
      : "/bidder";

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
          <div className="relative shrink-0">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.full_name}
                className="h-24 w-24 rounded-full object-cover border-4 border-white shadow-lg"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-dark text-2xl font-bold text-white border-4 border-white shadow-lg">
                {profile.full_name
                  .split(" ")
                  .map((n: string) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2)}
              </div>
            )}
            <ProfileHeartButton
              targetUserId={userId}
              initialCount={heartCount || 0}
              viewerHasHearted={(viewerHeartCount || 0) > 0}
              isOwnProfile={isOwnProfile}
            />
          </div>

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
          <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-text-primary">
              Reputation Snapshot
            </h2>
            <ProfileReviewSummary
              heartCount={heartCount || 0}
              verifiedAverageRating={verifiedAverageRating}
              verifiedReviewCount={verifiedReviews.length}
              publicReviewCount={publicReviews.length}
            />
          </div>

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

          <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-text-primary">
              Reviews
            </h2>
            <ProfileReviewsList
              reviews={reviewItems}
              canReport={!isOwnProfile}
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {!isOwnProfile && (
            <>
              <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
                <h3 className="mb-3 text-sm font-semibold text-text-primary">
                  Verified Project Review
                </h3>
                <p className="mb-4 text-xs text-text-muted">
                  Available only after an awarded GoldBridgeBid project with this user.
                </p>
                <VerifiedReviewForm
                  revieweeUserId={userId}
                  eligibleProjects={eligibleProjects}
                />
              </div>

              <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
                <h3 className="mb-3 text-sm font-semibold text-text-primary">
                  Public Reference
                </h3>
                <p className="mb-4 text-xs text-text-muted">
                  Share past real-world experience with this user. Public references are labeled separately from verified platform reviews.
                </p>
                {existingPublicReview ? (
                  <p className="text-sm text-text-secondary">
                    You already posted a public reference for this user.
                  </p>
                ) : (
                  <PublicReviewForm revieweeUserId={userId} />
                )}
              </div>
            </>
          )}

          {/* Credentials (bidder only) */}
          {credChecks && (
            <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-text-primary flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Qualifications
              </h3>
              <p className="mb-3 text-xs text-text-muted">
                Open uploaded files to verify licenses, bonds, insurance, and
                other qualifications.
              </p>
              <CredentialChecklist items={credChecks} />
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
