"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSiteUrl, getStripeServerClient } from "@/lib/stripe/server";

export interface EstimatePackageCheckoutActionState {
  error: string | null;
  checkoutUrl: string | null;
}

export async function unlockFreeEstimatePackage(packageId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You must be signed in to unlock this package." };

  const admin = createAdminClient();
  const { data: packageRow, error: packageError } = await admin
    .from("estimate_packages")
    .select("id, estimator_id, status, price_cents, currency, current_version_id")
    .eq("id", packageId)
    .single();

  if (packageError || !packageRow) {
    return { error: "Estimate package could not be found." };
  }

  if (packageRow.status !== "published") {
    return { error: "Only published packages can be unlocked." };
  }

  if (Number(packageRow.price_cents) !== 0) {
    return { error: "This package requires paid checkout." };
  }

  if (!packageRow.current_version_id) {
    return { error: "This package does not have a published version yet." };
  }

  if (packageRow.estimator_id === user.id) {
    return { success: true };
  }

  const { error: purchaseError } = await admin
    .from("estimate_package_purchases")
    .upsert(
      {
        package_id: packageRow.id,
        package_version_id: packageRow.current_version_id,
        buyer_id: user.id,
        seller_id: packageRow.estimator_id,
        price_cents: 0,
        currency: packageRow.currency || "usd",
      },
      { onConflict: "package_version_id,buyer_id", ignoreDuplicates: true }
    );

  if (purchaseError) {
    console.error("Free estimate package unlock error:", purchaseError);
    return { error: "Unable to unlock this package right now." };
  }

  revalidatePath("/estimate-packages");
  revalidatePath(`/estimate-packages/${packageRow.id}`);

  return { success: true };
}

export async function createEstimatePackageCheckoutSession(
  packageId: string
): Promise<EstimatePackageCheckoutActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in to buy this package.", checkoutUrl: null };
  }

  const admin = createAdminClient();
  const { data: packageRow, error: packageError } = await admin
    .from("estimate_packages")
    .select("id, estimator_id, title, summary, status, price_cents, currency, current_version_id")
    .eq("id", packageId)
    .single();

  if (packageError || !packageRow) {
    return { error: "Estimate package could not be found.", checkoutUrl: null };
  }

  if (packageRow.status !== "published") {
    return { error: "Only published packages can be purchased.", checkoutUrl: null };
  }

  if (!packageRow.current_version_id) {
    return {
      error: "This package does not have a published version yet.",
      checkoutUrl: null,
    };
  }

  if (packageRow.estimator_id === user.id) {
    return {
      error: "You already have owner access to this package.",
      checkoutUrl: null,
    };
  }

  if (Number(packageRow.price_cents) <= 0) {
    return {
      error: "This package is free. Use the free unlock button instead.",
      checkoutUrl: null,
    };
  }

  const { data: existingPurchase } = await admin
    .from("estimate_package_purchases")
    .select("id")
    .eq("package_version_id", packageRow.current_version_id)
    .eq("buyer_id", user.id)
    .maybeSingle();

  if (existingPurchase) {
    return {
      error: null,
      checkoutUrl: `${getSiteUrl()}/estimate-packages/${packageRow.id}`,
    };
  }

  try {
    const stripe = getStripeServerClient();
    const packageUrl = `${getSiteUrl()}/estimate-packages/${packageRow.id}`;
    const currency = (packageRow.currency || "usd").toLowerCase();
    const metadata = {
      kind: "estimate_package_purchase",
      packageId: packageRow.id,
      packageVersionId: packageRow.current_version_id,
      buyerId: user.id,
      sellerId: packageRow.estimator_id,
      priceCents: String(packageRow.price_cents),
      currency,
    };

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: `${packageUrl}?packageCheckout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${packageUrl}?packageCheckout=cancelled`,
      metadata,
      payment_intent_data: {
        metadata,
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency,
            unit_amount: packageRow.price_cents,
            product_data: {
              name: packageRow.title,
              description: packageRow.summary.slice(0, 500),
            },
          },
        },
      ],
    });

    return { error: null, checkoutUrl: session.url ?? null };
  } catch (error) {
    console.error("Create estimate package checkout session error:", error);
    return {
      error: "Stripe checkout could not be prepared right now.",
      checkoutUrl: null,
    };
  }
}

