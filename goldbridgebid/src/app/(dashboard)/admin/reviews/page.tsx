import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AdminFilterBar, { FilterDropdown } from "@/components/admin/AdminFilters";
import AdminSearchBar from "@/components/admin/AdminSearchBar";
import AdminPagination from "@/components/admin/AdminPagination";
import ReviewModerationList from "./ReviewModerationList";

interface Props {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

const PAGE_SIZE = 20;

export default async function AdminReviewsPage({ searchParams }: Props) {
  const params = await searchParams;
  const supabase = await createClient();

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

  const { data: allReviews } = await supabase
    .from("user_reviews")
    .select("*")
    .order("created_at", { ascending: false });

  const reviewIds = (allReviews || []).map((review) => review.id);
  const { data: reviewFlags } = reviewIds.length
    ? await supabase
        .from("flagged_content")
        .select("content_id, resolved")
        .eq("content_type", "review")
        .in("content_id", reviewIds)
    : { data: [] };

  const profileIds = Array.from(
    new Set(
      (allReviews || []).flatMap((review) => [
        review.reviewer_user_id,
        review.reviewee_user_id,
      ])
    )
  );

  const { data: reviewProfiles } = profileIds.length
    ? await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", profileIds)
    : { data: [] };

  const profileMap = new Map(
    (reviewProfiles || []).map((entry) => [entry.user_id, entry.full_name])
  );

  const flagCountMap = new Map<string, number>();
  for (const flag of reviewFlags || []) {
    if (flag.resolved) continue;
    flagCountMap.set(flag.content_id, (flagCountMap.get(flag.content_id) || 0) + 1);
  }

  const searchTerm = (params.q || "").toLowerCase();
  const filteredReviews = (allReviews || []).filter((review) => {
    if (params.type && review.review_type !== params.type) return false;
    if (params.status && review.status !== params.status) return false;
    if (params.reported === "true" && (flagCountMap.get(review.id) || 0) === 0) return false;
    if (params.reported === "false" && (flagCountMap.get(review.id) || 0) > 0) return false;

    if (searchTerm) {
      const searchable = [
        review.review_title,
        review.review_body,
        review.relationship_context,
        profileMap.get(review.reviewer_user_id),
        profileMap.get(review.reviewee_user_id),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (!searchable.includes(searchTerm)) return false;
    }

    return true;
  });

  const reviewItems = filteredReviews.map((review) => ({
    ...review,
    reviewerName: profileMap.get(review.reviewer_user_id) || "Unknown user",
    revieweeName: profileMap.get(review.reviewee_user_id) || "Unknown user",
    reviewerUserId: review.reviewer_user_id,
    revieweeUserId: review.reviewee_user_id,
    reportCount: flagCountMap.get(review.id) || 0,
  }));

  const totalItems = reviewItems.length;
  const page = Math.max(1, Number(params.page || "1"));
  const paginatedItems = reviewItems.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
        <h1 className="text-2xl font-bold text-text-primary">Reviews Moderation 📝</h1>
        <p className="mt-1 text-text-secondary">
          {totalItems} review{totalItems === 1 ? "" : "s"} match the current filters.
        </p>
        </div>
        <div className="max-w-md">
          <AdminSearchBar placeholder="Search reviewer, reviewee, title, or body..." />
        </div>
      </div>

      <div className="mb-6">
        <AdminFilterBar>
          <FilterDropdown
            paramName="type"
            label="Type"
            options={[
              { value: "verified_platform", label: "Verified" },
              { value: "public_reference", label: "Public Reference" },
            ]}
          />
          <FilterDropdown
            paramName="status"
            label="Status"
            options={[
              { value: "published", label: "Published" },
              { value: "flagged", label: "Flagged" },
              { value: "hidden", label: "Hidden" },
            ]}
          />
          <FilterDropdown
            paramName="reported"
            label="Reported"
            options={[
              { value: "true", label: "Reported" },
              { value: "false", label: "Not Reported" },
            ]}
          />
        </AdminFilterBar>
      </div>

      <ReviewModerationList reviews={paginatedItems} />
      <div className="mt-6">
        <AdminPagination totalItems={totalItems} pageSize={PAGE_SIZE} />
      </div>
    </div>
  );
}
