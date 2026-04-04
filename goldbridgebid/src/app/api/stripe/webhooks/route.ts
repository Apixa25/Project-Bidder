import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getStripeServerClient,
  getStripeWebhookSecrets,
} from "@/lib/stripe/server";
import { syncBidderPayoutAccountFromStripe } from "@/lib/stripe/connect";
import { markPaidEstimatePoolFunded } from "@/lib/paid-estimates/funding";

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

  let event: Stripe.Event | null = null;

  try {
    const webhookSecrets = getStripeWebhookSecrets();
    let lastError: unknown = null;

    for (const webhookSecret of webhookSecrets) {
      try {
        event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
      }
    }

    if (!event) {
      throw lastError;
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid Stripe webhook signature.";

    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (!event) {
    return NextResponse.json(
      { error: "Stripe webhook event could not be verified." },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        if (session.payment_status === "paid") {
          await markPaidEstimatePoolFunded({
            admin: createAdminClient(),
            metadata: {
              projectId: session.metadata?.projectId,
              customerId: session.metadata?.customerId,
            },
            stripeIds: {
              paymentIntentId:
                typeof session.payment_intent === "string"
                  ? session.payment_intent
                  : null,
              checkoutSessionId: session.id,
            },
          });
        }
        break;
      }
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;

        await markPaidEstimatePoolFunded({
          admin: createAdminClient(),
          metadata: {
            projectId: paymentIntent.metadata?.projectId,
            customerId: paymentIntent.metadata?.customerId,
          },
          stripeIds: {
            paymentIntentId: paymentIntent.id,
          },
        });
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
