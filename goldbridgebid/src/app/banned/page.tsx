import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ShieldOff } from "lucide-react";
import { signOut } from "@/app/(auth)/actions";

export default async function BannedPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_banned, ban_reason")
    .eq("user_id", user.id)
    .single();

  if (!profile?.is_banned) redirect("/");

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-warm px-4">
      <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center shadow-lg">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
          <ShieldOff className="h-8 w-8 text-red-600" />
        </div>

        <h1 className="text-2xl font-bold text-text-primary">
          Account Suspended
        </h1>
        <p className="mt-2 text-text-secondary">
          Your account has been suspended by a platform administrator.
        </p>

        {profile.ban_reason && (
          <div className="mt-4 rounded-lg bg-red-50 p-4 text-left">
            <p className="text-xs font-semibold uppercase text-red-600">
              Reason
            </p>
            <p className="mt-1 text-sm text-text-primary">
              {profile.ban_reason}
            </p>
          </div>
        )}

        <p className="mt-6 text-sm text-text-muted">
          If you believe this is an error, please contact support at{" "}
          <a
            href="mailto:support@goldbridgebid.com"
            className="text-primary underline"
          >
            support@goldbridgebid.com
          </a>
        </p>

        <form action={signOut} className="mt-6">
          <button
            type="submit"
            className="w-full rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 transition-colors"
          >
            Sign Out
          </button>
        </form>
      </div>
    </div>
  );
}
