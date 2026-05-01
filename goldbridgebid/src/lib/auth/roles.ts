import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/database";

export async function getUserRoles(userId: string): Promise<UserRole[]> {
  const supabase = await createClient();

  const { data: roleRows } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  const roles = (roleRows || [])
    .map((row) => row.role as UserRole)
    .filter(
      (role) =>
        role === "customer" ||
        role === "bidder" ||
        role === "admin" ||
        role === "estimator"
    );

  if (roles.length > 0) {
    return Array.from(new Set(roles));
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", userId)
    .single();

  return profile?.role ? [profile.role as UserRole] : [];
}

export async function userHasRole(userId: string, requiredRole: UserRole) {
  const roles = await getUserRoles(userId);
  return roles.includes(requiredRole);
}

export async function getProfileRevalidatePaths(userId: string) {
  const roles = await getUserRoles(userId);
  const paths = new Set<string>([`/profile/${userId}`]);

  if (roles.includes("customer")) {
    paths.add("/customer/profile");
  }

  if (roles.includes("bidder")) {
    paths.add("/bidder/profile");
  }

  if (roles.includes("estimator")) {
    paths.add("/estimator/profile");
  }

  return [...paths];
}
