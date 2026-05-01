import { redirect } from "next/navigation";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { userHasRole } from "@/lib/auth/roles";

export default async function EstimatorNotificationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  if (!(await userHasRole(user.id, "estimator"))) redirect("/login");

  const { data: notifications } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(25);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">Notifications</h1>
        <p className="mt-1 text-text-secondary">
          Estimator alerts will appear here as package and request workflows come online.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-surface shadow-sm">
        {(notifications || []).length === 0 ? (
          <div className="px-6 py-12 text-center">
            <Bell className="mx-auto mb-4 h-10 w-10 text-text-muted" />
            <h2 className="text-base font-semibold text-text-primary">
              No notifications yet
            </h2>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {(notifications || []).map((notification) => (
              <div key={notification.id} className="px-6 py-4">
                <h2 className="font-semibold text-text-primary">
                  {notification.title}
                </h2>
                <p className="mt-1 text-sm text-text-secondary">
                  {notification.message}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

