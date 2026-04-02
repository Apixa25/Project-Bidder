"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { userHasRole } from "@/lib/auth/roles";
import {
  getStripeConnectRefreshUrl,
  getStripeConnectReturnUrl,
  getStripeServerClient,
} from "@/lib/stripe/server";

async function requireBidderUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." } as const;
  }

  if (!(await userHasRole(user.id, "bidder"))) {
    return {
      error: "Enable contractor mode to manage payout settings.",
    } as const;
  }

  return { user, supabase } as const;
}

async function syncBidderPayoutAccount(userId: string, stripeAccountId: string) {
  const admin = createAdminClient();
  const stripe = getStripeServerClient();
  const { data: existingRow } = await admin
    .from("bidder_payout_accounts")
    .select("onboarding_started_at, onboarding_completed_at")
    .eq("user_id", userId)
    .maybeSingle();
  const account = await stripe.accounts.retrieve(stripeAccountId);
  const nowIso = new Date().toISOString();
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

  return account;
}

export async function beginBidderPayoutOnboarding() {
  const bidder = await requireBidderUser();
  if ("error" in bidder) {
    return bidder;
  }

  try {
    const admin = createAdminClient();
    const stripe = getStripeServerClient();

    const { data: payoutAccount } = await admin
      .from("bidder_payout_accounts")
      .select("*")
      .eq("user_id", bidder.user.id)
      .maybeSingle();

    let stripeAccountId = payoutAccount?.stripe_account_id || null;

    if (!stripeAccountId) {
      const account = await stripe.accounts.create({
        type: "express",
        email: bidder.user.email,
        metadata: {
          userId: bidder.user.id,
        },
      });

      stripeAccountId = account.id;

      await admin.from("bidder_payout_accounts").upsert(
        {
          user_id: bidder.user.id,
          stripe_account_id: stripeAccountId,
          charges_enabled: account.charges_enabled,
          payouts_enabled: account.payouts_enabled,
          details_submitted: account.details_submitted,
          onboarding_started_at: new Date().toISOString(),
          last_status_sync_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
    } else {
      await syncBidderPayoutAccount(bidder.user.id, stripeAccountId);
    }

    const link = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: getStripeConnectRefreshUrl(),
      return_url: getStripeConnectReturnUrl(),
      type: "account_onboarding",
    });

    revalidatePath("/bidder/payouts");
    revalidatePath("/bidder");
    return { success: true, url: link.url };
  } catch (error) {
    console.error("Begin bidder payout onboarding error:", error);
    return {
      error:
        "Stripe payout onboarding is not ready yet. Add your real Stripe configuration before testing this step.",
    };
  }
}

export async function refreshBidderPayoutStatus() {
  const bidder = await requireBidderUser();
  if ("error" in bidder) {
    return bidder;
  }

  try {
    const admin = createAdminClient();
    const { data: payoutAccount } = await admin
      .from("bidder_payout_accounts")
      .select("stripe_account_id")
      .eq("user_id", bidder.user.id)
      .maybeSingle();

    if (!payoutAccount?.stripe_account_id) {
      return { error: "Start payout onboarding before refreshing status." };
    }

    await syncBidderPayoutAccount(bidder.user.id, payoutAccount.stripe_account_id);

    revalidatePath("/bidder/payouts");
    revalidatePath("/bidder");
    revalidatePath("/bidder/bids");
    return { success: true };
  } catch (error) {
    console.error("Refresh bidder payout status error:", error);
    return {
      error:
        "Could not refresh Stripe payout status yet. Add live Stripe configuration before testing this step.",
    };
  }
}
