import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { BADGE_CONFIG } from "@/lib/badges";
import type { BadgeLevel } from "@/types/database";
import AdminSearchBar from "@/components/admin/AdminSearchBar";
import AdminFilterBar, { FilterDropdown } from "@/components/admin/AdminFilters";
import AdminPagination from "@/components/admin/AdminPagination";
import ExportButton from "@/components/admin/ExportButton";
import UserTable from "./UserTable";

const PAGE_SIZE = 25;

interface Props {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

export default async function AdminUsersPage({ searchParams }: Props) {
  const params = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();
  if (currentProfile?.role !== "admin") redirect("/login");

  const { data: allProfiles } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  const profileIds = (allProfiles || []).map((p) => p.user_id);
  const { data: roleRows } = profileIds.length
    ? await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", profileIds)
    : { data: [] };

  const roleMap = new Map<string, string[]>();
  for (const profile of allProfiles || []) {
    roleMap.set(profile.user_id, [profile.role]);
  }
  for (const row of roleRows || []) {
    const roles = roleMap.get(row.user_id) || [];
    if (!roles.includes(row.role)) roles.push(row.role);
    roleMap.set(row.user_id, roles);
  }

  const bidderUserIds = (allProfiles || [])
    .filter((p) => (roleMap.get(p.user_id) || []).includes("bidder"))
    .map((p) => p.user_id);

  const { data: credentials } =
    bidderUserIds.length > 0
      ? await supabase
          .from("bidder_credentials")
          .select("user_id, badge_level")
          .in("user_id", bidderUserIds)
      : { data: [] };

  const credMap = new Map(
    (credentials || []).map((c) => [c.user_id, c])
  );

  const searchTerm = (params.q || "").toLowerCase();

  const filtered = (allProfiles || []).filter((p) => {
    const roles = roleMap.get(p.user_id) || [p.role];

    if (params.role && !roles.includes(params.role)) return false;
    if (params.banned === "true" && !p.is_banned) return false;
    if (params.banned === "false" && p.is_banned) return false;

    if (searchTerm) {
      const searchable = [
        p.full_name,
        p.email,
        p.business_name,
        p.phone,
        p.city,
        p.state,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!searchable.includes(searchTerm)) return false;
    }

    if (params.badge) {
      if (!roles.includes("bidder")) return false;
      const creds = credMap.get(p.user_id);
      if (params.badge === "none" && creds?.badge_level) return false;
      if (params.badge !== "none" && creds?.badge_level !== params.badge)
        return false;
    }

    return true;
  });

  const totalItems = filtered.length;
  const page = Math.max(1, Number(params.page || "1"));
  const paginated = filtered.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  const exportData = filtered.map((p) => ({
    name: p.full_name,
    email: p.email,
    role: (roleMap.get(p.user_id) || [p.role]).join(", "),
    business: p.business_name || "",
    phone: p.phone,
    location: p.city && p.state ? `${p.city}, ${p.state}` : "",
    banned: p.is_banned ? "Yes" : "No",
    joined: new Date(p.created_at).toLocaleDateString(),
  }));

  const tableUsers = paginated.map((p) => {
    const roles = roleMap.get(p.user_id) || [p.role];
    const creds = credMap.get(p.user_id);
    const badge = creds?.badge_level as BadgeLevel;
    const badgeInfo = badge ? BADGE_CONFIG[badge] : null;

    return {
      id: p.id,
      user_id: p.user_id,
      full_name: p.full_name,
      business_name: p.business_name,
      email: p.email,
      is_banned: p.is_banned,
      created_at: p.created_at,
      city: p.city,
      state: p.state,
      address: p.address,
      exact_address_map_image_url: p.exact_address_map_image_url,
      roles,
      badgeLabel: badgeInfo?.label || null,
      badgeIcon: badgeInfo?.icon || null,
      badgeBgColor: badgeInfo?.bgColor || null,
      badgeColor: badgeInfo?.color || null,
      isBidder: roles.includes("bidder"),
    };
  });

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            User Management 👥
          </h1>
          <p className="mt-1 text-text-secondary">
            {totalItems} user{totalItems !== 1 ? "s" : ""} found.
          </p>
        </div>
        <ExportButton
          data={exportData}
          filename="projectxbidx-users"
          columns={[
            { key: "name", label: "Name" },
            { key: "email", label: "Email" },
            { key: "role", label: "Role" },
            { key: "business", label: "Business" },
            { key: "phone", label: "Phone" },
            { key: "location", label: "Location" },
            { key: "banned", label: "Banned" },
            { key: "joined", label: "Joined" },
          ]}
        />
      </div>

      <div className="mb-6 space-y-4">
        <div className="max-w-md">
          <AdminSearchBar placeholder="Search by name, email, business, phone..." />
        </div>
        <AdminFilterBar>
          <FilterDropdown
            paramName="role"
            label="Role"
            options={[
              { value: "customer", label: "Customer" },
              { value: "bidder", label: "Bidder" },
              { value: "admin", label: "Admin" },
            ]}
          />
          <FilterDropdown
            paramName="badge"
            label="Badge"
            options={[
              { value: "gold", label: "Gold" },
              { value: "silver", label: "Silver" },
              { value: "bronze", label: "Bronze" },
              { value: "none", label: "None" },
            ]}
          />
          <FilterDropdown
            paramName="banned"
            label="Ban Status"
            options={[
              { value: "true", label: "Banned" },
              { value: "false", label: "Active" },
            ]}
          />
        </AdminFilterBar>
      </div>

      <UserTable users={tableUsers} />

      <AdminPagination totalItems={totalItems} pageSize={PAGE_SIZE} />
    </div>
  );
}
