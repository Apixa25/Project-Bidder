import type Stripe from "stripe";
import type { ProjectPaidEstimatePool } from "@/types/database";
import { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

export async function markPaidEstimatePoolFunded(options: {
  admin: AdminClient;
  metadata: Record<string, string | undefined>;
  stripeIds: {
    paymentIntentId?: string | null;
    checkoutSessionId?: string | null;
  };
}) {
  const { admin, metadata, stripeIds } = options;
  const projectId = metadata.projectId;
  const customerId = metadata.customerId;

  if (!projectId || !customerId) {
    return { success: false, reason: "missing_metadata" as const };
  }

  const { data: existingPool } = await admin
    .from("project_paid_estimate_pools")
    .select(
      "id, funded_at, status, stripe_payment_intent_id, stripe_checkout_session_id"
    )
    .eq("project_id", projectId)
    .maybeSingle();

  if (!existingPool) {
    return { success: false, reason: "pool_not_found" as const };
  }

  const nowIso = new Date().toISOString();
  const alreadyFunded = Boolean(existingPool.funded_at);
  const nextStatus = existingPool.status === "full" ? "full" : "active";

  const { error: updateError } = await admin
    .from("project_paid_estimate_pools")
    .update({
      is_enabled: true,
      funded_at: existingPool.funded_at ?? nowIso,
      status: nextStatus,
      stripe_payment_intent_id:
        stripeIds.paymentIntentId ?? existingPool.stripe_payment_intent_id,
      stripe_checkout_session_id:
        stripeIds.checkoutSessionId ?? existingPool.stripe_checkout_session_id,
    })
    .eq("id", existingPool.id);

  if (updateError) {
    console.error("Failed to mark paid estimate pool funded:", updateError);
    return { success: false, reason: "update_failed" as const };
  }

  if (!alreadyFunded) {
    await admin.from("notifications").insert({
      user_id: customerId,
      type: "paid_estimate_pool_funded",
      title: "Paid estimate pool is live",
      message:
        "Your paid estimate offer is funded and now visible to contractors.",
      link: `/customer/projects/${projectId}`,
    });
  }

  return { success: true, projectId, customerId } as const;
}

export async function reconcilePaidEstimatePoolFunding(options: {
  admin: AdminClient;
  stripe: Stripe;
  pool: ProjectPaidEstimatePool;
  customerId: string;
}) {
  const { admin, stripe, pool, customerId } = options;

  if (pool.funded_at && pool.is_enabled) {
    return { success: true, wasAlreadyFunded: true, didMarkFunded: false } as const;
  }

  if (pool.stripe_checkout_session_id) {
    const session = await stripe.checkout.sessions.retrieve(
      pool.stripe_checkout_session_id
    );

    if (session.payment_status === "paid") {
      await markPaidEstimatePoolFunded({
        admin,
        metadata: {
          projectId: session.metadata?.projectId || pool.project_id,
          customerId: session.metadata?.customerId || customerId,
        },
        stripeIds: {
          paymentIntentId:
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : null,
          checkoutSessionId: session.id,
        },
      });

      return {
        success: true,
        wasAlreadyFunded: false,
        didMarkFunded: true,
      } as const;
    }
  }

  if (pool.stripe_payment_intent_id) {
    const paymentIntent = await stripe.paymentIntents.retrieve(
      pool.stripe_payment_intent_id
    );

    if (paymentIntent.status === "succeeded") {
      await markPaidEstimatePoolFunded({
        admin,
        metadata: {
          projectId: paymentIntent.metadata?.projectId || pool.project_id,
          customerId: paymentIntent.metadata?.customerId || customerId,
        },
        stripeIds: {
          paymentIntentId: paymentIntent.id,
        },
      });

      return {
        success: true,
        wasAlreadyFunded: false,
        didMarkFunded: true,
      } as const;
    }
  }

  return {
    success: true,
    wasAlreadyFunded: false,
    didMarkFunded: false,
  } as const;
}
