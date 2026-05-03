import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Calendar, Shield, ArrowRight } from "lucide-react";
import { BADGE_CONFIG } from "@/lib/badges";
import { TRADE_LABELS, type BadgeLevel, type TradeCategory } from "@/types/database";
import ProfileForm from "@/components/profile/ProfileForm";
import AvatarUpload from "@/components/profile/AvatarUpload";
import CompanyLogoUpload from "@/components/profile/CompanyLogoUpload";
import PortfolioGallery from "@/components/profile/PortfolioGallery";
import SocialLinksForm from "@/components/profile/SocialLinksForm";
import { userHasRole } from "@/lib/auth/roles";

export default async function BidderProfilePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  if (!(await userHasRole(user.id, "bidder"))) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!profile) redirect("/login");

  const { data: credentials } = await supabase
    .from("bidder_credentials")
    .select("badge_level")
    .eq("user_id", user.id)
    .single();

  const { data: rawPortfolioItems } = await supabase
    .from("portfolio_items")
    .select("*")
    .eq("user_id", user.id)
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

  const { data: specialties } = await supabase
    .from("bidder_specialties")
    .select("trade, display_order")
    .eq("user_id", user.id)
    .order("display_order", { ascending: true });

  const { data: serviceAreas } = await supabase
    .from("bidder_service_areas")
    .select("state, city")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  const badgeLevel = credentials?.badge_level as BadgeLevel;
  const badgeInfo = badgeLevel ? BADGE_CONFIG[badgeLevel] : null;
  const selectedSpecialties = (specialties || []).map(
    (specialty) => specialty.trade as TradeCategory
  );

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">My Profile 👤</h1>
        <p className="mt-1 text-text-secondary">
          Manage your profile — customers see this when reviewing your bids.
        </p>
      </div>

      {/* Avatar + Badge Card */}
      <div className="mb-8 rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <AvatarUpload
            currentUrl={profile.avatar_url}
            userName={profile.full_name}
          />
          <div className="flex flex-wrap items-center gap-3">
            {badgeInfo ? (
              <div
                className={`flex items-center gap-2 rounded-full ${badgeInfo.bgColor} px-4 py-2`}
              >
                <span className="text-lg">{badgeInfo.icon}</span>
                <span className={`text-sm font-semibold ${badgeInfo.color}`}>
                  {badgeInfo.label}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-full bg-gray-100 px-4 py-2">
                <Shield className="h-5 w-5 text-gray-400" />
                <span className="text-sm font-medium text-gray-500">
                  No Badge
                </span>
              </div>
            )}
            <Link
              href="/bidder/credentials"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary transition-colors hover:text-primary-dark"
            >
              Credentials
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-text-muted">
          <span className="inline-flex items-center gap-1 rounded-full bg-secondary/10 px-2.5 py-0.5 font-medium text-secondary capitalize">
            bidder mode
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            Member since {new Date(profile.created_at).toLocaleDateString()}
          </span>
        </div>
      </div>

      <div className="mb-8 rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-6">
        <CompanyLogoUpload
          currentUrl={profile.company_logo_url}
          businessName={profile.business_name}
        />
      </div>

      {/* Profile Form */}
      <div className="mb-8 rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="mb-6 text-lg font-semibold text-text-primary">
          Edit Profile
        </h2>
        <ProfileForm
          profile={profile}
          editorRole="bidder"
          selectedSpecialties={selectedSpecialties}
          serviceAreas={(serviceAreas || []).map((a) => ({ state: a.state, city: a.city }))}
        />
      </div>

      <div className="mb-8 rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-text-primary">
          Directory Preview
        </h2>
        <p className="mb-4 text-sm text-text-muted">
          Customers will use these specialties to find you in the contractor
          directory.
        </p>
        {selectedSpecialties.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {selectedSpecialties.map((trade) => (
              <span
                key={trade}
                className="rounded-full bg-secondary/10 px-3 py-1 text-xs font-medium text-secondary"
              >
                {TRADE_LABELS[trade]}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-secondary">
            Add at least one specialty so customers can discover your profile
            beyond individual bids.
          </p>
        )}
      </div>

      {/* Social Links */}
      <div className="mb-8 rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-text-primary">
          🔗 Links & Social Media
        </h2>
        <p className="mb-4 text-sm text-text-muted">
          Share your website, social profiles, and review pages so customers can
          learn about your business.
        </p>
        <SocialLinksForm links={profile} />
      </div>

      {/* Portfolio */}
      <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <PortfolioGallery
          items={portfolioItems || []}
          isOwner={true}
          ownerRole="bidder"
        />
      </div>
    </div>
  );
}
