import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { User, Calendar } from "lucide-react";
import ProfileForm from "@/components/profile/ProfileForm";

export default async function CustomerProfilePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!profile) redirect("/login");

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">My Profile 👤</h1>
        <p className="mt-1 text-text-secondary">
          Manage your account information.
        </p>
      </div>

      {/* Account Info Card */}
      <div className="mb-8 rounded-xl border border-border bg-surface p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <User className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-text-primary">
              {profile.full_name}
            </h2>
            <p className="text-sm text-text-muted">{profile.email}</p>
            <div className="mt-1 flex items-center gap-3 text-xs text-text-muted">
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 font-medium text-primary capitalize">
                {profile.role}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Member since{" "}
                {new Date(profile.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Profile Form */}
      <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="mb-6 text-lg font-semibold text-text-primary">
          Edit Profile
        </h2>
        <ProfileForm profile={profile} />
      </div>
    </div>
  );
}
