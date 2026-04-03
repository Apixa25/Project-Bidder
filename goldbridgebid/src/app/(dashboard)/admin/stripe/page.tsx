import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  getStripeCronUrls,
  getStripeReadinessItems,
  getStripeWebhookUrl,
} from "@/lib/stripe/readiness";
import { getSiteUrl } from "@/lib/stripe/server";

export default async function AdminStripeReadinessPage() {
  const supabase = await createClient();
  const admin = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();
  if (profile?.role !== "admin") redirect("/login");

  const siteUrl = getSiteUrl();
  const readinessItems = getStripeReadinessItems();
  const webhookUrl = getStripeWebhookUrl(siteUrl);
  const cronUrls = getStripeCronUrls(siteUrl);

  const [
    { count: fundedPoolCount },
    { count: payoutPendingCount },
    { count: payoutAccountCount },
    { count: payoutReadyCount },
    { count: openDisputeCount },
  ] = await Promise.all([
    admin
      .from("project_paid_estimate_pools")
      .select("*", { count: "exact", head: true })
      .not("funded_at", "is", null),
    admin
      .from("paid_estimate_claims")
      .select("*", { count: "exact", head: true })
      .eq("claim_status", "payout_pending"),
    admin
      .from("bidder_payout_accounts")
      .select("*", { count: "exact", head: true }),
    admin
      .from("bidder_payout_accounts")
      .select("*", { count: "exact", head: true })
      .eq("charges_enabled", true)
      .eq("payouts_enabled", true),
    admin
      .from("paid_estimate_disputes")
      .select("*", { count: "exact", head: true })
      .eq("review_status", "open"),
  ]);

  const allEnvReady = readinessItems.every((item) => item.isReady);

  const checklist = [
    "Use Stripe test mode in the Stripe dashboard before creating any keys or webhook endpoints.",
    "Add `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (or `STRIPE_WEBHOOK_SECRETS` for multiple destinations), `NEXT_PUBLIC_SITE_URL`, and `CRON_SECRET` to local and hosted environments.",
    "Enable Stripe Connect for the platform account and confirm Express connected accounts are available in test mode.",
    `Create one webhook endpoint at ${webhookUrl} and subscribe to checkout.session.completed, payment_intent.succeeded, and account.updated.`,
    "Apply the latest Supabase migrations, including the bidder payout account and transfer tracking migrations.",
    "Configure scheduled authenticated calls to each cron endpoint using the CRON secret.",
    "Run one full test flow: fund a paid estimate pool, onboard a bidder in Stripe test mode, submit a paid bid, let it move to payout pending, then process payout cron.",
    "Verify database state after the test: claim status, paid-out timestamp, transfer ID, pool totals, and customer/bidder notifications.",
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">
          Stripe Readiness ✅
        </h1>
        <p className="mt-1 text-text-secondary">
          Preflight checks for the paid-estimate Stripe test-mode rollout.
        </p>
      </div>

      <div className="mb-8 rounded-xl border border-border bg-surface p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  allEnvReady
                    ? "bg-green-100 text-green-700"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {allEnvReady ? "Environment Ready" : "Configuration Incomplete"}
              </span>
            </div>
            <p className="mt-3 text-sm text-text-secondary">
              This page is the safest place to confirm app-side Stripe readiness
              before flipping on real test-mode webhooks, payouts, and cron jobs.
            </p>
          </div>
          <Link
            href="/admin/paid-estimates"
            className="inline-flex items-center justify-center rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-hover"
          >
            Back to Paid Estimates
          </Link>
        </div>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Funded Pools", value: fundedPoolCount || 0 },
          { label: "Payout Pending", value: payoutPendingCount || 0 },
          { label: "Payout Accounts", value: payoutAccountCount || 0 },
          { label: "Ready Accounts", value: payoutReadyCount || 0 },
          { label: "Open Disputes", value: openDisputeCount || 0 },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-border bg-surface p-5 shadow-sm"
          >
            <p className="text-sm text-text-muted">{stat.label}</p>
            <p className="mt-2 text-2xl font-bold text-text-primary">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <div className="mb-8 rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-text-primary">
          Environment Checks
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {readinessItems.map((item) => (
            <div
              key={item.label}
              className="rounded-lg border border-border bg-bg-warm px-4 py-3"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-text-primary">
                  {item.label}
                </p>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    item.isReady
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {item.isReady ? "Ready" : "Missing"}
                </span>
              </div>
              <p className="mt-2 text-xs text-text-muted">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-8 rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-text-primary">
          Endpoint Targets
        </h2>
        <div className="mt-4 space-y-3 text-sm">
          <div className="rounded-lg border border-border bg-bg-warm px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-text-muted">
              Stripe Webhook URL
            </p>
            <p className="mt-1 font-medium text-text-primary">{webhookUrl}</p>
          </div>

          {cronUrls.map((url) => (
            <div
              key={url}
              className="rounded-lg border border-border bg-bg-warm px-4 py-3"
            >
              <p className="text-xs uppercase tracking-wide text-text-muted">
                Cron Route
              </p>
              <p className="mt-1 font-medium text-text-primary">{url}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-8 rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-text-primary">
          Stripe Test Mode Checklist
        </h2>
        <ol className="mt-4 space-y-3 text-sm text-text-secondary">
          {checklist.map((item, index) => (
            <li key={item} className="flex gap-3">
              <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {index + 1}
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-sm text-text-muted">
          Full setup notes also live in `goldbridgebid/STRIPE_TEST_MODE_CHECKLIST.md`.
        </p>
      </div>
    </div>
  );
}
