import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export async function syncBidderPayoutAccountFromStripe(options: {
  admin: ReturnType<typeof createAdminClient>;
  stripe: Stripe;
  stripeAccountId: string;
  fallbackUserId?: string | null;
}) {
  const { admin, stripe, stripeAccountId, fallbackUserId = null } = options;

  const account = await stripe.accounts.retrieve(stripeAccountId);
  const nowIso = new Date().toISOString();

  const { data: existingRow } = await admin
    .from("bidder_payout_accounts")
    .select("user_id, onboarding_started_at, onboarding_completed_at")
    .eq("stripe_account_id", stripeAccountId)
    .maybeSingle();

  const userId =
    existingRow?.user_id ||
    (typeof account.metadata?.userId === "string" ? account.metadata.userId : null) ||
    fallbackUserId;

  if (!userId) {
    return null;
  }

  const isReady = account.charges_enabled && account.payouts_enabled;

  await admin.from("bidder_payout_accounts").upsert(
    {
      user_id: userId,
      stripe_account_id: stripeAccountId,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      details_submitted: account.details_submitted,
      onboarding_started_at: existingRow?.onboarding_started_at ?? nowIso,
      onboarding_completed_at:
        existingRow?.onboarding_completed_at ?? (isReady ? nowIso : null),
      last_status_sync_at: nowIso,
    },
    { onConflict: "user_id" }
  );

  return {
    account,
    userId,
  };
}
