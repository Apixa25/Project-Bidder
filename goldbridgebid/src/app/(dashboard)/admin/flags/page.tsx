import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import FlaggedContentList from "./FlaggedContentList";

export default async function AdminFlagsPage() {
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

  const { data: flags } = await supabase
    .from("flagged_content")
    .select("*")
    .order("created_at", { ascending: false });

  const reporterIds = [
    ...new Set((flags || []).map((f) => f.reporter_id)),
  ];
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

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">
          Flagged Content 🚩
        </h1>
        <p className="mt-1 text-text-secondary">
          Review reported content and take action.{" "}
          {(flags || []).filter((f) => !f.resolved).length} unresolved flags.
        </p>
      </div>

      <FlaggedContentList
        flags={flags || []}
        reporterMap={reporterMap}
      />
    </div>
  );
}
