export interface StripeReadinessItem {
  label: string;
  isReady: boolean;
  value: string;
}

export function getStripeReadinessItems() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const hasWebhookSecret = Boolean(
    process.env.STRIPE_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRETS
  );

  const items: StripeReadinessItem[] = [
    {
      label: "Site URL",
      isReady: Boolean(process.env.NEXT_PUBLIC_SITE_URL),
      value: siteUrl,
    },
    {
      label: "Stripe publishable key",
      isReady: Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY),
      value: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
        ? "Configured"
        : "Missing",
    },
    {
      label: "Stripe secret key",
      isReady: Boolean(process.env.STRIPE_SECRET_KEY),
      value: process.env.STRIPE_SECRET_KEY ? "Configured" : "Missing",
    },
    {
      label: "Stripe webhook secret",
      isReady: hasWebhookSecret,
      value: hasWebhookSecret ? "Configured" : "Missing",
    },
    {
      label: "Cron secret",
      isReady: Boolean(process.env.CRON_SECRET),
      value: process.env.CRON_SECRET ? "Configured" : "Missing",
    },
  ];

  return items;
}

export function getStripeWebhookUrl(siteUrl: string) {
  return `${siteUrl.replace(/\/$/, "")}/api/stripe/webhooks`;
}

export function getStripeCronUrls(siteUrl: string) {
  const base = siteUrl.replace(/\/$/, "");

  return [
    `${base}/api/cron/release-paid-estimates`,
    `${base}/api/cron/process-paid-estimate-payouts`,
    `${base}/api/cron/refund-unused-paid-estimates`,
  ];
}
