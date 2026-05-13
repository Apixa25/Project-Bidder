import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import {
  MapPin,
  Calendar,
  DollarSign,
  Search,
  ImageIcon,
  Video,
  FileText as FileIcon,
  Heart,
  Star,
  BadgeDollarSign,
  ShieldCheck,
  Bookmark,
  RefreshCcw,
  Trash2,
  X,
  Sparkles,
  ChevronDown,
} from "lucide-react";
import { FORM_TRADES, TRADE_LABELS, EXPERTISE_LEVEL_LABELS } from "@/types/database";
import type { ExpertiseLevel } from "@/types/database";
import { stripHtml } from "@/components/ui/RichTextRenderer";
import type {
  TradeCategory,
  ProjectPaidEstimatePool,
  BidderCredentials,
} from "@/types/database";
import { userHasRole } from "@/lib/auth/roles";
import {
  saveBidderProjectSearch,
  deleteBidderProjectSearch,
  checkBidderProjectAlerts,
} from "./actions";
import AdminSearchBar from "@/components/admin/AdminSearchBar";
import AdminFilterBar, { FilterDropdown } from "@/components/admin/AdminFilters";
import {
  CORE_CREDENTIAL_LABELS,
  getPaidEstimateEligibility,
  PAID_ESTIMATE_FILTER_LABELS,
} from "@/lib/paid-estimates/eligibility";
import { reconcilePaidEstimatePoolFunding } from "@/lib/paid-estimates/funding";
import {
  getRemainingPaidSlots,
  isPaidEstimatePoolVisibleAsPaid,
} from "@/lib/paid-estimates/pools";
import { getStripeServerClient } from "@/lib/stripe/server";
import {
  getProjectMediaSummary,
  getProjectPreviewFile,
  getProjectPreviewUrl,
  isProjectVideo,
} from "@/lib/project-media";
import PrintProjectButton from "@/components/project/PrintProjectButton";
import HelpHint from "@/components/help/HelpHint";

// Keys we honor in the URL for browse filters. Centralized so the saved-search
// hidden field, the "clear filters" check, and any future quick chips can all
// stay in sync without hunting through the JSX.
const BROWSE_PARAM_KEYS = ["q", "trade", "state", "city"] as const;

interface BrowseProjectsPageProps {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

export default async function BrowseProjectsPage({
  searchParams,
}: BrowseProjectsPageProps) {
  const params = await searchParams;
  const supabase = await createClient();
  const admin = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [
    hasRole,
    { data: projects },
    { data: bidderCredentials },
    { data: bidderServiceAreas },
    { data: bidderSpecialtyRows },
    { data: savedSearches },
  ] = await Promise.all([
    userHasRole(user.id, "bidder"),
    supabase
      .from("projects")
      .select(
        "*, project_files(id, file_url, thumbnail_url, file_type, annotated_url, display_order, uploaded_at)"
      )
      .eq("status", "open")
      .order("created_at", { ascending: false }),
    supabase
      .from("bidder_credentials")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("bidder_service_areas")
      .select("state, city")
      .eq("user_id", user.id),
    supabase
      .from("bidder_specialties")
      .select("trade")
      .eq("user_id", user.id),
    supabase
      .from("bidder_saved_project_searches")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  if (!hasRole) redirect("/login");

  const bidderSpecialties = (bidderSpecialtyRows || []).map(
    (row) => row.trade as TradeCategory
  );

  const customerIds = Array.from(
    new Set((projects || []).map((project) => project.customer_id))
  );
  const projectIds = (projects || []).map((project) => project.id);

  const [{ data: customerProfiles }, { data: customerReviewRows }, { data: customerHearts }, { data: poolRows }] = await Promise.all([
    customerIds.length
      ? supabase
          .from("profiles")
          .select("user_id, full_name, business_name, city, state, created_at, avatar_url")
          .in("user_id", customerIds)
      : Promise.resolve({ data: [] as never[] }),
    customerIds.length
      ? supabase
          .from("user_reviews")
          .select("reviewee_user_id, rating_overall, review_type, status")
          .in("reviewee_user_id", customerIds)
          .eq("status", "published")
      : Promise.resolve({ data: [] as never[] }),
    customerIds.length
      ? supabase
          .from("profile_hearts")
          .select("target_user_id")
          .in("target_user_id", customerIds)
      : Promise.resolve({ data: [] as never[] }),
    projectIds.length
      ? admin
          .from("project_paid_estimate_pools")
          .select("*")
          .in("project_id", projectIds)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  const customerProfileMap = new Map(
    (customerProfiles || []).map((profile) => [profile.user_id, profile])
  );
  const customerHeartCounts = new Map<string, number>();
  for (const heart of customerHearts || []) {
    customerHeartCounts.set(
      heart.target_user_id,
      (customerHeartCounts.get(heart.target_user_id) || 0) + 1
    );
  }

  const customerReviewStats = new Map<
    string,
    { verifiedAverageRating: number | null; totalReviewCount: number }
  >();
  const poolMap = new Map(
    ((poolRows || []) as ProjectPaidEstimatePool[]).map((pool) => [
      pool.project_id,
      pool,
    ])
  );
  for (const project of projects || []) {
    const paidPool = poolMap.get(project.id) || null;
    if (
      paidPool &&
      !paidPool.funded_at &&
      (paidPool.stripe_checkout_session_id || paidPool.stripe_payment_intent_id)
    ) {
      try {
        const stripe = getStripeServerClient();
        const reconciliation = await reconcilePaidEstimatePoolFunding({
          admin,
          stripe,
          pool: paidPool,
          customerId: project.customer_id,
        });

        if (reconciliation.didMarkFunded) {
          const { data: refreshedPool } = await admin
            .from("project_paid_estimate_pools")
            .select("*")
            .eq("project_id", project.id)
            .maybeSingle();

          if (refreshedPool) {
            poolMap.set(project.id, refreshedPool as ProjectPaidEstimatePool);
          }
        }
      } catch (error) {
        console.error(
          "Bidder browse paid estimate reconciliation failed:",
          error
        );
      }
    }
  }
  for (const customerId of customerIds) {
    const reviews = (customerReviewRows || []).filter(
      (review) => review.reviewee_user_id === customerId
    );
    const verified = reviews.filter(
      (review) => review.review_type === "verified_platform"
    );
    customerReviewStats.set(customerId, {
      verifiedAverageRating:
        verified.length > 0
          ? verified.reduce((sum, review) => sum + review.rating_overall, 0) /
            verified.length
          : null,
      totalReviewCount: reviews.length,
    });
  }

  const hasServiceAreas = (bidderServiceAreas || []).length > 0;
  const serviceAreaFiltered = hasServiceAreas
    ? (projects || []).filter((project) => {
        return (bidderServiceAreas || []).some((area) => {
          const stateMatch =
            project.location_state?.trim().toUpperCase() ===
            area.state.trim().toUpperCase();
          if (!stateMatch) return false;
          if (!area.city) return true;
          return (
            project.location_city?.trim().toLowerCase() ===
            area.city.trim().toLowerCase()
          );
        });
      })
    : projects || [];

  // ---- URL-driven filter state (trade / state / city / search query) ----
  const searchTerm = (params.q || "").trim().toLowerCase();
  const selectedTrade = (params.trade || "").trim();
  const selectedState = (params.state || "").trim();
  const selectedCity = (params.city || "").trim();

  // Trade filter options: only show trades that at least one currently visible
  // project is tagged with (after service-area filtering). Keeps the dropdown
  // tight and avoids showing trades that would always return zero matches.
  const tradesInResults = new Set<string>();
  for (const project of serviceAreaFiltered) {
    for (const trade of (project.trades || []) as string[]) {
      tradesInResults.add(trade);
    }
  }
  const tradeOptions = FORM_TRADES.filter((trade) =>
    tradesInResults.has(trade)
  ).map((trade) => ({ value: trade, label: TRADE_LABELS[trade] }));

  // State/city options derived from the same in-results pool so dropdowns
  // never show locations that wouldn't return matches.
  const stateOptions = Array.from(
    new Set(
      serviceAreaFiltered
        .map((project) => project.location_state?.trim().toUpperCase())
        .filter(Boolean)
    )
  )
    .sort()
    .map((state) => ({ value: state as string, label: state as string }));

  const cityOptions = Array.from(
    new Set(
      serviceAreaFiltered
        .filter((project) =>
          selectedState
            ? project.location_state?.trim().toUpperCase() ===
              selectedState.toUpperCase()
            : true
        )
        .map((project) => project.location_city?.trim())
        .filter(Boolean)
    )
  )
    .sort((a, b) => (a as string).localeCompare(b as string))
    .map((city) => ({
      value: city as string,
      label: city as string,
    }));

  const filteredProjects = serviceAreaFiltered.filter((project) => {
    if (selectedTrade) {
      const trades = (project.trades || []) as string[];
      if (!trades.includes(selectedTrade)) return false;
    }

    if (
      selectedState &&
      project.location_state?.trim().toUpperCase() !==
        selectedState.toUpperCase()
    ) {
      return false;
    }

    if (
      selectedCity &&
      project.location_city?.trim().toLowerCase() !==
        selectedCity.toLowerCase()
    ) {
      return false;
    }

    if (!searchTerm) return true;

    const tradeLabels = ((project.trades || []) as TradeCategory[]).map(
      (trade) => TRADE_LABELS[trade]
    );
    const searchable = [
      project.title,
      stripHtml(project.description || ""),
      project.location_city,
      project.location_state,
      ...tradeLabels,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return searchable.includes(searchTerm);
  });

  // Build the canonical query string for the active filters. Used by the
  // "Save current search" form so saved searches replay exactly what the
  // bidder is currently looking at — and the alerts logic in actions.ts
  // already knows how to read these keys.
  const activeQuery = new URLSearchParams();
  for (const key of BROWSE_PARAM_KEYS) {
    const value = params[key];
    if (value && value.trim()) {
      activeQuery.set(key, value.trim());
    }
  }
  const activeQueryString = activeQuery.toString();
  const hasActiveFilters = activeQueryString.length > 0;

  // Quick "My Specialties" chip — only meaningful if the bidder has selected
  // specialties AND the trade filter isn't already pinned to one of them.
  const hasOwnSpecialties = bidderSpecialties.length > 0;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">
          Browse Open Projects 🔍
        </h1>
        <p className="mt-1 text-text-secondary">
          Find projects that match your trade and submit a bid.
        </p>
        {hasServiceAreas && (
          <p className="mt-1 text-sm text-text-muted">
            Showing {filteredProjects.length} project{filteredProjects.length === 1 ? "" : "s"} in your service area
            {filteredProjects.length < (projects || []).length && (
              <span> ({(projects || []).length} total open)</span>
            )}
          </p>
        )}
      </div>

      {/* Filter by Trade (and friends): URL-driven so deep-links and saved
          searches just work. The trade dropdown only includes trades that are
          actually present in the open-project pool the bidder can see. */}
      <div className="mb-6 rounded-xl border border-border bg-surface p-4 shadow-sm space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-text-primary">
              <Search className="h-4 w-4" />
              Filter Open Projects
            </h2>
            <p className="mt-1 text-sm text-text-muted">
              Narrow the list by trade, location, or keywords. Showing{" "}
              {filteredProjects.length} of {serviceAreaFiltered.length} project
              {serviceAreaFiltered.length === 1 ? "" : "s"}.
            </p>
          </div>
          {hasActiveFilters && (
            <Link
              href="/bidder/projects"
              className="inline-flex items-center gap-2 self-start rounded-full bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
            >
              <X className="h-4 w-4" />
              Clear all filters
            </Link>
          )}
        </div>

        <div className="max-w-xl">
          <AdminSearchBar placeholder="Search project title, description, location, or trade..." />
        </div>

        {hasOwnSpecialties && (
          <div className="flex flex-wrap gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-text-muted self-center mr-1">
              My Specialties:
            </span>
            {bidderSpecialties.map((trade) => {
              const isActive = selectedTrade === trade;
              const next = new URLSearchParams(activeQueryString);
              if (isActive) {
                next.delete("trade");
              } else {
                next.set("trade", trade);
              }
              const queryString = next.toString();
              const href = queryString
                ? `/bidder/projects?${queryString}`
                : "/bidder/projects";
              return (
                <Link
                  key={trade}
                  href={href}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    isActive
                      ? "bg-secondary text-white hover:bg-secondary-dark"
                      : "bg-secondary/10 text-secondary hover:bg-secondary/15"
                  }`}
                >
                  <Sparkles className="h-3 w-3" />
                  {TRADE_LABELS[trade]}
                </Link>
              );
            })}
          </div>
        )}

        <AdminFilterBar>
          <FilterDropdown
            paramName="trade"
            label="Trade"
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
        </AdminFilterBar>
      </div>

      {/* Saved Searches — collapsed by default so the project grid is above
          the fold on first load. Uses the native <details>/<summary> element
          so no client-side JS is needed; the group-open: Tailwind modifier
          rotates the chevron when the section is expanded. */}
      <details className="group mb-6 rounded-xl border border-border bg-surface shadow-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 select-none">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-2 text-base font-semibold text-text-primary">
              <Bookmark className="h-4 w-4" />
              Saved Project Searches
            </span>
            {savedSearches && savedSearches.length > 0 && (
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                {savedSearches.length} saved
              </span>
            )}
            <HelpHint
              id="saved-searches-explainer"
              variant="icon"
              title="How saved searches and alerts work"
            >
              <strong>Save a search</strong> stores your current filters
              (trade, state, city, keywords) so you can re-apply them with one
              click later. <br />
              <br />
              <strong>Alert me</strong> sends you a notification whenever a
              <em> new</em> project is posted that matches that saved search —
              so you can be one of the first bidders on it. <br />
              <br />
              <strong>Check Alerts</strong> manually re-runs your saved
              searches against the latest projects and surfaces any new
              matches you haven&apos;t seen yet.
            </HelpHint>
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 text-text-muted transition-transform duration-200 group-open:rotate-180" />
        </summary>

        <div className="border-t border-border px-4 pb-4 pt-4">
          <p className="mb-4 text-sm text-text-muted">
            Save a search by trade or location and get notified when new matching projects are posted.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <form
              action={async (formData: FormData) => {
                "use server";
                await saveBidderProjectSearch(formData);
              }}
              className="flex flex-wrap gap-2 items-end"
            >
              <input type="hidden" name="queryString" value={activeQueryString} />
              <input
                type="text"
                name="label"
                maxLength={80}
                placeholder={
                  hasActiveFilters
                    ? "Name this search (saves current filters)"
                    : "Name this search (e.g. 'Electrical in CA')"
                }
                className="w-56 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <label className="flex items-center gap-2 text-sm text-text-primary">
                <input
                  type="checkbox"
                  name="notifyOnNewMatches"
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                Alert me
              </label>
              <button
                type="submit"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-primary-dark"
              >
                Save
              </button>
            </form>
            <form
              action={async () => {
                "use server";
                await checkBidderProjectAlerts();
              }}
            >
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-hover"
              >
                <RefreshCcw className="h-3.5 w-3.5" />
                Check Alerts
              </button>
            </form>
          </div>

          {savedSearches && savedSearches.length > 0 && (
            <div className="mt-4 space-y-2">
              {savedSearches.slice(0, 5).map((saved) => (
                <div
                  key={saved.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-bg-warm px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <Link
                      href={
                        saved.query_string
                          ? `/bidder/projects?${saved.query_string}`
                          : "/bidder/projects"
                      }
                      className="block truncate text-sm font-semibold text-text-primary hover:text-primary"
                    >
                      {saved.label}
                    </Link>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-text-muted">
                      <span>Saved {new Date(saved.created_at).toLocaleDateString()}</span>
                      {saved.notify_on_new_matches && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
                          Alerts on
                        </span>
                      )}
                    </div>
                  </div>
                  <form
                    action={async (formData: FormData) => {
                      "use server";
                      await deleteBidderProjectSearch(formData);
                    }}
                  >
                    <input type="hidden" name="searchId" value={saved.id} />
                    <button
                      type="submit"
                      className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-red-50 hover:text-red-600"
                      aria-label={`Delete saved search ${saved.label}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </div>
      </details>

      {filteredProjects.length > 0 ? (
        <div className="space-y-4">
          {filteredProjects.map((project) => {
            const previewFile = getProjectPreviewFile(project.project_files || []);
            const thumbUrl = getProjectPreviewUrl(previewFile);
            const mediaSummary = getProjectMediaSummary(project.project_files || []);
            const previewIsVideo = isProjectVideo(previewFile);
            const customer = customerProfileMap.get(project.customer_id);
            const paidPool = poolMap.get(project.id) || null;
            const reviewStats = customerReviewStats.get(project.customer_id) || {
              verifiedAverageRating: null,
              totalReviewCount: 0,
            };
            const heartCount = customerHeartCounts.get(project.customer_id) || 0;
            const paidEstimateLive = isPaidEstimatePoolVisibleAsPaid(paidPool);
            const eligibility = paidPool
              ? getPaidEstimateEligibility(
                  (bidderCredentials || null) as BidderCredentials | null,
                  paidPool.filter
                )
              : null;
            const missingLabels = eligibility?.missingCoreCredentials.map(
              (field) => CORE_CREDENTIAL_LABELS[field]
            );

            return (
            <div key={project.id} className="group relative">
              {/* Print button overlay — sits ABOVE the card link so clicking
                  it opens the printable summary instead of navigating into
                  the project. Hidden on mobile to keep the card clean,
                  shown on hover for desktop. */}
              <div className="pointer-events-none absolute right-3 top-3 z-10 opacity-0 transition-opacity group-hover:opacity-100 sm:right-4 sm:top-4">
                <div className="pointer-events-auto">
                  <PrintProjectButton
                    projectId={project.id}
                    variant="muted"
                    label="Print"
                    title="Open a print-friendly copy of this project"
                  />
                </div>
              </div>
            <Link
              href={`/bidder/projects/${project.id}`}
              className="block rounded-xl border border-border bg-surface p-4 shadow-sm transition-all hover:border-secondary/30 hover:shadow-md sm:p-6"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
                {/* Project Thumbnail */}
                <div className="relative h-44 w-full overflow-hidden rounded-lg border border-border bg-bg-warm sm:h-20 sm:w-20 sm:shrink-0">
                  {thumbUrl ? (
                    <Image
                      src={thumbUrl}
                      alt={project.title}
                      fill
                      sizes="(max-width: 640px) 100vw, 80px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <ImageIcon className="h-8 w-8 text-text-muted/40" />
                    </div>
                  )}
                  {previewIsVideo && (
                    <span className="absolute left-2 top-2 rounded-full bg-slate-950/80 px-2 py-0.5 text-[10px] font-semibold text-white">
                      VIDEO
                    </span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <h2 className="text-xl font-semibold leading-tight text-text-primary sm:text-lg">
                    {project.title}
                  </h2>
                  {paidEstimateLive && paidPool && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-semibold text-primary">
                        <BadgeDollarSign className="h-3.5 w-3.5" />
                        Paid Estimate
                      </span>
                      <span className="text-money inline-flex items-center rounded-full bg-surface-hover px-2.5 py-0.5 text-xs font-medium">
                        ${Number(paidPool.reward_amount).toLocaleString()} per estimate
                      </span>
                      <span className="inline-flex items-center rounded-full bg-surface-hover px-2.5 py-0.5 text-xs font-medium text-text-primary">
                        {getRemainingPaidSlots(paidPool)} slot
                        {getRemainingPaidSlots(paidPool) === 1 ? "" : "s"} left
                      </span>
                    </div>
                  )}

                  <p className="mt-2 text-sm text-text-secondary line-clamp-3 sm:line-clamp-2">
                    {stripHtml(project.description)}
                  </p>

                  <div className="mt-4 grid gap-2 text-sm text-text-muted sm:mt-3 sm:flex sm:flex-wrap sm:items-center sm:gap-4 sm:text-xs">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {project.location_city}, {project.location_state}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      Posted{" "}
                      {new Date(project.created_at).toLocaleDateString()}
                    </span>
                    {project.budget_max && (
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-3.5 w-3.5" />
                        ${Number(project.budget_min || 0).toLocaleString()} –
                        ${Number(project.budget_max).toLocaleString()}
                      </span>
                    )}
                    {project.desired_start_date && (
                      <span>
                        Start:{" "}
                        {new Date(
                          project.desired_start_date
                        ).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {project.expertise_level ? (
                      <span className="rounded-full bg-secondary/10 px-2.5 py-0.5 text-xs font-medium text-secondary">
                        {EXPERTISE_LEVEL_LABELS[project.expertise_level as ExpertiseLevel]}
                      </span>
                    ) : (
                      (project.trades as TradeCategory[]).map((trade) => (
                        <span
                          key={trade}
                          className="rounded-full bg-secondary/10 px-2.5 py-0.5 text-xs font-medium text-secondary"
                        >
                          {TRADE_LABELS[trade]}
                        </span>
                      ))
                    )}
                  </div>

                  {mediaSummary.totalCount > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      {mediaSummary.imageCount > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-surface-hover px-2.5 py-1 text-text-secondary">
                          <ImageIcon className="h-3.5 w-3.5" />
                          {mediaSummary.imageCount} photo
                          {mediaSummary.imageCount === 1 ? "" : "s"}
                        </span>
                      )}
                      {mediaSummary.videoCount > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-surface-hover px-2.5 py-1 text-text-secondary">
                          <Video className="h-3.5 w-3.5" />
                          {mediaSummary.videoCount} video
                          {mediaSummary.videoCount === 1 ? "" : "s"}
                        </span>
                      )}
                      {mediaSummary.documentCount > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-surface-hover px-2.5 py-1 text-text-secondary">
                          <FileIcon className="h-3.5 w-3.5" />
                          {mediaSummary.documentCount} doc
                          {mediaSummary.documentCount === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="mt-4 rounded-lg border border-border bg-bg-warm px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                      Customer Snapshot
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-text-secondary">
                      <div className="flex items-center gap-2">
                        <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full border border-border bg-surface">
                          {customer?.avatar_url ? (
                            <Image
                              src={customer.avatar_url}
                              alt={customer.full_name}
                              fill
                              sizes="36px"
                              className="object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/15 to-secondary/15 text-xs font-semibold text-text-primary">
                              {(customer?.full_name || "Project Owner")
                                .split(" ")
                                .map((namePart: string) => namePart[0])
                                .join("")
                                .toUpperCase()
                                .slice(0, 2)}
                            </div>
                          )}
                        </div>
                        <span className="font-medium text-text-primary">
                          {customer?.full_name || "Project Owner"}
                        </span>
                      </div>
                      {customer?.city && customer?.state && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {customer.city}, {customer.state}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Star className="h-3.5 w-3.5 text-amber-500" />
                        {reviewStats.verifiedAverageRating === null
                          ? "New"
                          : reviewStats.verifiedAverageRating.toFixed(1)}
                        {" · "}
                        {reviewStats.totalReviewCount} review
                        {reviewStats.totalReviewCount === 1 ? "" : "s"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Heart className="h-3.5 w-3.5 text-primary" />
                        {heartCount} heart{heartCount === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>

                  {paidEstimateLive && paidPool && eligibility && (
                    <div className="mt-4 rounded-lg border border-border bg-bg-warm px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-semibold text-text-primary">
                          Paid estimate details
                        </span>
                        <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-medium text-text-primary">
                          {PAID_ESTIMATE_FILTER_LABELS[paidPool.filter]}
                        </span>
                        {eligibility.isEligible ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                            <ShieldCheck className="h-3.5 w-3.5" />
                            Eligible for paid slot
                          </span>
                        ) : (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                            Unpaid bidding still allowed
                          </span>
                        )}
                      </div>
                      {!eligibility.isEligible && missingLabels && missingLabels.length > 0 && (
                        <p className="mt-2 text-xs text-text-secondary">
                          Missing for paid eligibility: {missingLabels.join(", ")}.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="sm:ml-6 sm:shrink-0">
                  <span className="inline-flex w-full items-center justify-center rounded-lg bg-secondary px-4 py-3 text-sm font-semibold text-white shadow-sm sm:w-auto sm:py-2">
                    View & Bid →
                  </span>
                </div>
              </div>
            </Link>
            </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface py-16 text-center shadow-sm">
          <Search className="mx-auto h-12 w-12 text-text-muted/40" />
          <p className="mt-4 text-lg font-medium text-text-secondary">
            {hasActiveFilters
              ? "No projects match those filters"
              : "No open projects right now"}
          </p>
          <p className="mt-1 text-sm text-text-muted">
            {hasActiveFilters ? (
              <>
                Try a broader trade or location, or{" "}
                <Link
                  href="/bidder/projects"
                  className="font-medium text-primary hover:underline"
                >
                  clear all filters
                </Link>
                .
              </>
            ) : (
              "Check back soon — new projects are posted regularly!"
            )}
          </p>
        </div>
      )}
    </div>
  );
}
