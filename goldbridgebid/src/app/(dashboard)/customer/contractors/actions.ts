"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { userHasRole } from "@/lib/auth/roles";
import {
  countUploadedCredentials,
  hasCoreCredentials,
} from "@/lib/badges";
import { TRADE_LABELS, type BadgeLevel, type TradeCategory } from "@/types/database";

const ALLOWED_QUERY_PARAMS = new Set([
  "q",
  "badge",
  "trade",
  "state",
  "city",
  "sort",
]);

function sanitizeQueryString(raw: string) {
  const query = raw.startsWith("?") ? raw.slice(1) : raw;
  const incoming = new URLSearchParams(query);
  const sanitized = new URLSearchParams();

  for (const [key, value] of incoming.entries()) {
    if (!ALLOWED_QUERY_PARAMS.has(key) || !value.trim()) {
      continue;
    }

    sanitized.set(key, value.trim());
  }

  return sanitized.toString();
}

function normalize(value: string | null | undefined) {
  return (value || "").trim();
}

function contractorMatchesQuery(
  contractor: {
    profile: {
      full_name: string;
      business_name: string | null;
      city: string;
      state: string;
      bio: string | null;
    };
    badgeLevel: BadgeLevel;
    specialties: TradeCategory[];
    specialtyLabels: string[];
  },
  queryString: string
) {
  const params = new URLSearchParams(queryString);
  const searchTerm = normalize(params.get("q")).toLowerCase();
  const badge = normalize(params.get("badge"));
  const trade = normalize(params.get("trade"));
  const state = normalize(params.get("state")).toUpperCase();
  const city = normalize(params.get("city")).toLowerCase();

  if (badge) {
    if (badge === "none" && contractor.badgeLevel) return false;
    if (badge !== "none" && contractor.badgeLevel !== badge) return false;
  }

  if (trade && !contractor.specialties.includes(trade as TradeCategory)) {
    return false;
  }

  if (state && normalize(contractor.profile.state).toUpperCase() !== state) {
    return false;
  }

  if (city && normalize(contractor.profile.city).toLowerCase() !== city) {
    return false;
  }

  if (!searchTerm) {
    return true;
  }

  const searchable = [
    contractor.profile.full_name,
    contractor.profile.business_name,
    contractor.profile.city,
    contractor.profile.state,
    contractor.profile.bio,
    ...contractor.specialtyLabels,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return searchable.includes(searchTerm);
}

async function getDirectoryContractors() {
  const supabase = await createClient();

  const { data: credentialRows } = await supabase
    .from("bidder_credentials")
    .select(
      "user_id, badge_level, license_url, bond_url, insurance_url, workers_comp_url, ein_url, references_url"
    );

  const bidderUserIds = (credentialRows || []).map((row) => row.user_id);

  const { data: profiles } = bidderUserIds.length
    ? await supabase
        .from("profiles")
        .select("user_id, full_name, business_name, city, state, bio, created_at, is_banned")
        .in("user_id", bidderUserIds)
        .eq("is_banned", false)
    : { data: [] };

  const { data: specialties } = bidderUserIds.length
    ? await supabase
        .from("bidder_specialties")
        .select("user_id, trade, display_order")
        .in("user_id", bidderUserIds)
        .order("display_order", { ascending: true })
    : { data: [] };

  const specialtiesMap = new Map<string, TradeCategory[]>();
  for (const specialty of specialties || []) {
    const current = specialtiesMap.get(specialty.user_id) || [];
    current.push(specialty.trade as TradeCategory);
    specialtiesMap.set(specialty.user_id, current);
  }

  const credentialMap = new Map(
    (credentialRows || []).map((row) => [row.user_id, row])
  );

  return (profiles || []).map((profile) => {
    const credentials = credentialMap.get(profile.user_id) || null;
    const bidderSpecialties = specialtiesMap.get(profile.user_id) || [];

    return {
      profile,
      badgeLevel: (credentials?.badge_level as BadgeLevel) || null,
      qualificationCount: countUploadedCredentials(credentials),
      hasCoreCheck: hasCoreCredentials(credentials),
      specialties: bidderSpecialties,
      specialtyLabels: bidderSpecialties.map((trade) => TRADE_LABELS[trade]),
    };
  });
}

export async function saveContractorSearch(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  if (!(await userHasRole(user.id, "customer"))) {
    return { error: "Enable customer mode to save contractor searches." };
  }

  const label = ((formData.get("label") as string) || "").trim();
  const queryString = sanitizeQueryString(
    ((formData.get("queryString") as string) || "").trim()
  );
  const notifyOnNewMatches = formData.get("notifyOnNewMatches") === "on";

  if (!label) {
    return { error: "Please give this search a short name." };
  }

  const { error } = await supabase
    .from("customer_saved_contractor_searches")
    .insert({
      user_id: user.id,
      label: label.slice(0, 80),
      query_string: queryString,
      notify_on_new_matches: notifyOnNewMatches,
    });

  if (error) {
    console.error("Save contractor search error:", error);
    return { error: "Could not save this search right now." };
  }

  revalidatePath("/customer/contractors");
  return { success: true };
}

export async function checkContractorSearchAlerts() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  if (!(await userHasRole(user.id, "customer"))) {
    return { error: "Enable customer mode to check contractor alerts." };
  }

  const { data: savedSearches } = await supabase
    .from("customer_saved_contractor_searches")
    .select("*")
    .eq("user_id", user.id)
    .eq("notify_on_new_matches", true);

  if (!savedSearches || savedSearches.length === 0) {
    revalidatePath("/customer/contractors");
    return { success: true };
  }

  const contractors = await getDirectoryContractors();
  const nowIso = new Date().toISOString();
  let createdCount = 0;

  for (const savedSearch of savedSearches) {
    const since = new Date(
      savedSearch.last_notified_at || savedSearch.created_at
    ).getTime();

    const newMatches = contractors.filter((contractor) => {
      const createdAt = new Date(contractor.profile.created_at).getTime();
      return (
        createdAt > since &&
        contractorMatchesQuery(contractor, savedSearch.query_string)
      );
    });

    if (newMatches.length > 0) {
      const contractorLabel =
        newMatches.length === 1 ? "1 new contractor" : `${newMatches.length} new contractors`;

      const { error: notificationError } = await supabase
        .from("notifications")
        .insert({
          user_id: user.id,
          type: "contractor_search_alert",
          title: `New matches for ${savedSearch.label}`,
          message: `${contractorLabel} matched your saved search.`,
          link: savedSearch.query_string
            ? `/customer/contractors?${savedSearch.query_string}`
            : "/customer/contractors",
        });

      if (!notificationError) {
        createdCount += 1;
      }
    }

    await supabase
      .from("customer_saved_contractor_searches")
      .update({ last_notified_at: nowIso })
      .eq("id", savedSearch.id)
      .eq("user_id", user.id);
  }

  revalidatePath("/customer/contractors");
  revalidatePath("/customer/notifications");
  return { success: true, createdCount };
}

export async function deleteContractorSearch(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  if (!(await userHasRole(user.id, "customer"))) {
    return { error: "Enable customer mode to manage saved contractor searches." };
  }

  const searchId = (formData.get("searchId") as string) || "";

  if (!searchId) {
    return { error: "Missing saved search id." };
  }

  const { error } = await supabase
    .from("customer_saved_contractor_searches")
    .delete()
    .eq("id", searchId)
    .eq("user_id", user.id);

  if (error) {
    console.error("Delete contractor search error:", error);
    return { error: "Could not delete this saved search right now." };
  }

  revalidatePath("/customer/contractors");
  return { success: true };
}
