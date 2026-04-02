import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import AdminFilterBar, {
  FilterDropdown,
} from "@/components/admin/AdminFilters";
import DisputesList from "./DisputesList";

interface Props {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

export default async function AdminDisputesPage({ searchParams }: Props) {
  const params = await searchParams;
  const supabase = await createClient();
  const admin = createAdminClient();

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

  let query = admin
    .from("paid_estimate_disputes")
    .select("*")
    .order("created_at", { ascending: false });

  if (params.status) {
    query = query.eq("review_status", params.status);
  }

  if (params.reason) {
    query = query.eq("reason", params.reason);
  }

  const { data: disputes } = await query;

  const projectIds = [...new Set((disputes || []).map((item) => item.project_id))];
  const bidderIds = [...new Set((disputes || []).map((item) => item.bidder_id))];

  const { data: projects } = projectIds.length
    ? await supabase.from("projects").select("id, title").in("id", projectIds)
    : { data: [] };
  const { data: bidders } = bidderIds.length
    ? await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", bidderIds)
    : { data: [] };

  const projectMap = new Map((projects || []).map((item) => [item.id, item.title]));
  const bidderMap = new Map(
    (bidders || []).map((item) => [item.user_id, item.full_name || "Unknown user"])
  );

  const disputeItems = (disputes || []).map((dispute) => ({
    ...dispute,
    projectTitle: projectMap.get(dispute.project_id) || "Deleted project",
    bidderName: bidderMap.get(dispute.bidder_id) || "Unknown bidder",
  }));

  const openCount = disputeItems.filter((item) => item.review_status === "open").length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">
          Paid Estimate Disputes ⚖️
        </h1>
        <p className="mt-1 text-text-secondary">
          {openCount} open dispute{openCount === 1 ? "" : "s"} · {disputeItems.length}{" "}
          total.
        </p>
      </div>

      <div className="mb-6">
        <AdminFilterBar>
          <FilterDropdown
            paramName="status"
            label="Status"
            options={[
              { value: "open", label: "Open" },
              { value: "resolved_paid", label: "Resolved Paid" },
              { value: "resolved_denied", label: "Resolved Denied" },
            ]}
          />
          <FilterDropdown
            paramName="reason"
            label="Reason"
            options={[
              { value: "blank_or_spam", label: "Blank or Spam" },
              { value: "wrong_trade", label: "Wrong Trade" },
              { value: "duplicate_submission", label: "Duplicate Submission" },
              { value: "abusive_or_irrelevant", label: "Abusive or Irrelevant" },
              {
                value: "not_qualified_at_submission",
                label: "Not Qualified at Submission",
              },
            ]}
          />
        </AdminFilterBar>
      </div>

      <DisputesList disputes={disputeItems} />
    </div>
  );
}
