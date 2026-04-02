# Stripe Test Mode Checklist

This checklist prepares `ProjectXBidX.com` for the paid-estimate Stripe rollout in **test mode** before any live switch.

It supports the product direction in `project-vision.md`:

- paid estimates remain an optional monetization layer
- trust and transparency stay core product values
- payment infrastructure is layered in carefully without breaking the sealed-bid marketplace

## 1. Stripe Dashboard Setup

1. Open Stripe in **test mode**.
2. Confirm the platform account has access to **Stripe Connect**.
3. Use **Express connected accounts** for contractor onboarding.
4. Copy these test-mode values:
   - publishable key
   - secret key
   - webhook signing secret

## 2. Local App Environment

Add these values to `goldbridgebid/.env.local`:

```bash
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
CRON_SECRET=your-long-random-secret
```

Also ensure Supabase env vars are already configured:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## 3. Database Readiness

Run all current migrations, including the payout-related ones:

- `goldbridgebid/supabase/migrations/021_bidder_payout_accounts.sql`
- `goldbridgebid/supabase/migrations/022_paid_estimate_transfer_tracking.sql`

## 4. Stripe Webhook Endpoint

Create one Stripe webhook endpoint pointing to:

```text
<YOUR_SITE_URL>/api/stripe/webhooks
```

Subscribe to these events in **test mode**:

- `checkout.session.completed`
- `payment_intent.succeeded`
- `account.updated`

These events currently support:

- funding paid estimate pools
- syncing connected account readiness

## 5. Cron / Scheduled Routes

Configure authenticated scheduled calls for:

- `/api/cron/release-paid-estimates`
- `/api/cron/process-paid-estimate-payouts`
- `/api/cron/refund-unused-paid-estimates`

Send one of these headers with each scheduled request:

- `Authorization: Bearer <CRON_SECRET>`
- `x-cron-secret: <CRON_SECRET>`

## 6. In-App Preflight Check

Before testing the full flow, verify:

1. Visit `goldbridgebid/src/app/(dashboard)/admin/stripe/page.tsx` in the running app at `/admin/stripe`.
2. Confirm all environment checks are marked ready.
3. Confirm the webhook URL and cron route URLs match the deployment you intend to test.
4. Confirm funded pools / payout-pending counts look reasonable for your test data.

## 7. Full Test Flow

Run one end-to-end Stripe **test mode** scenario:

1. Create or convert a customer project into a paid estimate pool.
2. Fund the pool through Stripe Checkout.
3. Confirm the project becomes visibly funded in the app.
4. As a bidder, start Stripe onboarding from `/bidder/payouts`.
5. Refresh payout status until the bidder is payout-ready.
6. Submit an eligible paid estimate bid.
7. Let the claim move from `paid_reserved` to `payout_pending`.
8. Trigger `/api/cron/process-paid-estimate-payouts`.
9. Confirm the claim becomes `paid_out`.
10. Confirm `stripe_transfer_id` is stored on the claim.

## 8. Verify Database State

After the test flow, verify:

- `paid_estimate_claims.claim_status`
- `paid_estimate_claims.paid_out_at`
- `paid_estimate_claims.stripe_transfer_id`
- `project_paid_estimate_pools.reserved_total_amount`
- `project_paid_estimate_pools.paid_out_total_amount`
- customer and bidder notifications for funded, pending, and paid-out states

## 9. Safe Rollout Notes

- Start in Stripe test mode only.
- Test one contractor and one paid pool first.
- Keep manual admin payout fallback available while validating automation.
- Do not rely on payout automation until webhook syncing, cron auth, and connected account readiness are all verified together.
