# Professional Estimator Marketplace Implementation Plan

## Product Decision

The Professional Estimator Marketplace will be a general estimate-package marketplace library that works alongside the existing ProjectXBidX customer/contractor sealed-bid marketplace.

This feature extends the product positioning in `PROJECT_PRODUCT_CHECKLIST.md`: ProjectXBidX is a construction estimating and bidding platform, not only a project-posting website. It also preserves the core marketplace principles from `project-vision.md`: customers post projects, qualified contractors submit sealed bids, and trust is protected through clear scope, credentials, messaging, history, and admin visibility.

## Locked Product Rules

- Estimate packages are general marketplace library items, not only project-specific attachments.
- Contractors pay for packages unless the package creator sets the price to free.
- Any authenticated user can buy an estimate package.
- Any authenticated user can request a custom estimate.
- Admins always have access to package records, package files, purchases, and requests.
- There is no estimator package dispute process.
- Reputation, reviews, and repeat buying behavior are the quality-control loop.
- Estimators are expected to protect their good name because poor estimate work can harm contractors.
- The existing customer/bidder sealed-bid flow must continue working unchanged.

## First Safe Build Slice

The first build slice should establish the feature foundation without introducing payment movement or changing contractor bid behavior.

1. Add an additive Supabase migration for estimator marketplace tables.
2. Add TypeScript domain types.
3. Add `estimator` as a supported role in role helpers and dashboard navigation.
4. Add initial dashboard scaffolding for estimator package management.
5. Add admin visibility scaffolding for packages and requests.
6. Add a marketplace browse scaffold that can later unlock package details through free access or Stripe purchase.

## Data Model

Core tables:

- `estimator_profiles`: estimator-specific reputation and public profile fields.
- `estimate_packages`: marketplace listing record, pricing, publish status, and estimator owner.
- `estimate_package_versions`: immutable version snapshots so buyers keep access to what they purchased.
- `estimate_package_files`: package file metadata tied to a package version.
- `estimate_package_purchases`: paid or free acquisition records.
- `estimate_package_access_grants`: manual/admin or inherited access grants.
- `estimate_requests`: custom estimate requests created by any authenticated user.
- `estimate_package_reviews`: package-specific review records.

Important modeling rules:

- `price_cents = 0` means free.
- Paid packages should eventually use Stripe Checkout before granting purchase access.
- Package files should be private and only downloadable by the estimator owner, admins, buyers, or users with access grants.
- Published package previews can be browsed by authenticated users.
- Draft packages are only visible to the estimator owner and admins.

## Role Strategy

The current app has both a primary `profiles.role` and a multi-role `user_roles` table. The estimator marketplace should use `user_roles` so a person can be a customer, contractor, estimator, or some combination.

Initial estimator access should be conservative:

- Admins can grant estimator role.
- Public estimator signup can come later.
- Existing customer and bidder signup should remain unchanged.
- Dashboard navigation gains `/estimator` without changing `/customer`, `/bidder`, or `/admin`.

## Access Rules

RLS and server authorization should enforce:

- Admins can select all estimator marketplace records.
- Estimators can manage their own estimator profile, packages, versions, and files.
- Authenticated users can browse published package previews.
- Authenticated users can create estimate requests.
- Request creators can view their own requests.
- Estimators can view requests assigned to them or publicly available requests.
- Package buyers can view purchase records and package versions/files they bought.
- Free package access can be represented as a purchase record with `price_cents = 0`.

## Payment Strategy

Do not reuse paid estimate pools. Existing paid estimate pools are tied to `bids` and contractor reward slots, while estimator packages are marketplace products.

Payment should be added in a later slice:

1. Free package access creates an immediate purchase/access row.
2. Paid package access starts Stripe Checkout.
3. Stripe webhook confirms payment and creates the purchase/access row.
4. Estimator payouts can be designed separately after package buying is stable.

## Review Strategy

There should be no package dispute process.

Instead:

- Buyers can leave reviews after buying a package.
- Requesters can leave reviews after a completed custom estimate.
- Public estimator profiles should show average rating, review count, package count, and package history.
- Admins should still have moderation tools for abusive reviews or fraudulent content.

## Build Milestones

### Milestone 1: Foundation

- Migration for marketplace tables and RLS.
- TypeScript types.
- Role helper support for `estimator`.
- Dashboard/nav support for estimator mode.

### Milestone 2: Estimator Workspace

- Estimator dashboard overview.
- Package draft list.
- Package creation form.
- Version publishing flow.
- File upload support.

### Milestone 3: Marketplace Library

- Browse page for published packages.
- Package detail page.
- Filter by trade, package type, price, and estimator reputation.
- Free package access flow.

### Milestone 4: Paid Access

- Stripe Checkout for paid packages.
- Webhook purchase confirmation.
- Private package file download route.
- Purchase history for buyers.

### Milestone 5: Estimate Requests

- Public request form for authenticated users.
- Estimator request inbox.
- Request status lifecycle.
- Request-to-package or request-to-deliverable workflow.

### Milestone 6: Reputation

- Package reviews.
- Estimator public reputation cards.
- Admin moderation for packages and reviews.
- Marketplace ranking using rating, package count, and freshness.

## Non-Goals For The First Slice

- No changes to contractor bid submission.
- No changes to sealed bid visibility.
- No estimator payout system yet.
- No refund or dispute workflow.
- No public estimator signup yet.
- No builder-exchange integration yet.

