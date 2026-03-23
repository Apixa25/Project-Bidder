import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import NotificationsList from "@/components/notifications/NotificationsList";

export default async function AdminNotificationsPage() {
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

  const { data: notifications } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">
          Notifications 🔔
        </h1>
        <p className="mt-1 text-text-secondary">
          Platform alerts, flagged content, and user activity.
        </p>
      </div>
      <NotificationsList
        notifications={notifications || []}
        basePath="/admin"
      />
    </div>
  );
}
