import Stripe from "stripe";

let stripeClient: Stripe | null = null;

function trimTrailingSlash(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

export function getStripeServerClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error("Missing STRIPE_SECRET_KEY.");
  }

  if (!stripeClient) {
    stripeClient = new Stripe(secretKey);
  }

  return stripeClient;
}

export function getStripeWebhookSecrets() {
  const webhookSecrets = [
    process.env.STRIPE_WEBHOOK_SECRET,
    ...(process.env.STRIPE_WEBHOOK_SECRETS || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  ].filter((value, index, values): value is string => {
    return Boolean(value) && values.indexOf(value) === index;
  });

  if (webhookSecrets.length === 0) {
    throw new Error(
      "Missing STRIPE_WEBHOOK_SECRET or STRIPE_WEBHOOK_SECRETS."
    );
  }

  return webhookSecrets;
}

export function getSiteUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL;

  if (configuredUrl) {
    return trimTrailingSlash(configuredUrl);
  }

  return "http://localhost:3000";
}

export function getStripeConnectReturnUrl() {
  return `${getSiteUrl()}/bidder/payouts?stripeConnect=return`;
}

export function getStripeConnectRefreshUrl() {
  return `${getSiteUrl()}/bidder/payouts?stripeConnect=refresh`;
}

export function getEstimatorStripeConnectReturnUrl() {
  return `${getSiteUrl()}/estimator/payouts?stripeConnect=return`;
}

export function getEstimatorStripeConnectRefreshUrl() {
  return `${getSiteUrl()}/estimator/payouts?stripeConnect=refresh`;
}
