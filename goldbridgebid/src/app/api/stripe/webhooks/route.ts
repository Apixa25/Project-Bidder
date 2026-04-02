import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getStripeServerClient,
  getStripeWebhookSecret,
} from "@/lib/stripe/server";
import { syncBidderPayoutAccountFromStripe } from "@/lib/stripe/connect";

async function markPoolFunded(
  metadata: Record<string, string | undefined>,
  stripeIds: {
    paymentIntentId?: string | null;
    checkoutSessionId?: string | null;
  }
) {
  const projectId = metadata.projectId;
  const customerId = metadata.customerId;

  if (!projectId || !customerId) {
    return;
  }

  const supabase = createAdminClient();
  const { data: existingPool } = await supabase
    .from("project_paid_estimate_pools")
    .select("id, funded_at, status, stripe_payment_intent_id, stripe_checkout_session_id")
    .eq("project_id", projectId)
    .maybeSingle();

  if (!existingPool) {
    return;
  }

  const nowIso = new Date().toISOString();
  const alreadyFunded = Boolean(existingPool.funded_at);

  const nextStatus =
    existingPool.status === "full" ? "full" : "active";

  const { error: updateError } = await supabase
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
    return;
  }

  if (!alreadyFunded) {
    await supabase.from("notifications").insert({
      user_id: customerId,
      type: "paid_estimate_pool_funded",
      title: "Paid estimate pool is live",
      message:
        "Your paid estimate offer is funded and now visible to contractors.",
      link: `/customer/projects/${projectId}`,
    });
  }
}

export async function POST(request: Request) {
  const stripe = getStripeServerClient();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing Stripe signature." },
      { status: 400 }
    );
  }

  const payload = await request.text();

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      payload,
      signature,
      getStripeWebhookSecret()
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid Stripe webhook signature.";

    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        if (session.payment_status === "paid") {
          await markPoolFunded(
            {
              projectId: session.metadata?.projectId,
              customerId: session.metadata?.customerId,
            },
            {
              paymentIntentId:
                typeof session.payment_intent === "string"
                  ? session.payment_intent
                  : null,
              checkoutSessionId: session.id,
            }
          );
        }
        break;
      }
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;

        await markPoolFunded(
          {
            projectId: paymentIntent.metadata?.projectId,
            customerId: paymentIntent.metadata?.customerId,
          },
          {
            paymentIntentId: paymentIntent.id,
          }
        );
        break;
      }
      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        const supabase = createAdminClient();

        await syncBidderPayoutAccountFromStripe({
          admin: supabase,
          stripe,
          stripeAccountId: account.id,
        });
        break;
      }
      default:
        break;
    }
  } catch (error) {
    console.error("Stripe webhook handling error:", error);
    return NextResponse.json(
      { error: "Webhook handling failed." },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}
