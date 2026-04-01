import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { userHasRole } from "@/lib/auth/roles";
import AdminSearchBar from "@/components/admin/AdminSearchBar";
import AdminFilterBar, { FilterDropdown } from "@/components/admin/AdminFilters";
import AdminPagination from "@/components/admin/AdminPagination";
import {
  BADGE_CONFIG,
  countUploadedCredentials,
  hasCoreCredentials,
} from "@/lib/badges";
import {
  FORM_TRADES,
  TRADE_LABELS,
  type BadgeLevel,
  type TradeCategory,
} from "@/types/database";
import {
  Award,
  BriefcaseBusiness,
  MapPin,
  ShieldCheck,
  Star,
  Heart,
} from "lucide-react";

const PAGE_SIZE = 12;

type SortKey =
  | "recommended"
  | "badge"
  | "qualifications"
  | "rating"
  | "newest"
  | "name";

interface Props {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

function getBadgeRank(level: BadgeLevel) {
  if (level === "gold") return 3;
  if (level === "silver") return 2;
  if (level === "bronze") return 1;
  return 0;
}

function getSortValue(sort: string | undefined): SortKey {
  const allowed: SortKey[] = [
    "recommended",
    "badge",
    "qualifications",
    "rating",
    "newest",
    "name",
  ];

  return allowed.includes((sort || "") as SortKey)
    ? (sort as SortKey)
    : "recommended";
}

export default async function CustomerContractorDirectoryPage({
  searchParams,
}: Props) {
  const params = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  if (!(await userHasRole(user.id, "customer"))) redirect("/login");

  const { data: credentialRows } = await supabase
    .from("bidder_credentials")
    .select(
      "user_id, badge_level, license_url, bond_url, insurance_url, workers_comp_url, ein_url, references_url, updated_at"
    );

  const bidderUserIds = (credentialRows || []).map((row) => row.user_id);

  const { data: profiles } = bidderUserIds.length
    ? await supabase
        .from("profiles")
        .select("*")
        .in("user_id", bidderUserIds)
        .eq("is_banned", false)
    : { data: [] };

  const { data: specialties } = bidderUserIds.length
    ? await supabase
        .from("bidder_specialties")
        .select("user_id, trade, display_order")
        .in("user_id", bidderUserIds)
        .order("display_order", { ascending: true })
    : { data: [] };

  const { data: heartRows } = bidderUserIds.length
    ? await supabase
        .from("profile_hearts")
        .select("target_user_id")
        .in("target_user_id", bidderUserIds)
    : { data: [] };

  const { data: reviewRows } = bidderUserIds.length
    ? await supabase
        .from("user_reviews")
        .select("reviewee_user_id, rating_overall, review_type, status")
        .in("reviewee_user_id", bidderUserIds)
        .eq("status", "published")
    : { data: [] };

  const credentialMap = new Map(
    (credentialRows || []).map((row) => [row.user_id, row])
  );

  const specialtiesMap = new Map<string, TradeCategory[]>();
  for (const specialty of specialties || []) {
    const current = specialtiesMap.get(specialty.user_id) || [];
    current.push(specialty.trade as TradeCategory);
    specialtiesMap.set(specialty.user_id, current);
  }

  const heartCounts = new Map<string, number>();
  for (const heart of heartRows || []) {
    heartCounts.set(
      heart.target_user_id,
      (heartCounts.get(heart.target_user_id) || 0) + 1
    );
  }

  const reviewStats = new Map<
    string,
    {
      verifiedAverageRating: number | null;
      verifiedReviewCount: number;
      publicReviewCount: number;
      totalReviewCount: number;
    }
  >();

  for (const profile of profiles || []) {
    const reviewsForUser = (reviewRows || []).filter(
      (review) => review.reviewee_user_id === profile.user_id
    );
    const verified = reviewsForUser.filter(
      (review) => review.review_type === "verified_platform"
    );
    const publicRefs = reviewsForUser.filter(
      (review) => review.review_type === "public_reference"
    );

    reviewStats.set(profile.user_id, {
      verifiedAverageRating:
        verified.length > 0
          ? verified.reduce((sum, review) => sum + review.rating_overall, 0) /
            verified.length
          : null,
      verifiedReviewCount: verified.length,
      publicReviewCount: publicRefs.length,
      totalReviewCount: reviewsForUser.length,
    });
  }

  const searchTerm = (params.q || "").trim().toLowerCase();
  const sort = getSortValue(params.sort);

  const tradeOptions = FORM_TRADES.filter((trade) =>
    (specialties || []).some((specialty) => specialty.trade === trade)
  ).map((trade) => ({
    value: trade,
    label: TRADE_LABELS[trade],
  }));

  const contractors = (profiles || [])
    .map((profile) => {
      const credentials = credentialMap.get(profile.user_id) || null;
      const bidderSpecialties = specialtiesMap.get(profile.user_id) || [];
      const stats = reviewStats.get(profile.user_id) || {
        verifiedAverageRating: null,
        verifiedReviewCount: 0,
        publicReviewCount: 0,
        totalReviewCount: 0,
      };

      return {
        profile,
        credentials,
        badgeLevel: (credentials?.badge_level as BadgeLevel) || null,
        badgeInfo: credentials?.badge_level
          ? BADGE_CONFIG[credentials.badge_level as NonNullable<BadgeLevel>]
          : null,
        qualificationCount: countUploadedCredentials(credentials),
        hasCoreCheck: hasCoreCredentials(credentials),
        specialties: bidderSpecialties,
        specialtyLabels: bidderSpecialties.map((trade) => TRADE_LABELS[trade]),
        heartCount: heartCounts.get(profile.user_id) || 0,
        ...stats,
      };
    })
    .filter((contractor) => {
      if (params.badge) {
        if (params.badge === "none" && contractor.badgeLevel) return false;
        if (params.badge !== "none" && contractor.badgeLevel !== params.badge) {
          return false;
        }
      }

      if (params.trade) {
        if (!contractor.specialties.includes(params.trade as TradeCategory)) {
          return false;
        }
      }

      if (!searchTerm) return true;

      const searchable = [
        contractor.profile.full_name,
        contractor.profile.business_name,
        contractor.profile.city,
        contractor.profile.state,
        contractor.profile.bio,
        ...contractor.specialtyLabels,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(searchTerm);
    })
    .sort((a, b) => {
      if (sort === "badge") {
        return (
          getBadgeRank(b.badgeLevel) - getBadgeRank(a.badgeLevel) ||
          b.qualificationCount - a.qualificationCount ||
          a.profile.full_name.localeCompare(b.profile.full_name)
        );
      }

      if (sort === "qualifications") {
        return (
          b.qualificationCount - a.qualificationCount ||
          getBadgeRank(b.badgeLevel) - getBadgeRank(a.badgeLevel) ||
          a.profile.full_name.localeCompare(b.profile.full_name)
        );
      }

      if (sort === "rating") {
        return (
          (b.verifiedAverageRating || 0) - (a.verifiedAverageRating || 0) ||
          b.verifiedReviewCount - a.verifiedReviewCount ||
          getBadgeRank(b.badgeLevel) - getBadgeRank(a.badgeLevel)
        );
      }

      if (sort === "newest") {
        return (
          new Date(b.profile.created_at).getTime() -
          new Date(a.profile.created_at).getTime()
        );
      }

      if (sort === "name") {
        return a.profile.full_name.localeCompare(b.profile.full_name);
      }

      return (
        getBadgeRank(b.badgeLevel) - getBadgeRank(a.badgeLevel) ||
        b.qualificationCount - a.qualificationCount ||
        (b.verifiedAverageRating || 0) - (a.verifiedAverageRating || 0) ||
        b.heartCount - a.heartCount ||
        a.profile.full_name.localeCompare(b.profile.full_name)
      );
    });

  const totalItems = contractors.length;
  const page = Math.max(1, Number(params.page || "1"));
  const paginated = contractors.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            Find Contractors 👷
          </h1>
          <p className="mt-1 max-w-3xl text-text-secondary">
            Browse contractor profiles by badge level, qualifications, trade
            specialties, and reputation signals so you can shortlist the right
            fit before bids start coming in. This supports the trust-first
            marketplace direction in `project-vision.md`.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text-secondary shadow-sm">
          {totalItems} contractor{totalItems === 1 ? "" : "s"} matched
        </div>
      </div>

      <div className="mb-6 space-y-4 rounded-xl border border-border bg-surface p-4 shadow-sm">
        <div className="max-w-xl">
          <AdminSearchBar placeholder="Search by name, company, location, specialty..." />
        </div>
        <AdminFilterBar>
          <FilterDropdown
            paramName="badge"
            label="Badge"
            options={[
              { value: "gold", label: "Gold" },
              { value: "silver", label: "Silver" },
              { value: "bronze", label: "Bronze" },
              { value: "none", label: "None" },
            ]}
          />
          <FilterDropdown
            paramName="trade"
            label="Specialty"
            options={tradeOptions}
          />
          <FilterDropdown
            paramName="sort"
            label="Sort"
            includeAll={false}
            options={[
              { value: "", label: "Recommended" },
              { value: "badge", label: "Badge level" },
              { value: "qualifications", label: "Most qualifications" },
              { value: "rating", label: "Highest rated" },
              { value: "newest", label: "Newest members" },
              { value: "name", label: "Name A-Z" },
            ]}
          />
        </AdminFilterBar>
      </div>

      {paginated.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {paginated.map((contractor) => (
            <div
              key={contractor.profile.user_id}
              className="rounded-xl border border-border bg-surface p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-text-primary">
                      {contractor.profile.full_name}
                    </h2>
                    {contractor.badgeInfo ? (
                      <span
                        className={`inline-flex items-center gap-1 rounded-full ${contractor.badgeInfo.bgColor} px-2.5 py-0.5 text-xs font-medium ${contractor.badgeInfo.color}`}
                      >
                        {contractor.badgeInfo.icon} {contractor.badgeInfo.label}
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500">
                        No Badge
                      </span>
                    )}
                    {contractor.hasCoreCheck && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Core docs ready
                      </span>
                    )}
                  </div>
                  {contractor.profile.business_name && (
                    <p className="mt-1 text-sm text-text-secondary">
                      {contractor.profile.business_name}
                    </p>
                  )}
                </div>
                <Link
                  href={`/profile/${contractor.profile.user_id}`}
                  className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-primary-dark"
                >
                  View Profile
                </Link>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <div className="rounded-lg bg-bg-warm px-3 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
                    Qualification
                  </p>
                  <p className="mt-1 text-lg font-bold text-text-primary">
                    {contractor.qualificationCount}/6
                  </p>
                </div>
                <div className="rounded-lg bg-bg-warm px-3 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
                    Verified Rating
                  </p>
                  <p className="mt-1 text-lg font-bold text-text-primary">
                    {contractor.verifiedAverageRating === null
                      ? "New"
                      : contractor.verifiedAverageRating.toFixed(1)}
                  </p>
                </div>
                <div className="rounded-lg bg-bg-warm px-3 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
                    Hearts
                  </p>
                  <p className="mt-1 flex items-center gap-1 text-lg font-bold text-text-primary">
                    <Heart className="h-4 w-4 text-primary" />
                    {contractor.heartCount}
                  </p>
                </div>
                <div className="rounded-lg bg-bg-warm px-3 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
                    Reviews
                  </p>
                  <p className="mt-1 flex items-center gap-1 text-lg font-bold text-text-primary">
                    <Star className="h-4 w-4 text-amber-500" />
                    {contractor.totalReviewCount}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-text-muted">
                {contractor.profile.city && contractor.profile.state && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {contractor.profile.city}, {contractor.profile.state}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Award className="h-4 w-4" />
                  {contractor.verifiedReviewCount} verified review
                  {contractor.verifiedReviewCount === 1 ? "" : "s"}
                </span>
                <span className="flex items-center gap-1">
                  <BriefcaseBusiness className="h-4 w-4" />
                  Joined {new Date(contractor.profile.created_at).toLocaleDateString()}
                </span>
              </div>

              {contractor.profile.bio && (
                <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-text-secondary">
                  {contractor.profile.bio}
                </p>
              )}

              <div className="mt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                  Specialties
                </p>
                {contractor.specialtyLabels.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {contractor.specialtyLabels.slice(0, 6).map((label) => (
                      <span
                        key={label}
                        className="rounded-full bg-secondary/10 px-3 py-1 text-xs font-medium text-secondary"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-text-secondary">
                    This contractor has not selected specialties yet, but you
                    can still review their badge, reputation, and portfolio.
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface px-6 py-14 text-center shadow-sm">
          <h2 className="text-lg font-semibold text-text-primary">
            No contractors matched those filters
          </h2>
          <p className="mt-2 text-sm text-text-secondary">
            Try a broader search, remove a badge filter, or clear the specialty
            dropdown to see more profiles.
          </p>
        </div>
      )}

      <div className="mt-6">
        <AdminPagination totalItems={totalItems} pageSize={PAGE_SIZE} />
      </div>
    </div>
  );
}
