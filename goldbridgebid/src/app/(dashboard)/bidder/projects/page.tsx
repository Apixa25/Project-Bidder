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
  Heart,
  Star,
  BadgeDollarSign,
  ShieldCheck,
} from "lucide-react";
import { TRADE_LABELS } from "@/types/database";
import type {
  TradeCategory,
  ProjectPaidEstimatePool,
  BidderCredentials,
} from "@/types/database";
import { userHasRole } from "@/lib/auth/roles";
import {
  CORE_CREDENTIAL_LABELS,
  getPaidEstimateEligibility,
  PAID_ESTIMATE_FILTER_LABELS,
} from "@/lib/paid-estimates/eligibility";
import {
  getRemainingPaidSlots,
  isPaidEstimatePoolVisibleAsPaid,
} from "@/lib/paid-estimates/pools";

export default async function BrowseProjectsPage() {
  const supabase = await createClient();
  const admin = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  if (!(await userHasRole(user.id, "bidder"))) redirect("/login");

  const { data: projects } = await supabase
    .from("projects")
    .select("*, project_files(id, file_url, thumbnail_url, file_type, annotated_url)")
    .eq("status", "open")
    .order("created_at", { ascending: false });

  const { data: bidderCredentials } = await supabase
    .from("bidder_credentials")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  const customerIds = Array.from(
    new Set((projects || []).map((project) => project.customer_id))
  );
  const projectIds = (projects || []).map((project) => project.id);

  const { data: customerProfiles } = customerIds.length
    ? await supabase
        .from("profiles")
        .select("user_id, full_name, business_name, city, state, created_at, avatar_url")
        .in("user_id", customerIds)
    : { data: [] };

  const { data: customerReviewRows } = customerIds.length
    ? await supabase
        .from("user_reviews")
        .select("reviewee_user_id, rating_overall, review_type, status")
        .in("reviewee_user_id", customerIds)
        .eq("status", "published")
    : { data: [] };

  const { data: customerHearts } = customerIds.length
    ? await supabase
        .from("profile_hearts")
        .select("target_user_id")
        .in("target_user_id", customerIds)
    : { data: [] };

  const { data: poolRows } = projectIds.length
    ? await admin
        .from("project_paid_estimate_pools")
        .select("*")
        .in("project_id", projectIds)
    : { data: [] };

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

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">
          Browse Open Projects 🔍
        </h1>
        <p className="mt-1 text-text-secondary">
          Find projects that match your trade and submit a bid.
        </p>
      </div>

      {projects && projects.length > 0 ? (
        <div className="space-y-4">
          {projects.map((project) => {
            const imageFiles = (project.project_files || []).filter(
              (f: { file_type: string }) => f.file_type.startsWith("image/")
            );
            const firstImage = imageFiles[0] as
              | { thumbnail_url: string | null; annotated_url: string | null; file_url: string }
              | undefined;
            const thumbUrl = firstImage
              ? firstImage.annotated_url || firstImage.thumbnail_url || firstImage.file_url
              : null;
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
            <Link
              key={project.id}
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
                      <span className="inline-flex items-center rounded-full bg-surface-hover px-2.5 py-0.5 text-xs font-medium text-text-primary">
                        ${Number(paidPool.reward_amount).toLocaleString()} per estimate
                      </span>
                      <span className="inline-flex items-center rounded-full bg-surface-hover px-2.5 py-0.5 text-xs font-medium text-text-primary">
                        {getRemainingPaidSlots(paidPool)} slot
                        {getRemainingPaidSlots(paidPool) === 1 ? "" : "s"} left
                      </span>
                    </div>
                  )}

                  <p className="mt-2 text-sm text-text-secondary line-clamp-3 sm:line-clamp-2">
                    {project.description}
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
                    {(project.trades as TradeCategory[]).map((trade) => (
                      <span
                        key={trade}
                        className="rounded-full bg-secondary/10 px-2.5 py-0.5 text-xs font-medium text-secondary"
                      >
                        {TRADE_LABELS[trade]}
                      </span>
                    ))}
                  </div>

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
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface py-16 text-center shadow-sm">
          <Search className="mx-auto h-12 w-12 text-text-muted/40" />
          <p className="mt-4 text-lg font-medium text-text-secondary">
            No open projects right now
          </p>
          <p className="mt-1 text-sm text-text-muted">
            Check back soon — new projects are posted regularly!
          </p>
        </div>
      )}
    </div>
  );
}
