import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { userHasRole } from "@/lib/auth/roles";
import AdminSearchBar from "@/components/admin/AdminSearchBar";
import AdminFilterBar, { FilterDropdown } from "@/components/admin/AdminFilters";
import AdminPagination from "@/components/admin/AdminPagination";
import {
  checkContractorSearchAlerts,
  deleteContractorSearch,
  saveContractorSearch,
} from "./actions";
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
  CheckCircle2,
  MapPin,
  Star,
  Heart,
  Bookmark,
  Trash2,
  Sparkles,
  RefreshCcw,
  X,
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

const SEARCH_PARAM_KEYS = ["q", "badge", "trade", "state", "city", "sort"] as const;

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

function toTitleCase(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function buildContractorDirectoryHref(
  currentParams: { [key: string]: string | undefined },
  overrides: Record<string, string | null | undefined>
) {
  const next = new URLSearchParams();

  for (const key of SEARCH_PARAM_KEYS) {
    const value = currentParams[key];
    if (value && value.trim()) {
      next.set(key, value.trim());
    }
  }

  for (const [key, value] of Object.entries(overrides)) {
    if (!value || !value.trim()) {
      next.delete(key);
    } else {
      next.set(key, value.trim());
    }
  }

  const query = next.toString();
  return query ? `/customer/contractors?${query}` : "/customer/contractors";
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

  const { data: customerProfile } = await supabase
    .from("profiles")
    .select("city, state")
    .eq("user_id", user.id)
    .single();

  const { data: savedSearches } = await supabase
    .from("customer_saved_contractor_searches")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

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
  const selectedState = (params.state || "").trim();
  const selectedCity = (params.city || "").trim();

  const tradeOptions = FORM_TRADES.filter((trade) =>
    (specialties || []).some((specialty) => specialty.trade === trade)
  ).map((trade) => ({
    value: trade,
    label: TRADE_LABELS[trade],
  }));

  const stateOptions = Array.from(
    new Set(
      (profiles || [])
        .map((profile) => profile.state?.trim().toUpperCase())
        .filter(Boolean)
    )
  )
    .sort()
    .map((state) => ({
      value: state!,
      label: state!,
    }));

  const cityOptions = Array.from(
    new Set(
      (profiles || [])
        .filter((profile) =>
          selectedState
            ? profile.state?.trim().toUpperCase() === selectedState.toUpperCase()
            : true
        )
        .map((profile) => profile.city?.trim())
        .filter(Boolean)
    )
  )
    .sort((a, b) => a!.localeCompare(b!))
    .map((city) => ({
      value: city!,
      label: toTitleCase(city!),
    }));

  const activeQuery = new URLSearchParams();
  for (const key of SEARCH_PARAM_KEYS) {
    const value = params[key];
    if (value && value.trim()) {
      activeQuery.set(key, value.trim());
    }
  }
  const activeQueryString = activeQuery.toString();
  const hasActiveFilters = SEARCH_PARAM_KEYS.some((key) => {
    const value = params[key];
    return Boolean(value && value.trim());
  });

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

      if (
        selectedState &&
        contractor.profile.state?.trim().toUpperCase() !==
          selectedState.toUpperCase()
      ) {
        return false;
      }

      if (
        selectedCity &&
        contractor.profile.city?.trim().toLowerCase() !== selectedCity.toLowerCase()
      ) {
        return false;
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

  const savedSearchNewMatchCounts = new Map<string, number>();
  for (const saved of savedSearches || []) {
    const since = new Date(saved.last_notified_at || saved.created_at).getTime();
    const newMatchCount = contractors.filter((contractor) => {
      const createdAt = new Date(contractor.profile.created_at).getTime();
      if (createdAt <= since) return false;

      const savedParams = new URLSearchParams(saved.query_string);
      const searchTerm = (savedParams.get("q") || "").trim().toLowerCase();
      const savedBadge = (savedParams.get("badge") || "").trim();
      const savedTrade = (savedParams.get("trade") || "").trim();
      const savedState = (savedParams.get("state") || "").trim().toUpperCase();
      const savedCity = (savedParams.get("city") || "").trim().toLowerCase();

      if (savedBadge) {
        if (savedBadge === "none" && contractor.badgeLevel) return false;
        if (savedBadge !== "none" && contractor.badgeLevel !== savedBadge) {
          return false;
        }
      }

      if (
        savedTrade &&
        !contractor.specialties.includes(savedTrade as TradeCategory)
      ) {
        return false;
      }

      if (
        savedState &&
        contractor.profile.state?.trim().toUpperCase() !== savedState
      ) {
        return false;
      }

      if (
        savedCity &&
        contractor.profile.city?.trim().toLowerCase() !== savedCity
      ) {
        return false;
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
    }).length;

    savedSearchNewMatchCounts.set(saved.id, newMatchCount);
  }

  const cityQuickHref =
    customerProfile?.city && customerProfile?.state
      ? buildContractorDirectoryHref(params, {
          state: customerProfile.state,
          city: customerProfile.city,
        })
      : null;
  const cityQuickLabel = customerProfile?.city
    ? toTitleCase(customerProfile.city)
    : null;
  const stateQuickHref = customerProfile?.state
    ? buildContractorDirectoryHref(params, {
        state: customerProfile.state,
        city: null,
      })
    : null;
  const stateQuickLabel = customerProfile?.state
    ? customerProfile.state.toUpperCase()
    : null;
  const clearFiltersHref = "/customer/contractors";

  async function handleSaveSearch(formData: FormData) {
    "use server";

    await saveContractorSearch(formData);
  }

  async function handleCheckAlerts() {
    "use server";

    await checkContractorSearchAlerts();
  }

  async function handleDeleteSearch(formData: FormData) {
    "use server";

    await deleteContractorSearch(formData);
  }

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

      <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <div className="space-y-4 rounded-xl border border-border bg-surface p-4 shadow-sm">
          <div className="max-w-xl">
            <AdminSearchBar placeholder="Search by name, company, location, specialty..." />
          </div>
          <div className="flex flex-wrap gap-2">
            {cityQuickHref && (
              <Link
                href={cityQuickHref}
                className="inline-flex items-center gap-2 rounded-full bg-secondary/10 px-3 py-1.5 text-sm font-medium text-secondary transition-colors hover:bg-secondary/15"
              >
                <Sparkles className="h-4 w-4" />
                Nearby in {cityQuickLabel}
              </Link>
            )}
            {stateQuickHref && (
              <Link
                href={stateQuickHref}
                className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/15"
              >
                <MapPin className="h-4 w-4" />
                Same state: {stateQuickLabel}
              </Link>
            )}
            {hasActiveFilters && (
              <Link
                href={clearFiltersHref}
                className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
              >
                <X className="h-4 w-4" />
                Clear all filters
              </Link>
            )}
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
              paramName="state"
              label="State"
              options={stateOptions}
              resetParams={["city"]}
            />
            <FilterDropdown
              paramName="city"
              label="City"
              options={cityOptions}
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

        <div className="space-y-4 rounded-xl border border-border bg-surface p-4 shadow-sm">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-text-primary">
              <Bookmark className="h-4 w-4" />
              Saved Searches
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              Save filtered contractor views by location, badge, and trade so
              you can revisit them quickly and optionally alert yourself when
              new matches show up.
            </p>
          </div>

          <form action={handleSaveSearch} className="space-y-3">
            <input type="hidden" name="queryString" value={activeQueryString} />
            <input
              type="text"
              name="label"
              maxLength={80}
              placeholder="Name this search"
              defaultValue={
                selectedCity
                  ? `${toTitleCase(selectedCity)} contractors`
                  : selectedState
                    ? `${selectedState.toUpperCase()} contractors`
                    : ""
              }
              className="block w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <label className="flex items-center gap-3 rounded-lg border border-border bg-bg-warm px-3 py-3 text-sm text-text-primary">
              <input
                type="checkbox"
                name="notifyOnNewMatches"
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
              />
              <span>Alert me when new contractors match this search</span>
            </label>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-sm transition-colors hover:bg-primary-dark"
            >
              <Bookmark className="h-4 w-4" />
              Save Current Search
            </button>
          </form>

          <form action={handleCheckAlerts}>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-hover"
            >
              <RefreshCcw className="h-4 w-4" />
              Check Alert Matches Now
            </button>
          </form>

          {savedSearches && savedSearches.length > 0 ? (
            <div className="space-y-2">
              {savedSearches.slice(0, 6).map((saved) => (
                <div
                  key={saved.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-bg-warm px-3 py-3"
                >
                  <div className="min-w-0">
                    <Link
                      href={
                        saved.query_string
                          ? `/customer/contractors?${saved.query_string}`
                          : "/customer/contractors"
                      }
                      className="block truncate text-sm font-semibold text-text-primary hover:text-primary"
                    >
                      {saved.label}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-text-muted">
                      <span>
                        Saved {new Date(saved.created_at).toLocaleDateString()}
                      </span>
                      {saved.notify_on_new_matches && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
                          Alerts on
                        </span>
                      )}
                      {(savedSearchNewMatchCounts.get(saved.id) || 0) > 0 && (
                        <span className="rounded-full bg-secondary/10 px-2 py-0.5 font-medium text-secondary">
                          {savedSearchNewMatchCounts.get(saved.id)} new match
                          {(savedSearchNewMatchCounts.get(saved.id) || 0) === 1
                            ? ""
                            : "es"}
                        </span>
                      )}
                    </div>
                  </div>
                  <form action={handleDeleteSearch}>
                    <input type="hidden" name="searchId" value={saved.id} />
                    <button
                      type="submit"
                      className="rounded-lg p-2 text-text-muted transition-colors hover:bg-red-50 hover:text-red-600"
                      aria-label={`Delete saved search ${saved.label}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </form>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-secondary">
              No saved searches yet. Save one after setting a location, badge,
              or specialty filter.
            </p>
          )}
        </div>
      </div>

      {paginated.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {paginated.map((contractor) => (
            <div
              key={contractor.profile.user_id}
              className="rounded-xl border border-border bg-surface p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex items-start gap-3">
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border border-border bg-bg-warm">
                    {contractor.profile.avatar_url ? (
                      <Image
                        src={contractor.profile.avatar_url}
                        alt={contractor.profile.full_name}
                        fill
                        sizes="48px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/15 to-secondary/15 text-sm font-semibold text-text-primary">
                        {contractor.profile.full_name
                          .split(" ")
                          .map((namePart) => namePart[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2)}
                      </div>
                    )}
                  </div>
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
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Licensed, Bonded, Insured
                        </span>
                      )}
                    </div>
                    {contractor.profile.business_name && (
                      <p className="mt-1 text-sm text-text-secondary">
                        {contractor.profile.business_name}
                      </p>
                    )}
                  </div>
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
