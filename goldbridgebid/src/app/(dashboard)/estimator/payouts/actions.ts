"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { userHasRole } from "@/lib/auth/roles";
import {
  getEstimatorStripeConnectRefreshUrl,
  getEstimatorStripeConnectReturnUrl,
  getStripeServerClient,
} from "@/lib/stripe/server";
import { syncEstimatorPayoutAccountFromStripe } from "@/lib/stripe/connect";

async function requireEstimatorUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." } as const;
  }

  if (!(await userHasRole(user.id, "estimator"))) {
    return {
      error: "Enable estimator mode to manage package payout settings.",
    } as const;
  }

  return { user, supabase } as const;
}

export async function beginEstimatorPayoutOnboarding() {
  const estimator = await requireEstimatorUser();
  if ("error" in estimator) {
    return estimator;
  }

  try {
    const admin = createAdminClient();
    const stripe = getStripeServerClient();

    const { data: payoutAccount } = await admin
      .from("estimator_payout_accounts")
      .select("*")
      .eq("user_id", estimator.user.id)
      .maybeSingle();

    let stripeAccountId = payoutAccount?.stripe_account_id || null;

    if (!stripeAccountId) {
      const account = await stripe.accounts.create({
        type: "express",
        email: estimator.user.email,
        metadata: {
          userId: estimator.user.id,
          role: "estimator",
        },
      });

      stripeAccountId = account.id;

      await admin.from("estimator_payout_accounts").upsert(
        {
          user_id: estimator.user.id,
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
      await syncEstimatorPayoutAccountFromStripe({
        admin,
        stripe,
        stripeAccountId,
        fallbackUserId: estimator.user.id,
      });
    }

    const link = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: getEstimatorStripeConnectRefreshUrl(),
      return_url: getEstimatorStripeConnectReturnUrl(),
      type: "account_onboarding",
    });

    revalidatePath("/estimator/payouts");
    revalidatePath("/estimator");
    return { success: true, url: link.url };
  } catch (error) {
    console.error("Begin estimator payout onboarding error:", error);
    return {
      error:
        "Stripe payout onboarding is not ready yet. Add your real Stripe configuration before testing this step.",
    };
  }
}

export async function refreshEstimatorPayoutStatus() {
  const estimator = await requireEstimatorUser();
  if ("error" in estimator) {
    return estimator;
  }

  try {
    const admin = createAdminClient();
    const stripe = getStripeServerClient();
    const { data: payoutAccount } = await admin
      .from("estimator_payout_accounts")
      .select("stripe_account_id")
      .eq("user_id", estimator.user.id)
      .maybeSingle();

    if (!payoutAccount?.stripe_account_id) {
      return { error: "Start payout onboarding before refreshing status." };
    }

    await syncEstimatorPayoutAccountFromStripe({
      admin,
      stripe,
      stripeAccountId: payoutAccount.stripe_account_id,
      fallbackUserId: estimator.user.id,
    });

    revalidatePath("/estimator/payouts");
    revalidatePath("/estimator");
    revalidatePath("/estimator/packages");
    return { success: true };
  } catch (error) {
    console.error("Refresh estimator payout status error:", error);
    return {
      error:
        "Could not refresh Stripe payout status yet. Add live Stripe configuration before testing this step.",
    };
  }
}
