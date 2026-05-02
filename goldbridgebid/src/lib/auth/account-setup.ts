import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/types/database";

type AdminClient = ReturnType<typeof createAdminClient>;

interface BootstrapEstimatorProfileOptions {
  admin?: AdminClient;
  userId: string;
  fullName?: string | null;
  businessName?: string | null;
  email?: string | null;
}

interface AccountSignalOptions {
  admin?: AdminClient;
  userId: string;
  email?: string | null;
  phone?: string | null;
  businessName?: string | null;
  requestHeaders?: Headers;
  source: "email_signup" | "oauth_signup" | "login";
}

type SignalConfidence = "low" | "medium" | "high";

const PUBLIC_SIGNUP_ROLES = new Set<UserRole>([
  "customer",
  "bidder",
  "estimator",
]);

function cleanText(value: string | null | undefined) {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}

function normalizePhone(value: string | null | undefined) {
  const digits = value?.replace(/\D/g, "");
  return digits && digits.length >= 7 ? digits : null;
}

function getEmailDomain(value: string | null | undefined) {
  const email = cleanText(value)?.toLowerCase();
  const domain = email?.split("@")[1]?.trim();
  return domain || null;
}

function getClientIp(headers?: Headers) {
  const forwardedFor = headers?.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() || null;

  return (
    headers?.get("x-real-ip") ||
    headers?.get("cf-connecting-ip") ||
    headers?.get("x-vercel-forwarded-for") ||
    null
  );
}

function hashSignal(value: string) {
  const salt =
    process.env.ACCOUNT_SIGNAL_HASH_SALT ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "projectxbidx-local-account-signal-salt";

  return createHash("sha256")
    .update(`${salt}:${value}`)
    .digest("hex");
}

function confidenceForSignal(signalType: string): SignalConfidence {
  if (signalType === "phone" || signalType === "business_name") return "high";
  if (signalType === "email_domain") return "medium";
  return "low";
}

function sortUserPair(userA: string, userB: string) {
  return userA < userB
    ? { userId: userA, relatedUserId: userB }
    : { userId: userB, relatedUserId: userA };
}

export function parsePublicSignupRole(value: string | null | undefined): UserRole | null {
  return PUBLIC_SIGNUP_ROLES.has(value as UserRole) ? (value as UserRole) : null;
}

export function getDashboardPathForRole(role: UserRole) {
  if (role === "admin") return "/admin";
  if (role === "estimator") return "/estimator/profile";
  if (role === "bidder") return "/bidder";
  return "/customer";
}

export async function isEstimatorProfileComplete({
  admin = createAdminClient(),
  userId,
}: {
  admin?: AdminClient;
  userId: string;
}) {
  const { data: profile, error } = await admin
    .from("estimator_profiles")
    .select("display_name, headline, bio")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !profile) return false;

  const hasDisplayName = Boolean(profile.display_name?.trim());
  const hasPublicSummary = Boolean(profile.headline?.trim() || profile.bio?.trim());

  return hasDisplayName && hasPublicSummary;
}

export async function getPostAuthPathForRole({
  admin = createAdminClient(),
  role,
  userId,
}: {
  admin?: AdminClient;
  role: UserRole;
  userId: string;
}) {
  if (role !== "estimator") {
    return getDashboardPathForRole(role);
  }

  return (await isEstimatorProfileComplete({ admin, userId }))
    ? "/estimator"
    : "/estimator/profile";
}

export async function bootstrapEstimatorProfile({
  admin = createAdminClient(),
  userId,
  fullName,
  businessName,
  email,
}: BootstrapEstimatorProfileOptions) {
  const displayName =
    cleanText(businessName) || cleanText(fullName) || cleanText(email) || "Estimator";

  const { error } = await admin.from("estimator_profiles").upsert(
    {
      user_id: userId,
      display_name: displayName,
    },
    { onConflict: "user_id", ignoreDuplicates: true }
  );

  if (error) {
    console.error("Estimator profile bootstrap error:", error);
    return { error: "Estimator profile setup failed." };
  }

  return { success: true };
}

export async function recordAccountIdentitySignals({
  admin,
  userId,
  email,
  phone,
  businessName,
  requestHeaders,
  source,
}: AccountSignalOptions) {
  let adminClient: AdminClient;

  try {
    adminClient = admin || createAdminClient();
  } catch (error) {
    console.error("Account identity signal setup skipped:", error);
    return;
  }

  const rawSignals = [
    { signal_type: "phone", value: normalizePhone(phone) },
    { signal_type: "email_domain", value: getEmailDomain(email) },
    { signal_type: "business_name", value: cleanText(businessName)?.toLowerCase() || null },
    { signal_type: "ip", value: getClientIp(requestHeaders) },
    { signal_type: "user_agent", value: requestHeaders?.get("user-agent") || null },
  ].filter((signal): signal is { signal_type: string; value: string } =>
    Boolean(signal.value)
  );

  for (const signal of rawSignals) {
    const signalValueHash = hashSignal(`${signal.signal_type}:${signal.value}`);
    const confidence = confidenceForSignal(signal.signal_type);
    const nowIso = new Date().toISOString();

    const { data: matchingSignals } = await adminClient
      .from("account_identity_signals")
      .select("user_id")
      .eq("signal_type", signal.signal_type)
      .eq("signal_value_hash", signalValueHash)
      .neq("user_id", userId)
      .limit(25);

    const { error: signalError } = await adminClient
      .from("account_identity_signals")
      .upsert(
        {
          user_id: userId,
          signal_type: signal.signal_type,
          signal_value_hash: signalValueHash,
          confidence,
          source,
          last_seen_at: nowIso,
        },
        { onConflict: "user_id,signal_type,signal_value_hash" }
      );

    if (signalError) {
      console.error("Account identity signal insert error:", signalError);
      continue;
    }

    const uniqueRelatedIds = Array.from(
      new Set((matchingSignals || []).map((entry) => entry.user_id))
    );

    for (const relatedUserId of uniqueRelatedIds) {
      const pair = sortUserPair(userId, relatedUserId);
      const { error: linkError } = await adminClient
        .from("account_risk_links")
        .upsert(
          {
            user_id: pair.userId,
            related_user_id: pair.relatedUserId,
            signal_type: signal.signal_type,
            confidence,
            reason: `Matched ${signal.signal_type} account signal.`,
            last_seen_at: nowIso,
          },
          { onConflict: "user_id,related_user_id,signal_type" }
        );

      if (linkError) {
        console.error("Account risk link insert error:", linkError);
      }
    }
  }
}

