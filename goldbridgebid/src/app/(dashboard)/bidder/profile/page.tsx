import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { User, Calendar, Shield, ArrowRight } from "lucide-react";
import { BADGE_CONFIG } from "@/lib/badges";
import type { BadgeLevel } from "@/types/database";
import ProfileForm from "@/components/profile/ProfileForm";

export default async function BidderProfilePage() {
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

  const { data: credentials } = await supabase
    .from("bidder_credentials")
    .select("badge_level")
    .eq("user_id", user.id)
    .single();

  const badgeLevel = credentials?.badge_level as BadgeLevel;
  const badgeInfo = badgeLevel ? BADGE_CONFIG[badgeLevel] : null;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">My Profile 👤</h1>
        <p className="mt-1 text-text-secondary">
          Manage your account and business information.
        </p>
      </div>

      {/* Account Info Card */}
      <div className="mb-8 rounded-xl border border-border bg-surface p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary/10">
              <User className="h-7 w-7 text-secondary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-text-primary">
                {profile.full_name}
              </h2>
              {profile.business_name && (
                <p className="text-sm text-text-secondary">
                  {profile.business_name}
                </p>
              )}
              <p className="text-sm text-text-muted">{profile.email}</p>
              <div className="mt-1 flex items-center gap-3 text-xs text-text-muted">
                <span className="inline-flex items-center gap-1 rounded-full bg-secondary/10 px-2.5 py-0.5 font-medium text-secondary capitalize">
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

          <div className="flex items-center gap-3">
            {badgeInfo ? (
              <div
                className={`flex items-center gap-2 rounded-full ${badgeInfo.bgColor} px-4 py-2`}
              >
                <span className="text-lg">{badgeInfo.icon}</span>
                <span
                  className={`text-sm font-semibold ${badgeInfo.color}`}
                >
                  {badgeInfo.label}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-full bg-gray-100 px-4 py-2">
                <Shield className="h-5 w-5 text-gray-400" />
                <span className="text-sm font-medium text-gray-500">
                  No Badge
                </span>
              </div>
            )}
            <Link
              href="/bidder/credentials"
              className="flex items-center gap-1 text-sm font-medium text-primary hover:text-primary-dark transition-colors"
            >
              Credentials
              <ArrowRight className="h-4 w-4" />
            </Link>
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
