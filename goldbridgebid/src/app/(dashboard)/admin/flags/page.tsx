import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AdminFilterBar, { FilterDropdown } from "@/components/admin/AdminFilters";
import FlaggedContentList from "./FlaggedContentList";

interface Props {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

export default async function AdminFlagsPage({ searchParams }: Props) {
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

  let query = supabase
    .from("flagged_content")
    .select("*")
    .order("created_at", { ascending: false });

  if (params.type) {
    query = query.eq("content_type", params.type);
  }
  if (params.status === "resolved") {
    query = query.eq("resolved", true);
  } else if (params.status === "unresolved") {
    query = query.eq("resolved", false);
  }

  const { data: flags } = await query;

  // Fetch reporter profiles
  const reporterIds = [...new Set((flags || []).map((f) => f.reporter_id))];
  const { data: reporterProfiles } =
    reporterIds.length > 0
      ? await supabase
          .from("profiles")
          .select("user_id, full_name, email")
          .in("user_id", reporterIds)
      : { data: [] };
  const reporterMap = Object.fromEntries(
    (reporterProfiles || []).map((p) => [p.user_id, p])
  );

  // Fetch content previews for each flag
  const contentPreviews: Record<string, string> = {};
  const reviewMetaMap: Record<
    string,
    { reviewId: string; revieweeUserId: string | null; status: string }
  > = {};
  for (const flag of flags || []) {
    if (flag.content_type === "project") {
      const { data } = await supabase
        .from("projects")
        .select("title")
        .eq("id", flag.content_id)
        .single();
      contentPreviews[flag.id] = data?.title || "Deleted project";
    } else if (flag.content_type === "bid") {
      const { data } = await supabase
        .from("bids")
        .select("price, trade, projects!inner(title)")
        .eq("id", flag.content_id)
        .single();
      if (data) {
        const proj = data.projects as unknown as { title: string };
        contentPreviews[flag.id] = `$${Number(data.price).toLocaleString()} bid on "${proj.title}"`;
      } else {
        contentPreviews[flag.id] = "Deleted bid";
      }
    } else if (flag.content_type === "user") {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("user_id", flag.content_id)
        .single();
      contentPreviews[flag.id] = data
        ? `${data.full_name} (${data.email})`
        : "Deleted user";
    } else if (flag.content_type === "message") {
      const { data } = await supabase
        .from("messages")
        .select("content")
        .eq("id", flag.content_id)
        .single();
      contentPreviews[flag.id] = data
        ? data.content.length > 100
          ? data.content.slice(0, 100) + "..."
          : data.content
        : "Deleted message";
    } else if (flag.content_type === "review") {
      const { data } = await supabase
        .from("user_reviews")
        .select("id, review_title, review_body, rating_overall, reviewee_user_id, status")
        .eq("id", flag.content_id)
        .single();

      if (data) {
        contentPreviews[flag.id] =
          `${data.rating_overall}/5 review` +
          (data.review_title ? ` • ${data.review_title}` : "") +
          ` • ${data.review_body.length > 100 ? `${data.review_body.slice(0, 100)}...` : data.review_body}`;

        reviewMetaMap[flag.id] = {
          reviewId: data.id,
          revieweeUserId: data.reviewee_user_id,
          status: data.status,
        };
      } else {
        contentPreviews[flag.id] = "Deleted review";
      }
    }
  }

  const unresolved = (flags || []).filter((f) => !f.resolved).length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">
          Flagged Content 🚩
        </h1>
        <p className="mt-1 text-text-secondary">
          {unresolved} unresolved flag{unresolved !== 1 ? "s" : ""} ·{" "}
          {(flags || []).length} total.
        </p>
      </div>

      <div className="mb-6">
        <AdminFilterBar>
          <FilterDropdown
            paramName="type"
            label="Type"
            options={[
              { value: "project", label: "Project" },
              { value: "bid", label: "Bid" },
              { value: "user", label: "User" },
              { value: "message", label: "Message" },
              { value: "review", label: "Review" },
            ]}
          />
          <FilterDropdown
            paramName="status"
            label="Status"
            options={[
              { value: "unresolved", label: "Unresolved" },
              { value: "resolved", label: "Resolved" },
            ]}
          />
        </AdminFilterBar>
      </div>

      <FlaggedContentList
        flags={flags || []}
        reporterMap={reporterMap}
        contentPreviews={contentPreviews}
        reviewMetaMap={reviewMetaMap}
      />
    </div>
  );
}
