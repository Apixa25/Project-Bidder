import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import NotificationsList from "@/components/notifications/NotificationsList";
import PushNotificationToggle from "@/components/notifications/PushNotificationToggle";
import { userHasRole } from "@/lib/auth/roles";

export default async function BidderNotificationsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  if (!(await userHasRole(user.id, "bidder"))) redirect("/login");

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
          Stay updated on project changes, bid status, and messages.
        </p>
      </div>
      <div className="mb-6">
        <PushNotificationToggle />
      </div>
      <NotificationsList notifications={notifications || []} basePath="/bidder" />
    </div>
  );
}
