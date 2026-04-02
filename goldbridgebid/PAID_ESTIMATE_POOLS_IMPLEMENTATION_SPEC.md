# Paid Estimate Pools v1 Implementation Spec

This document turns the agreed PRD/business rules into a codebase-specific build plan for `ProjectXBidX.com`.

It is intentionally additive. The goal is to layer paid estimate pools on top of the existing sealed-bid marketplace in `goldbridgebid/` without breaking the current customer posting, contractor bidding, messaging, notification, or admin flows.

## 1. Vision Alignment

This implementation follows the product direction in `../project-vision.md`:

- the platform remains a sealed-bid marketplace first
- contractor credentials stay optional platform-wide
- paid estimates become an optional monetization layer
- trust and transparency remain core product values

Important wording decision:

- Use `paid estimate pool`, `paid estimate offer`, and `paid estimate slot`
- Avoid product copy that promises legal escrow in v1

## 2. Locked v1 Product Decisions

- A project may start as free and later convert to paid.
- Paid activation requires successful Stripe funding.
- The `Paid Estimate` badge is shown only after funding succeeds.
- The paid pool is project-wide, not per trade.
- Existing pre-activation bids remain unpaid.
- Paid eligibility filters apply only to paid-slot access, not to overall bid access.
- Ineligible contractors may still submit unpaid bids.
- Once paid slots are full, later bids remain allowed but are unpaid.
- Valid paid filters in v1:
  - `open_to_anyone`
  - `core_verified_only`
- Default payout auto-releases after 48 hours unless the customer opens a valid dispute.
- Disputes pause payout for up to 7 days for company review.
- One contractor may claim only one paid slot per project in v1.

## 3. Existing Code Surfaces To Extend

The current implementation already has the right foundation.

### Existing customer project flow

```txt
goldbridgebid/src/app/(dashboard)/customer/projects/new/page.tsx
goldbridgebid/src/app/(dashboard)/customer/projects/actions.ts
goldbridgebid/src/app/(dashboard)/customer/projects/page.tsx
goldbridgebid/src/app/(dashboard)/customer/projects/[id]/page.tsx
```

Current use:

- create project
- edit project
- close project
- award project
- view bids and bidder credentials

### Existing bidder project flow

```txt
goldbridgebid/src/app/(dashboard)/bidder/projects/page.tsx
goldbridgebid/src/app/(dashboard)/bidder/projects/[id]/page.tsx
goldbridgebid/src/app/(dashboard)/bidder/projects/[id]/BidForm.tsx
goldbridgebid/src/app/(dashboard)/bidder/projects/actions.ts
```

Current use:

- browse open projects
- inspect project details
- submit sealed bids

### Existing qualification helpers

```txt
goldbridgebid/src/lib/badges.ts
goldbridgebid/src/components/credentials/CoreCredentialsCheck.tsx
goldbridgebid/src/app/(dashboard)/customer/contractors/page.tsx
```

Current use:

- compute badge levels
- detect license + bond + insurance
- show core verified UI state

### Existing admin surfaces

```txt
goldbridgebid/src/app/(dashboard)/admin/page.tsx
goldbridgebid/src/app/(dashboard)/admin/projects/[id]/page.tsx
goldbridgebid/src/components/layout/DashboardNav.tsx
```

Current use:

- admin overview
- project inspection
- navigation shell

### Existing schema/types

```txt
goldbridgebid/supabase/migrations/001_initial_schema.sql
goldbridgebid/supabase/migrations/013_project_award_tracking.sql
goldbridgebid/src/types/database.ts
```

Current use:

- projects, bids, notifications, credentials, files, edits, reviews

## 4. Architectural Strategy

Do not overload the existing `projects` or `bids` tables with all payment and dispute state.

Use a layered design:

1. `projects` remains the main marketplace object.
2. A new project-level table stores the paid estimate pool.
3. A new claim/payment layer tracks whether a bid claimed a paid slot.
4. A new dispute layer tracks customer objections and admin resolution.
5. Stripe state is stored separately from marketplace state but linked back to the project and claim records.

This keeps the marketplace logic understandable and makes rollback safer if any Stripe or payout workflow changes later.

## 5. Proposed Database Additions

Create a new migration:

```txt
goldbridgebid/supabase/migrations/016_paid_estimate_pools.sql
```

### New enums

- `paid_estimate_filter`
  - `open_to_anyone`
  - `core_verified_only`
- `paid_estimate_pool_status`
  - `funding_required`
  - `active`
  - `full`
  - `closed_settling`
  - `closed_refunded`
- `paid_estimate_claim_status`
  - `unpaid_bid`
  - `paid_reserved`
  - `payout_pending`
  - `paid_out`
  - `disputed`
  - `payout_denied_refunded`
- `paid_estimate_dispute_reason`
  - `blank_or_spam`
  - `wrong_trade`
  - `duplicate_submission`
  - `abusive_or_irrelevant`
  - `not_qualified_at_submission`

### New table: `project_paid_estimate_pools`

Purpose:

- one project-wide paid pool per project
- stores funding, eligibility filter, slot counts, Stripe references, and pool lifecycle

Suggested fields:

- `id`
- `project_id` unique FK to `projects.id`
- `is_enabled`
- `filter`
- `reward_amount`
- `contractor_payout_amount`
- `platform_fee_amount`
- `max_paid_slots`
- `claimed_paid_slots`
- `funded_total_amount`
- `reserved_total_amount`
- `paid_out_total_amount`
- `refunded_total_amount`
- `status`
- `stripe_payment_intent_id`
- `stripe_checkout_session_id`
- `funded_at`
- `closed_at`
- `created_at`
- `updated_at`

### New table: `paid_estimate_claims`

Purpose:

- tracks whether a bid became unpaid or claimed a paid slot
- holds payout timing and status

Suggested fields:

- `id`
- `project_id`
- `pool_id`
- `bid_id` unique
- `bidder_id`
- `claim_status`
- `was_paid_eligible`
- `slot_sequence`
- `reward_amount`
- `contractor_payout_amount`
- `platform_fee_amount`
- `reserved_at`
- `payout_due_at`
- `paid_out_at`
- `denied_refunded_at`
- `created_at`
- `updated_at`

### New table: `paid_estimate_disputes`

Purpose:

- records customer disputes and internal resolution

Suggested fields:

- `id`
- `claim_id`
- `project_id`
- `bid_id`
- `customer_id`
- `bidder_id`
- `reason`
- `customer_message`
- `review_status`
- `review_notes`
- `resolved_by`
- `resolved_at`
- `created_at`

### Optional helper table for Stripe events

Create only if webhook idempotency needs persistence:

```txt
goldbridgebid/supabase/migrations/017_paid_estimate_webhook_events.sql
```

Suggested table:

- `stripe_webhook_events`
  - `event_id`
  - `event_type`
  - `processed_at`
  - `payload_hash`

## 6. Row-Level Security Plan

Add RLS policies in the new migration or a follow-up policy migration:

```txt
goldbridgebid/supabase/migrations/018_paid_estimate_rls.sql
```

### `project_paid_estimate_pools`

- customer can select/update own project pool
- bidder can select pool data for open projects only
- admin can select/update all rows

### `paid_estimate_claims`

- bidder can read own claims
- customer can read claims for own project
- admin can read/update all claims
- inserts happen through server-side actions only

### `paid_estimate_disputes`

- customer can create disputes for own project claims
- customer can read disputes tied to own project
- bidder can read disputes tied to own claim
- admin can read/update all disputes

## 7. TypeScript Type Changes

Update:

```txt
goldbridgebid/src/types/database.ts
```

Add:

- new enums as union types
- `ProjectPaidEstimatePool`
- `PaidEstimateClaim`
- `PaidEstimateDispute`

Extend existing project-facing shapes as needed with optional joined data:

- `Project` should not become payment-heavy
- instead use dedicated query result types or helper interfaces in route files

Recommended approach:

- keep core database row types in `src/types/database.ts`
- add route-specific assembled view types near the page/action that uses them

## 8. New Helper Modules

Add small focused utilities rather than burying logic in page files.

### Eligibility logic

```txt
goldbridgebid/src/lib/paid-estimates/eligibility.ts
```

Responsibilities:

- determine if contractor qualifies for paid pool
- evaluate `open_to_anyone`
- evaluate `core_verified_only` using existing `hasCoreCredentials()`

### Slot calculation and status helpers

```txt
goldbridgebid/src/lib/paid-estimates/pools.ts
```

Responsibilities:

- remaining slot count
- whether pool is active/full/settling
- whether bid should be paid or unpaid
- payout due timestamp calculation

### Stripe amount helpers

```txt
goldbridgebid/src/lib/paid-estimates/money.ts
```

Responsibilities:

- compute payout split
- convert dollars to cents
- validate non-negative monetary values

### Dispute validation helpers

```txt
goldbridgebid/src/lib/paid-estimates/disputes.ts
```

Responsibilities:

- validate allowed dispute reasons
- derive review window rules
- derive auto-release vs hold behavior

## 9. Stripe Integration Plan

Add Stripe as a new dependency and integrate in phased steps.

### New environment variables

Document in:

```txt
goldbridgebid/.env.local.example
goldbridgebid/README.md
```

Add placeholders for:

- `STRIPE_SECRET_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_CONNECT_CLIENT_ID` if needed for Connect onboarding

### New Stripe library wrapper

```txt
goldbridgebid/src/lib/stripe/server.ts
```

Responsibilities:

- create and export configured Stripe server client

### New customer checkout route or server action

Recommended file:

```txt
goldbridgebid/src/app/(dashboard)/customer/projects/[id]/paid-estimates/actions.ts
```

Responsibilities:

- create pool config
- create Stripe Checkout Session or PaymentIntent
- persist Stripe references
- redirect customer to checkout if needed

### New Stripe webhook route

```txt
goldbridgebid/src/app/api/stripe/webhooks/route.ts
```

Responsibilities:

- verify event signature
- mark pool funded on successful checkout/payment
- support idempotency
- trigger notifications

### Connect onboarding plan

Contractor payout onboarding should be phased:

Phase A:

- implement funding and claim reservation first
- if payout onboarding is incomplete, claim remains pending until contractor finishes onboarding

Phase B:

- add Connect onboarding status to bidder profile or payout-specific table

Suggested future storage:

- `bidder_payout_accounts`
  - `user_id`
  - `stripe_account_id`
  - `charges_enabled`
  - `payouts_enabled`
  - `details_submitted`

## 10. Customer-Side Implementation Plan

### A. Customer projects list

Update:

```txt
goldbridgebid/src/app/(dashboard)/customer/projects/page.tsx
```

Add UI elements:

- funded `Paid Estimate` badge
- reward amount
- remaining paid slots
- quick link to manage paid estimate pool

### B. Customer project detail

Update:

```txt
goldbridgebid/src/app/(dashboard)/customer/projects/[id]/page.tsx
```

Add sections:

- create/convert paid estimate pool panel
- funding status panel
- claimed slots summary
- payout/dispute timeline
- button to dispute within 48-hour window

Important customer rules to enforce in UI:

- if project is free, offer `Add Paid Estimate Pool`
- if pool exists but unfunded, show `Funding Required`
- if pool funded, show funded summary and paid claim statuses
- if project closed/awarded, disable new funding changes that would create new slots

### C. Customer project actions

Update:

```txt
goldbridgebid/src/app/(dashboard)/customer/projects/actions.ts
```

Do not overload this file indefinitely.

Recommended split:

```txt
goldbridgebid/src/app/(dashboard)/customer/projects/actions.ts
goldbridgebid/src/app/(dashboard)/customer/projects/[id]/paid-estimates/actions.ts
```

Keep existing project CRUD in the original file.
Move pool creation, funding, disputes, and refund-related actions to the new paid-estimates actions file.

## 11. Bidder-Side Implementation Plan

### A. Browse open projects page

Update:

```txt
goldbridgebid/src/app/(dashboard)/bidder/projects/page.tsx
```

Add card-level indicators:

- funded paid estimate badge
- reward amount
- remaining paid slots
- paid filter label
- whether current user is eligible if cheaply derivable in query

Keep performance in mind:

- this page already assembles customer profile/review data
- do not add heavyweight per-project eligibility queries unless batched efficiently

### B. Bidder project detail page

Update:

```txt
goldbridgebid/src/app/(dashboard)/bidder/projects/[id]/page.tsx
```

Add explicit paid-estimate state panel above the bid form:

- funded vs not funded
- remaining paid slots
- filter rule
- whether contractor currently qualifies
- if not eligible, explain they may still submit an unpaid bid
- if full, explain paid slots are gone but unpaid bids are allowed

### C. Bid form

Update:

```txt
goldbridgebid/src/app/(dashboard)/bidder/projects/[id]/BidForm.tsx
```

Add pre-submit state messaging:

- `Your bid is eligible for a paid slot`
- `You may still bid, but this bid will be unpaid because you do not meet the paid filter`
- `You may still bid, but paid slots are already full`

This component should remain mostly presentational. It should receive computed state from the page when possible.

### D. Bid submission action

Update:

```txt
goldbridgebid/src/app/(dashboard)/bidder/projects/actions.ts
```

This is the most important behavioral change.

New responsibilities after normal bid insert:

1. Load active pool for the project.
2. Determine whether the project has a funded active pool.
3. Determine whether the bidder qualifies.
4. Determine whether the pool still has paid capacity.
5. If eligible and capacity remains:
   - create `paid_estimate_claims` row
   - reserve slot
   - increment claimed count
   - set payout due time
6. If not eligible or full:
   - create claim row as unpaid, or store no claim and derive unpaid status from absence of claim

Recommended approach:

- Always create a `paid_estimate_claims` row for post-activation bids.
- Use `claim_status = unpaid_bid` when the bid does not claim paid capacity.

This gives admin and customer a clean audit trail.

## 12. Notification Plan

Existing notification patterns already live in:

```txt
goldbridgebid/src/app/(dashboard)/notifications/actions.ts
goldbridgebid/src/app/(dashboard)/customer/projects/actions.ts
goldbridgebid/src/app/(dashboard)/bidder/projects/actions.ts
```

Add new notification types:

- `paid_estimate_pool_funded`
- `paid_estimate_project_activated`
- `paid_estimate_slot_claimed`
- `paid_estimate_slots_full`
- `paid_estimate_payout_scheduled`
- `paid_estimate_disputed`
- `paid_estimate_paid_out`
- `paid_estimate_denied_refunded`
- `paid_estimate_unused_funds_refunded`

Customer notifications:

- funding succeeded
- slot claimed
- slots filled
- dispute resolved
- unused refund completed

Bidder notifications:

- project upgraded to funded paid estimates
- claim reserved
- payout scheduled
- dispute opened
- payout released
- payout denied

## 13. Admin Implementation Plan

### Navigation

Update:

```txt
goldbridgebid/src/components/layout/DashboardNav.tsx
goldbridgebid/src/app/(dashboard)/admin/page.tsx
```

Add quick links for:

- `Paid Estimates`
- `Disputes`

### New admin pages

Recommended additions:

```txt
goldbridgebid/src/app/(dashboard)/admin/paid-estimates/page.tsx
goldbridgebid/src/app/(dashboard)/admin/disputes/page.tsx
```

Responsibilities:

- list active/funded/full pools
- list disputes needing review
- filter by status
- open a pool or claim detail

### Extend admin project detail

Update:

```txt
goldbridgebid/src/app/(dashboard)/admin/projects/[id]/page.tsx
goldbridgebid/src/app/(dashboard)/admin/projects/[id]/ProjectDetailTabs.tsx
```

Add:

- pool summary
- paid claim list
- dispute status
- Stripe reference visibility
- internal review actions

## 14. Background Jobs / Scheduled Work

Some payout and refund behavior is time-based.

Recommended implementation options:

### Option A: Cron-driven server routes

Add:

```txt
goldbridgebid/src/app/api/cron/release-paid-estimates/route.ts
goldbridgebid/src/app/api/cron/refund-unused-paid-estimates/route.ts
```

Responsibilities:

- release claims past 48 hours with no dispute
- refund expired or closed unused pool balance

### Option B: Admin/manual fallback for first release

If cron is not ready in the first iteration:

- build the schema and UI first
- use admin-triggered settlement actions as temporary operational tooling

Recommendation:

- start with a deterministic server route that can later be wired into Vercel cron

## 15. Suggested Query Strategy

Avoid deeply nested ad hoc joins in every page.

Recommended approach:

- fetch project
- fetch optional pool by `project_id`
- fetch bidder credentials if current user is a bidder
- compute eligibility in TypeScript helper

For detail pages this is acceptable and keeps logic explicit.

For list pages:

- fetch pool summaries in batch for visible projects
- avoid per-project per-user queries if not necessary
- only compute personalized eligibility when there is meaningful UI value

## 16. Suggested Rollout Order

### Phase 1: Schema and types

Files:

```txt
goldbridgebid/supabase/migrations/016_paid_estimate_pools.sql
goldbridgebid/supabase/migrations/018_paid_estimate_rls.sql
goldbridgebid/src/types/database.ts
goldbridgebid/src/lib/paid-estimates/eligibility.ts
goldbridgebid/src/lib/paid-estimates/pools.ts
goldbridgebid/src/lib/paid-estimates/money.ts
goldbridgebid/src/lib/paid-estimates/disputes.ts
```

Deliverable:

- database objects exist
- helpers exist
- no UI yet

### Phase 2: Customer funding flow

Files:

```txt
goldbridgebid/src/lib/stripe/server.ts
goldbridgebid/src/app/api/stripe/webhooks/route.ts
goldbridgebid/src/app/(dashboard)/customer/projects/[id]/page.tsx
goldbridgebid/src/app/(dashboard)/customer/projects/[id]/paid-estimates/actions.ts
goldbridgebid/src/app/(dashboard)/customer/projects/page.tsx
```

Deliverable:

- customer can create and fund a pool
- pool activates after Stripe success

### Phase 3: Bidder visibility and claim reservation

Files:

```txt
goldbridgebid/src/app/(dashboard)/bidder/projects/page.tsx
goldbridgebid/src/app/(dashboard)/bidder/projects/[id]/page.tsx
goldbridgebid/src/app/(dashboard)/bidder/projects/[id]/BidForm.tsx
goldbridgebid/src/app/(dashboard)/bidder/projects/actions.ts
```

Deliverable:

- contractors can see paid projects
- eligibility is clear
- claims reserve immediately on qualifying submissions

### Phase 4: Disputes and admin review

Files:

```txt
goldbridgebid/src/app/(dashboard)/admin/paid-estimates/page.tsx
goldbridgebid/src/app/(dashboard)/admin/disputes/page.tsx
goldbridgebid/src/app/(dashboard)/admin/projects/[id]/page.tsx
goldbridgebid/src/components/layout/DashboardNav.tsx
```

Deliverable:

- disputes can be reviewed and resolved
- admin has visibility

### Phase 5: Auto-release and refunds

Files:

```txt
goldbridgebid/src/app/api/cron/release-paid-estimates/route.ts
goldbridgebid/src/app/api/cron/refund-unused-paid-estimates/route.ts
```

Deliverable:

- automated settlement behavior

## 17. Key Edge Cases To Handle

- customer creates a pool but never completes Stripe payment
- customer converts a project to paid after already receiving unpaid bids
- contractor submits while last slot is being claimed concurrently by another contractor
- contractor qualifies for `core_verified_only` at submission time but later removes a document
- customer disputes after 48-hour window
- customer closes or awards project with unclaimed funded slots remaining
- contractor has claimed a slot but has not completed Stripe Connect onboarding
- webhook is delivered twice
- admin resolves dispute after 7-day window

## 18. Concurrency / Integrity Rules

Slot reservation must be atomic.

Recommended implementation:

- use a Postgres transaction or RPC for claim assignment
- do not trust only client-side or app-side slot counters

Goal:

- two contractors should never both claim the same final slot

If using Supabase only:

- strongly consider a SQL function or transactional RPC to reserve the slot and insert the claim together

## 19. Testing Plan

### Unit-level helper coverage

Add focused tests later for:

- eligibility rules
- payout split calculations
- slot availability logic
- dispute reason validation

### Integration checks

Manually verify:

1. free project converts to paid after Stripe funding
2. pre-activation bid stays unpaid
3. first eligible post-activation bid claims a paid slot
4. ineligible contractor can still submit unpaid bid
5. paid slots fill in submission order
6. customer can dispute only within 48 hours
7. disputed claim pauses payout
8. non-disputed claim auto-releases
9. closing/awarding stops new paid claims
10. unused funds refund correctly

## 20. Build Recommendation

Do not attempt the full feature in one giant change.

Recommended first implementation milestone:

- create schema
- create TS helpers
- create customer pool funding UI shell
- create Stripe funding webhook
- render paid badges and funded pool state on customer and bidder project pages

That milestone will establish the foundation safely before claim reservation and payout automation are layered in.

## 21. Definition Of “Next Code Step”

After this spec, the first code slice to implement should be:

```txt
goldbridgebid/supabase/migrations/016_paid_estimate_pools.sql
goldbridgebid/src/types/database.ts
goldbridgebid/src/lib/paid-estimates/eligibility.ts
goldbridgebid/src/lib/paid-estimates/pools.ts
goldbridgebid/src/lib/paid-estimates/money.ts
```

Reason:

- it is additive
- it establishes the domain model
- it minimizes risk to current bidding behavior
- it prepares the project for the Stripe funding flow without prematurely touching every screen
