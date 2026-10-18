# ProjectXBidX modernization plan

Assessment only. This document does not change application code. It records what the repo is, how it behaves in a clean install, what should be cleaned up, and a sequence of small pull requests.

**Assessed:** 18 October 2026, on commit `a2b44e3` (`main`).
**Product name:** ProjectXBidX.com (`projectxbidx`). The app directory is still `goldbridgebid/`. See `project-vision.md`, section “Naming & repository”.
**Audience:** Steven Sills II, owner. The product is a general estimating and bidding platform. It is not a lawn, snow, rebar, or any other single-trade product.

This plan stands on its own. It does not depend on any other project.

---

## 1. What this project is

ProjectXBidX is a web marketplace where a project owner posts construction work and contractors submit **sealed bids**. Only the owner and an admin can see bid amounts. Contractors do not see each other’s prices. That is the core, described in `project-vision.md` under “Core Concept” and “Bid Visibility & Award Flow”.

Around that core, the shipped app also has:

- Accounts for **customers**, **bidders** (contractors), **estimators**, and **admins**. Estimators are a quiet third role (`/signup?role=estimator`), not a separate product.
- Qualification badges from uploaded credentials (license, bond, insurance, workers’ comp, EIN, references).
- An **AI scope checklist** that turns a description into work items. `DESIGN_PRINCIPLES.md` is explicit: this is a planning aid, not a price, and the product must not invent confidence.
- **Paid estimate pools**: a customer can fund a reward for real bids through Stripe Checkout. Contractors are paid through Stripe Connect. The default platform fee in code is 10% (`goldbridgebid/src/lib/paid-estimates/money.ts`).
- **Quick quotes by address**: a public, lighter path than a full sealed-bid project.
- An **estimate library**: estimators publish packages other people can buy.
- Messaging, per-project Q&A, reviews, hearts, saved searches, and an admin console (users, flags, disputes, revenue, cron status).

Who it is for: property owners who want comparable bids, contractors who want a fair shot at that work, and professional estimators who sell takeoffs. The launch story in the vision doc is Crescent City, California, with a schema meant to grow past one city. The working scale called out there is on the order of a few hundred users, not a national lead-gen network.

Comparable products, and where this one sits:

| Kind of product | Examples | What they optimize for | Fit for ProjectXBidX |
|---|---|---|---|
| Commercial bid rooms | BuildingConnected, PlanHub, ConstructConnect, SmartBid | A project, documents, and sealed or invited bids across whatever trades the job needs | This is the right comparison for the sealed-bid core |
| Takeoff / estimating suites | STACK, PlanSwift, ProEst, DESTINI | Quantities and cost assemblies as **data**, reusable on any project type | This is the right comparison for the estimator role and the AI scope builder |
| Home-services lead markets | Angi, Thumbtack, Jobber-style vertical tools | One service category, speed to a lead | Useful only as a warning. That model should not become the schema or the navigation |

The modern standard for a bid room plus an estimator is: one project model, trades and assemblies stored as data, documents private, money moved by a marketplace payments product (Stripe Connect is the usual choice), and a small set of quantity types (count, length, area, volume) that any trade can use. A lawn-mowing form or a snow-removal form is an optional **template** on top of those quantity types. It is not the product.

---

## 2. Product boundary (read this before changing code)

Steven’s direction for this cleanup:

> Project-Bidder is a general estimating and bidding platform for hundreds of bidders and estimators across unlimited project types and trades. Any niche (lawn, snow, landscaping, or anything else) may exist only as an optional template or example. It must never be the core design.

The vision doc already points this way. Customers pick a **level of professional** (licensed contractor, handyman, general labor) instead of a fixed multi-trade checklist, and bidders declare their own specialties. See `project-vision.md`, “Expertise Level Logic” and “Specialties + Service Areas”. `DESIGN_PRINCIPLES.md` section 2 says the estimator produces one itemized draft per project, not one estimate per trade.

The code and a few design notes have drifted toward a short list of exterior chores:

- Bidder specialties are a closed TypeScript union and a Postgres enum of about **52 values**, mostly California CSLB license classes (`TradeCategory` in `goldbridgebid/src/types/database.ts`, migration `010_expanded_trade_categories.sql`). A new trade requires a migration. That cannot represent unlimited trades.
- Quick quotes store `service_vertical` behind a check constraint of seven exterior services, and the list starts with `lawn_care` (`goldbridgebid/supabase/migrations/050_public_address_quote_layer.sql`).
- The new-quote form defaults the category to `lawn_care` and the title placeholder to a lawn-mowing quote (`goldbridgebid/src/app/(dashboard)/bidder/address-quotes/new/page.tsx`).
- Every new or edited address quote mounts `LawnAreaMeasurementMap`, a polygon area tool named and framed as a lawn measurement (`goldbridgebid/src/components/address-quotes/LawnAreaMeasurementMap.tsx`). Area-on-a-map is a general quantity. Lawn is one use of it.
- `goldbridgebid/src/lib/address-quotes/service-verticals.ts` is a hand-maintained union. Snow removal appears only as a quote-**request** label, not as a publisher category. Growing that file is how a general product accidentally becomes a chore list.
- `PUBLIC_ADDRESS_QUOTE_LAYER_DESIGN.md` and `PROJECT_PRODUCT_CHECKLIST.md` still say to start with lawn mowing as the first vertical. Treat those sentences as outdated. Do not implement them as the roadmap.

What “template” means here: a saved bundle of fields a user may start from (“area in square feet, price per square foot, note”). The bid, the estimate package, and the scope checklist do not branch on `if lawn` or `if snow`. California license classes can ship as a **seed list** named as such, so a California contractor can pick C-10 Electrical without that list being the schema.

Labor rates in `goldbridgebid/src/lib/trade-wages.ts` are a static California prevailing-wage sheet keyed by those same license classes, last noted as reviewed in April 2026. `DESIGN_PRINCIPLES.md` section 3 says this sheet is the labor source and that the app must not look up wages on the internet at runtime. That rule is right. Presenting one state’s union rate as the labor price for every trade in every city is the “false confidence” the same document forbids. Region and trade belong in data, and missing data should say “no rate on file”.

---

## 3. Tech stack, versions, and how it runs

The app lives in `goldbridgebid/`. The repo root is documentation plus that app. There is no workspace package, no Docker file, no `supabase/config.toml`, and no `.github` workflows.

| Piece | In the repo on 18 Oct 2026 | Role |
|---|---|---|
| Next.js | `16.2.1` (App Router, Turbopack build) | UI and server actions |
| React / React DOM | `19.2.4` | UI |
| TypeScript | `5.9.3`, `"strict": true` | Types |
| Tailwind CSS | `4.2.2` | Styling |
| Supabase | `@supabase/supabase-js` `2.99.3`, `@supabase/ssr` `0.9.0` | Postgres, auth, storage |
| Stripe | `stripe` `21.0.1` | Checkout and Connect |
| OpenAI SDK | `openai` `6.34.0` | Scope builder, behind `PROJECT_AI_LLM_ENABLED` and `OPENAI_API_KEY` |
| Email | `resend` `6.10.0` | Transactional mail |
| Maps | `maplibre-gl` `5.24.0`, optional Mapbox tiles, optional Google geocoding, Esri fallback | Address quotes and location preview |
| Editor | Tiptap `3.22.3` | Rich text |
| Validation | Zod `4.3.6` | Used in places, not as an env contract |
| Node used for this assessment | `v22.14.0`, npm `10.9.9` | The repo does not set `engines` |

Also installed, and worth knowing about: `ffmpeg-static` and `tesseract.js` (video posters and OCR on uploads), `sharp` (images), `konva` / `react-konva` (photo annotation), `recharts` (admin charts), `@turf/area` (polygon area).

**Dead dependencies:** `@supabase/auth-helpers-nextjs` `0.15.0` is in `package.json` and is not imported anywhere. npm already prints that the package is unsupported. `pg` is a devDependency and is not imported. Both can be removed without a behavior change.

**Scripts:** `dev`, `build`, `start`, `lint`. There is no `test` script and there are no `*.test.ts` / `*.spec.ts` files.

**Database:** 60 SQL files in `goldbridgebid/supabase/migrations/`, about 3,850 lines, applied by hand (`npx supabase db push` in the root README, or “run the SQL files in order” in the app README). There is no local Supabase config, so `supabase start` is not set up. Row-level security on **bid rows** matches the sealed-bid promise: a bidder reads their own bids, the project owner reads bids on their project, an admin policy exists (`001_initial_schema.sql`, `003_admin_rls_policies.sql`). Storage policies do not match that promise. See section 6.

**Hosting shape the code expects:** Vercel for the Next app, Supabase for data, Stripe for money, Resend for mail, OpenAI for the scope builder. `goldbridgebid/src/app/(dashboard)/customer/projects/new/layout.tsx` sets `maxDuration = 300` because the scope check calls OpenAI from a server action. Crons are HTTP routes under `/api/cron/*` guarded by `CRON_SECRET`. There is no `vercel.json` in the repo, so the schedule lives outside git, in the Vercel project, if it is configured at all.

**Env contract:** `goldbridgebid/.env.local.example` lists Supabase URL, anon key, service role key, site URL, Stripe keys, and `CRON_SECRET`. Code also reads OpenAI settings, Resend, Mapbox, Google Maps, and `ACCOUNT_SIGNAL_HASH_SALT`. A new contributor cannot tell that from the example file. The two READMEs disagree with each other: the root README says Node 18+, the app README says Node 20+.

---

## 4. What was actually run

All commands were run in `goldbridgebid/` after a clean `npm ci`. No application source was edited. No live Supabase, Stripe, OpenAI, Mapbox, or Google project was called. Placeholder public env values were used only for the production build.

| Check | Result |
|---|---|
| `npm ci` | Succeeded (588 packages). Warned that `@supabase/auth-helpers-nextjs@0.15.0` is deprecated. |
| `npx tsc --noEmit` | Exit 0. |
| `npx eslint . --max-warnings 0` | Exit 1. **23 errors, 4 warnings**, about 8 files. Rules: `react-hooks/purity` (7, mostly `Date.now` perf logs), `@typescript-eslint/no-explicit-any` (12, concentrated in the customer project page), unused vars (4), `react-hooks/refs` (2), `react-hooks/set-state-in-effect` (1). |
| `npm run build` | Exit 0 on Next.js 16.2.1. Typecheck inside the build also passed. Pages generated. |
| `npm test` | Not possible. No test script. |
| `npm audit` | **2 critical, 17 high, 6 moderate, 1 low** (26 advisories). |
| `npm outdated` | 32 packages behind `latest`. Many are majors and should not be bumped in one change. |
| Browser pass of the live site | Not done. This assessment did not use production credentials, and there is no local database to sign in against. |
| Migrations applied | Not done. Schema comments below are from the SQL in git, which may differ from the hosted database. |

Build warnings worth keeping:

- The `middleware` file convention is deprecated in this Next version in favor of `proxy`. The app still builds. Migrate when Next’s own docs in `node_modules/next/dist/docs/` say how, not from memory. `goldbridgebid/AGENTS.md` already says this Next is not the one in older training data.
- `ffmpeg-static` plus dynamic path use in `generate-video-poster.ts` makes Turbopack trace far too many files (“whole project was traced”).
- `metadataBase` is unset, so Open Graph image URLs fall back to `http://localhost:3000` at build time.

---

## 5. Current health

The project is a real, buildable product, not a sketch. About 313 TypeScript files, about 66,000 lines under `goldbridgebid/src`, 200 commits from 20 March 2026 through 16 May 2026. Strict TypeScript passes. A production build passes with placeholder public keys.

It is not in good maintenance shape:

- Lint fails, so nobody is gating on the linter.
- There are no tests around money, permissions, or the scope builder.
- There is no CI.
- Dependency audit reports critical issues in Next.js and MapLibre, which are both shipped to users.
- Sealed-bid **rows** are protected. Sealed-bid **files** and credential files are not. That contradicts `project-vision.md`, “Security & Privacy”.
- A copyrighted estimating book is committed under `goldbridgebid/data/`.
- Docs disagree with the code, and several design notes argue for a lawn-care product. That fights the product boundary in section 2.
- A few very large files (`customer/projects/actions.ts` is about 78 KB, the new-project page about 65 KB, `address-quotes/actions.ts` about 62 KB) will make the next features risky until they are split. Splitting is later, not first.

Nothing here requires a new framework, a new database, or a rewrite.

---

## 6. Findings

### 6.1 Security

**Bid files and credential files are world-readable, and any logged-in user can overwrite them.**

`goldbridgebid/supabase/migrations/005_storage_policies.sql` creates storage policies whose `SELECT` check is only `bucket_id = 'bid-files'` (and the same for `credential-files` and `project-files`). Update and delete require only that the caller is logged in, not that they own the object. `017_create_credential_files_bucket.sql` inserts the credential bucket with `public = true`. The app stores and renders those objects with `getPublicUrl` (credentials in `bidder/credentials/actions.ts`, bid files in `bidder/projects/actions.ts`).

`project-vision.md` says documents live in private buckets and are served with signed URLs, and that bidders never see competing bids. A public URL does not care about the bid-row policy. Anyone with the URL can open a proposal PDF, a license, or an EIN document. Guessable paths make that worse. This is the highest-priority product bug in the repo.

Modern standard for a bid room: private bucket, object path prefixed by the uploader’s user id, upload via a signed URL, download via a short-lived signed URL after the same authorization the page already does. PlanHub and BuildingConnected do not leave proposal files on a public URL. This fits ProjectXBidX directly, because sealed bids are the product. Project photos can stay easier to view **if** that is a product choice. License, bond, insurance, and bid packets should not.

The download route at `src/app/api/project-files/[fileId]/download/route.ts` already does the right kind of check (owner, admin, or bidder on an open project) and then uses the service-role client only after that check. Storage itself still allows a bypass around that route. Fix the bucket, then keep the route as the browser-friendly download.

**Public map routes can spend paid API quotas.**

`/api/address-quotes/*` is on the middleware public allowlist (`src/lib/supabase/middleware.ts`). `google-maps-key/route.ts` returns `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, or the browser key, or **`GOOGLE_MAPS_API_KEY`**. A server key must not be sent to the browser. `geocode`, `reverse-geocode`, and `street-view` call Google, then Nominatim, with no auth and no rate limit.

Modern standard: a browser map token is a restricted public token (HTTP referrer or URL restrictions). Server geocoding is rate-limited and, when it costs money, authenticated. OpenStreetMap’s public Nominatim service is not an open proxy for a production app. This fits. Quick quotes can keep working on the existing Esri/MapLibre fallback when no paid token is configured. No new map vendor is required.

**HTML sanitizer is a regex.**

`src/components/ui/RichTextRenderer.tsx` strips a few dangerous patterns and then uses `dangerouslySetInnerHTML`. Tiptap content from another user is shown this way. A regex is not an HTML sanitizer. Modern standard is an allowlist sanitizer (`sanitize-html` or DOMPurify). That fits a marketplace where bidders write notes to customers. It is a small, local change.

**Service-role client is the default reader in many pages.**

`createAdminClient()` bypasses row-level security. It is appropriate in Stripe webhooks, cron jobs, and admin actions. It is also used from bidder dashboards, public address-quote pages, and customer project pages. Some of those call sites re-check the user first. Many exist so a query “just works”. Modern standard is: the user-scoped Supabase client by default, service role only where a comment says which policy cannot do the job. This fits, and it should be done one area at a time so a mistake does not hide bids or, worse, reveal them. Do it after the storage fix, not before.

**Identity hashes can be salted with the service-role key.**

`src/lib/auth/account-setup.ts` hashes phone, email domain, and similar signals with `ACCOUNT_SIGNAL_HASH_SALT`, otherwise the service-role key, otherwise a hardcoded string. Modern standard is a dedicated pepper, required in production, unrelated to the key that bypasses RLS. If production has been hashing with the service-role key, changing the salt makes old matches unreadable. The first change should require the salt and leave old rows alone.

**Cron secret compare is a normal string compare.** `src/lib/cron.ts` uses `===`. `timingSafeEqual` is the usual fix. Small, low risk.

**Webhook signature checks are in good shape.** `src/app/api/stripe/webhooks/route.ts` verifies the Stripe signature before it touches the database, and pool funding remembers `funded_at` so a retry does not send a second “you are funded” notice. Transfer jobs already pass Stripe idempotency keys. That is the modern marketplace pattern. Do not rewrite payments.

**Middleware logs every request.** `src/lib/supabase/middleware.ts` and the dashboard layout print `[PERF middleware]` / timing lines with the path. That is debug noise in production, and it is part of why lint fails (`Date.now` during render). Remove the logs. A paid error tracker is optional and is listed under costs. It is not required to delete `console.log`.

**Banned users can pass for up to 60 seconds.** The ban check is cached in an httpOnly cookie. That is a reasonable tradeoff. Not a first fix.

No `.env` file with live keys is committed. `.env.local.example` contains placeholders only. Searches did not find Stripe secret keys, service-role JWTs, or private keys in source.

`goldbridgebid/supabase/.temp/` **is** committed. Those files are Supabase CLI link state: a project ref, an organization id, an organization slug, and a pooler URL. The pooler URL has a username and a host. It does **not** contain a password. These are production identifiers, not login secrets. They still should not be in git. The Supabase starter gitignores `.temp`. Removing them does not rotate anything and does not, by itself, require a support ticket.

### 6.2 Copyrighted estimating data

These paths are in git:

- `goldbridgebid/data/2023-National-Construction-Estimator-eBook.pdf` (about 11.7 MB)
- `goldbridgebid/data/2023-National-Construction-Estimator-eBook.txt` (extracted text)
- `goldbridgebid/data/craftsman-nce-parsed.json` (about 5 MB parsed unit-cost tables)
- `goldbridgebid/scripts/parse-craftsman-nce.mjs` (parser for that book)

`src/lib/craftsman-lookup.ts` loads the JSON into memory and the AI prompts describe the rows as published unit costs. The loader already catches a missing file and continues with a warning. This plan does not quote the book.

Modern estimating tools either license a cost database (RSMeans, a Craftsman license, or a similar feed) or they store the contractor’s own assemblies. Committing a third-party book is neither. It also fights `DESIGN_PRINCIPLES.md`: labor is supposed to come from the internal wage sheet, and the UI must not pretend an outside number is “the” price.

Removing the files from the next commit is not enough. Git history will still hold the blobs. A history rewrite is a force-push and needs Steven’s explicit go-ahead. Until then, the safe product behavior is: stop reading the file, stop telling the model the numbers are published costs, keep the internal wage sheet, and let estimators type unit prices. Buying a license is a separate decision and costs money. It is not part of the cleanup.

`ffmpeg-static` vendors an FFmpeg binary, which is GPL-licensed in the usual builds. Running it on the server for a poster frame is a license question, not a CVE. Do not add another media vendor while that is open. Prefer dropping server-side FFmpeg if posters are not essential. That also removes the Turbopack trace warning.

### 6.3 Dependencies

`npm audit` on the lockfile as of this assessment:

| Package | Audit severity | Practical note | Suggested bump |
|---|---|---|---|
| `next` `16.2.1` | Critical (rollup of server-component denial-of-service and a middleware/proxy bypass follow-up) | Fix version reported by audit: `16.4.2`, same major | First dependency PR, with `eslint-config-next` |
| `maplibre-gl` `5.24.0` | Critical XSS advisory in `DOM.sanitize()` through `6.4.0`; audit’s fix is `6.14.0` | Loaded in the browser on map pages. Major bump | Its own PR |
| `@tiptap/*` `3.22.3` | High (attribute merge and markdown ReDoS). Fix is within 3.x (`3.32.0` is current latest) | Editor used for notes and descriptions | With the Next patch or immediately after |
| `sharp` `0.34.5` | High, via image libraries. Fix is `0.35.x` (major) | Thumbnails | Own PR after the patch round |
| `resend` `6.10.0` | Moderate, via `svix` / `uuid` | Mail | Patch round (`6.34.1` latest) |
| `postcss` | High, pulled through Next | Fixed by the Next bump | Do not hand-pin |
| ESLint’s nested `braces` / `micromatch` / `fast-glob` | High | Audit’s suggested downgrade of `eslint-config-next` to 14.x is a **bad** fix. Stay on the Next 16 config and let transitive bumps land | Do not downgrade the linter to Next 14 |

Defer, on purpose: Stripe 21 to 23, OpenAI 6 to 7, TypeScript 5 to 7, ESLint 9 to 10, Lucide 0.x to 1.x, React 19.2 to 19.3 unless a security note appears. `@supabase/supabase-js` `2.99.3` to `2.118.0` is a large minor. Do it in its own PR after the Next bump, and re-read the auth release notes. `@supabase/ssr` `0.9.0` to `0.12.x` belongs with that PR, not with a drive-by `npm update`.

Modern standard is to stay on the current major of the framework you already run, and to patch. Replacing Next, Supabase, or Stripe would be more risk than these advisories, and it would not fit a product at this size.

### 6.4 Structure and dead ends

- No CI, no formatter config, no `engines`, no test runner.
- Hand-written `src/types/database.ts` is about 56 KB beside 60 migrations. It will drift. Modern standard for Supabase is `supabase gen types`. Generate into a new file first so the hand-written types keep compiling. Do this after the storage and specialty-catalog migrations, or the generated file will be stale immediately.
- Server actions of 1,000+ lines mix uploads, notifications, AI, and database writes. Split by domain later (`uploads`, `bids`, `scope`). Not a first PR. A bad split causes merge pain and behavior changes.
- `next.config.ts` sets server-action body size to **350 MB**. That setting does not raise the platform request-body limit on Vercel. Large videos should upload from the browser straight to storage. The modern standard is a signed upload URL, with the server action receiving the storage path only. That also avoids pulling FFmpeg into the action bundle. This fits. It is a medium change. Do not add Mux, Cloudflare Stream, or another paid video host unless video playback becomes a product requirement.
- Perf `console.log` calls in middleware and the dashboard layout run for signed-in traffic. Delete them when fixing lint.
- Root `README.md` and `goldbridgebid/README.md` describe different products. The app README still says projects use multi-trade selection. The vision doc says expertise level replaced that. The vision doc’s “Near-Term Cleanup” list still includes forgot-password, admin password reset, a shared status pill, and a terms checkbox. Those exist now (`forgot-password`, `reset-password`, admin reset in `admin/actions.ts`, `ProjectStatusPill.tsx`, signup checkbox). The checklist and the address-quote design note still treat an estimator marketplace and lawn care as future ideas, while both are already built far enough to matter.

### 6.5 Tests

There are none. The first tests should be pure functions that already have sharp edges:

- `calculatePaidEstimateSplit` and `calculatePoolFundingTotal` (real money, 10% fee, rounding).
- Badge thresholds in `src/lib/badges.ts`.
- Cron authorization (wrong secret, missing secret).
- Craftsman loader when the JSON is absent (the desired production behavior).
- A characterization test that quick-quote service lists are data, once that refactor exists.

Modern standard for a marketplace is unit tests on money and a small set of permission tests on the database. A full browser suite is not the first test. Playwright against production would need accounts and would risk touching real Stripe test data. Skip that until there is a seedable local database.

Row-level security tests need Postgres. Local Supabase via Docker is the standard and does not add a paid service. The repo is not set up for it yet (`config.toml` is missing). That setup is its own PR, after the pure unit tests.

### 6.6 Trade coupling (do not “fix” this by adding more niches)

The sealed-bid core is already general: a project has a description, an expertise level, files, and bids. That should stay the center of the schema.

The parts that are not general:

1. **Specialty enum.** Fifty-two California-shaped values. A bidder who does a trade that is not on the CSLB list, or who works outside that vocabulary, does not fit. Modern standard in estimating software is a catalog table (code, label, optional parent, optional region), seeded with a regional list. CSI MasterFormat is the commercial-construction version of that idea. A full MasterFormat import is optional and is a lot of data. A simple `specialty_catalog` plus “add my own” matches this product better than adopting CSI as a dependency. Keep the existing enum column until reads have moved, so this stays additive.
2. **Quick-quote verticals.** A check constraint and a TypeScript union of exterior chores, defaulted to lawn care, measured by a component named for lawns. Modern standard is a quote with a service label (free text or catalog id) and quantity lines: count, length, area, volume. The map polygon is an area input. A lawn template can pre-fill “area, square feet, price per square foot”. A snow template, if anyone wants one later, pre-fills different fields. Neither template is imported by the bid engine.
3. **Cost book and wage sheet.** Both are California-and-building biased, and the book is not licensed in this repo. The wage sheet can remain as a labeled California seed. The book should not remain.

`DESIGN_PRINCIPLES.md` already matches the target: one estimate, show your work, say nothing when the signal is missing. The cleanup is to make the schema obey that, not to add vertical modules.

---

## 7. What is already in good shape

Keep these. Do not refactor them for style.

- Next.js App Router, React 19, Tailwind 4, and strict TypeScript are a current stack for this kind of app. They build.
- Bid-row RLS matches the sealed-bid story.
- Stripe webhook signatures, Connect payouts, and idempotency keys on transfers match how marketplaces move money in 2026.
- Password reset, admin-triggered reset, terms and privacy pages, and a signup terms checkbox exist. The vision doc is behind the code here.
- `ProjectStatusPill` exists so `completed` is not labeled `Closed`. The vision doc asked for that.
- `DESIGN_PRINCIPLES.md` is the right product compass for an estimator. Later AI work should be reviewed against it.
- The app folder name `goldbridgebid/` is a known legacy path. `project-vision.md` says to rename it only as a deliberate migration. This plan does not rename it. A rename touches Vercel’s root directory, imports, and docs, and it does not make the product safer.

---

## 8. What not to do

- Do not replatform (no new frontend, no move off Supabase, no custom auth server).
- Do not split into microservices.
- Do not start a React Native app. The vision doc lists that as a late phase.
- Do not add snow removal, landscaping, or any other trade as a module, route tree, or pricing engine.
- Do not implement `PUBLIC_ADDRESS_QUOTE_LAYER_DESIGN.md` as written where it says the first vertical is lawn care.
- Do not buy RSMeans, a Craftsman license, a new map vendor, a video host, or an error-tracking plan as part of this cleanup unless Steven approves that spend separately.
- Do not rewrite git history, force-push, or purge the cost book from GitHub until Steven says to.
- Do not combine this repository with any other project.
- Do not downgrade `eslint-config-next` to version 14 to silence `npm audit`.
- Do not raise `maxDuration` further or upgrade the Vercel plan inside a cleanup PR. See costs below.

---

## 9. Costs that need Steven’s approval

These are **not** recommended as steps. They are calls only Steven can make.

| Item | Why it might cost money | Recommendation in this plan |
|---|---|---|
| Vercel plan that allows a 300-second function | `maxDuration = 300` on the new-project layout. Hobby limits are much lower. If AI scope checks time out in production, the plan is the reason. | Confirm the current plan. Do not upgrade as a cleanup task. If the timeout is the pain, the cheaper code fix is a background job that does not hold the request open. |
| OpenAI API | Scope builder. Already optional via env flags. | Leave the flags. Do not switch models as a modernization step. |
| Google Maps and Mapbox | Geocode, Street View, and satellite tiles. Public unauthenticated routes can create charges. | The code change is to stop unbounded public use. That should reduce spend, not add a vendor. |
| Resend, Stripe, Supabase | Already the production stack. Stripe fees are per payment. Supabase and Resend have free tiers and paid tiers. | No new products. No Stripe Billing migration. Connect is already the right tool. |
| A licensed cost database | The legal way to show published unit costs. | Do not buy during cleanup. Ship without the committed book. |
| Error tracking (Sentry and similar) | Free tiers exist; paid tiers are easy to turn on. | Defer. Delete noisy logs first. |
| GitHub Actions | Included minutes. A private repo can exhaust the free quota. | A typecheck/lint/build workflow is small. No third-party CI vendor. |
| Video hosting, SMS, escrow, e-sign | Vision doc phases 2–4. | Out of scope. |

---

## 10. Ordered steps

Each step is meant to be its own pull request, mergeable without the ones below it, except where a step says it depends on an earlier one. Size is structural, not a calendar estimate.

**Small:** a handful of files, reviewable in one pass, little or no behavior change.
**Medium:** one feature area, needs a careful read and a manual check of that flow.
**Large:** must be split further before it is one PR. The first slice is described.

### Step 1. Record the product boundary and reconcile the docs

- **Does:** Add the trade-agnostic rule to `project-vision.md` (short subsection, pointing at this plan). Mark the near-term items that are already shipped (forgot password, admin reset, status pill, terms checkbox). Make `goldbridgebid/README.md` match the root README on expertise level and Node version. Add a banner at the top of `PUBLIC_ADDRESS_QUOTE_LAYER_DESIGN.md` and `PROJECT_PRODUCT_CHECKLIST.md` saying lawn and snow are examples, not the roadmap.
- **Why:** Otherwise the next change will follow the lawn design note. Comparable bid rooms treat trades as tags on a general project. That is the standard that fits this product. A vertical field-service app does not.
- **Modern standard:** One scope document that matches the code.
- **Size / risk:** Small / low.
- **Cost:** None.
- **Depends on:** Nothing. This plan is the companion, not a substitute for fixing the vision doc.

### Step 2. Stop tracking Supabase CLI link state

- **Does:** Remove `goldbridgebid/supabase/.temp/` from the index and gitignore it. Do not print the project ref or organization id into the PR.
- **Why:** The directory is local CLI state. It identifies the hosted project (ref, organization id, pooler host). It does not contain a database password.
- **Modern standard:** The Supabase starter ignores `.temp`.
- **Size / risk:** Small / low. No key rotation required for this step.
- **Cost:** None.

### Step 3. Make lint pass and delete request timing logs

- **Does:** Fix the 23 ESLint errors and 4 warnings. Remove the `[PERF]` `Date.now` logs in middleware, the dashboard layout, and project actions. Replace `any` on the customer project page with the existing database types. Fix `ConfirmDialog` and `AiWorkingOverlay` the way the React hooks rules describe.
- **Why:** The build is green and the linter is not, so the linter is being ignored. The purity errors are mostly debug logs that do not belong in production.
- **Modern standard:** `eslint-config-next` on the same major as Next, and a clean lint on every PR.
- **Size / risk:** Small / low.
- **Cost:** None.

### Step 4. Patch Next, Tiptap, and Resend inside their current majors

- **Does:** Bump `next` and `eslint-config-next` from `16.2.1` to the patched 16.4 line (`16.4.2` at assessment time), Tiptap packages from `3.22.3` to the current 3.32 line, and `resend` from `6.10.0` to the current 6.34 line. Remove unused `@supabase/auth-helpers-nextjs` and `pg`. Re-run `npm audit`, `tsc`, `eslint`, and `build`.
- **Why:** Audit reports critical issues in Next 16.2.1 and high issues in Tiptap. The unused auth-helpers package is abandoned.
- **Modern standard:** Patch the framework you have. Do not rewrite. Do not apply audit’s suggestion to downgrade ESLint config to Next 14.
- **Size / risk:** Small / medium. Read the Next 16.2 to 16.4 notes, especially the middleware-to-proxy warning. Behavior of pages should stay the same. If the proxy migration is required for the patch to be correct, do that migration in this PR using the Next docs shipped in `node_modules`, and nothing else.
- **Cost:** None.
- **Not in this PR:** MapLibre 6, Sharp 0.35, Stripe 23, OpenAI 7, Supabase JS 2.118, TypeScript 7.

### Step 5. Upgrade MapLibre and Sharp in two separate PRs

- **Does:** One PR moves `maplibre-gl` from 5.24.0 to the patched 6.x (6.14.0 at assessment time) and fixes call sites the major breaks, limited to the map components. A second PR moves `sharp` to the 0.35 line for the image-library advisories and checks thumbnail generation still runs.
- **Why:** MapLibre’s advisory is critical and the library is in the browser. Sharp’s advisory is high and the library processes user images. Both fixes are majors, so they do not belong in the Next patch.
- **Modern standard:** Upgrade the map renderer and the image library. Do not switch map vendors to “get a fix”.
- **Size / risk:** Small each / medium. Map pages (address quotes, area tool, project location) need a manual look. No new token and no new vendor.
- **Cost:** None.

### Step 6. Add CI for install, typecheck, lint, and build

- **Does:** A GitHub Actions workflow: `npm ci`, `tsc --noEmit`, `eslint`, `next build`, with the same kind of placeholder public env used in this assessment. No secrets in the workflow.
- **Why:** The checks above already distinguish a healthy tree from a broken one. They are not running on pull requests.
- **Modern standard:** Those four checks on every PR. A paid CI product is unnecessary.
- **Size / risk:** Small / low. Depends on step 3 and step 4 so the workflow starts green. If those land first, this workflow fails until they do, which is also acceptable if Steven wants the gate immediately.
- **Cost:** GitHub-hosted minutes only. No new vendor.

### Step 7. Write down the real environment contract

- **Does:** Extend `.env.local.example` with the variables the code already reads (OpenAI and `PROJECT_AI_*`, Resend, Mapbox public and server tokens, Google Maps, `ACCOUNT_SIGNAL_HASH_SALT`), each marked required or optional. Add a small Zod parse used by server code so a missing **required** variable fails with the variable name. Set `engines.node` to `>=20`, matching the app README and the Node 22 run that built cleanly here. Set `metadataBase` from `NEXT_PUBLIC_SITE_URL` when it is present.
- **Why:** The example file understates what production uses. A new machine cannot tell why the scope builder or mail is silent.
- **Modern standard:** Validate env at startup. Zod is already a dependency, so no new library is required. `t3-env` would also be fine and is optional.
- **Size / risk:** Small / low, if missing optional keys stay optional. Do not make Mapbox or OpenAI required. The product must boot without them.
- **Cost:** None. Do not create new cloud accounts.

### Step 8. Private storage for bid files and credentials

- **Does:** New migration: credential and bid buckets are private. `SELECT` / `UPDATE` / `DELETE` on `storage.objects` require the object owner (path prefix) or an admin. App code uploads and reads them with signed URLs. Existing `getPublicUrl` call sites for those two buckets change together with the migration. Leave project-photo visibility as its own decision so this PR does not blank public project galleries by accident.
- **Why:** This is the sealed-bid and credential promise in `project-vision.md` (“Security & Privacy”, “Bid Visibility & Award Flow”). Row policies do not cover a public storage URL.
- **Modern standard:** Private buckets and signed URLs. Fits without a new storage vendor. Supabase Storage already supports this.
- **Size / risk:** Medium / high. Old public URLs stored in rows will 403 after the bucket is private. Ship the signed-URL reads in the same release as the privacy change. Try it on a copy of the database first, not only in code review.
- **Cost:** None beyond current Supabase storage.
- **Depends on:** Nothing structural. Do it before large refactors so later work does not copy `getPublicUrl` again.

### Step 9. Close the public maps billing hole

- **Does:** `google-maps-key` returns only a public browser key, never `GOOGLE_MAPS_API_KEY`. If no browser key is set, return 404 and let the map use the existing non-Google fallback. Add a simple per-IP limit on geocode, reverse-geocode, and street-view. Prefer the free fallback when Google is not configured, and do not proxy OpenStreetMap Nominatim as an unlimited anonymous API.
- **Why:** Those routes are public and can spend a Google or Mapbox budget. A server key in the browser cannot be restricted well.
- **Modern standard:** Restricted public tokens in the client, rate-limited server geocoding. Fits the current MapLibre + fallback design. Do not sign up for a new geocoder.
- **Size / risk:** Small / medium. If production was accidentally using the server key as the browser key, satellite tiles will fall back until a restricted browser key is set in Vercel. That is the correct failure.
- **Cost:** Should reduce spend. Creating a restricted browser key in an account Steven already has is configuration, not a new bill. Confirm before anyone enables billing on a new Google project.

### Step 10. Sanitize rich text with an allowlist

- **Does:** Replace the regex in `RichTextRenderer` with an allowlist HTML sanitizer. Add a few unit tests: script tags, event handlers, and ordinary Tiptap paragraphs.
- **Why:** Bid notes and project descriptions are user HTML rendered for other users.
- **Modern standard:** Allowlist sanitizer. A regex is not enough.
- **Size / risk:** Small / low. Some styling might get stripped. That is acceptable.
- **Cost:** None. Use a maintained, free library. No SaaS sanitizer.

### Step 11. Require a dedicated identity-hash salt, and compare the cron secret in constant time

- **Does:** In production, refuse to hash account signals if `ACCOUNT_SIGNAL_HASH_SALT` is missing. Delete the service-role-key fallback and the hardcoded fallback for production. Use `crypto.timingSafeEqual` in `isAuthorizedCronRequest`. Do not rehash old rows in this PR.
- **Why:** The service-role key must not also be a pepper. Cron auth should not use a short-circuit compare.
- **Modern standard:** Separate pepper, timing-safe compare. Both fit the current auth model.
- **Size / risk:** Small / medium. If live hashes were made with the service-role key, new signals will not match old ones until a later, explicit rehash. Call that out in the PR so Steven is not surprised. Existing logins do not depend on these hashes.
- **Cost:** None.

### Step 12. Unit tests for money and other pure helpers

- **Does:** Add Vitest. Test paid-estimate fee splits (including rounding), pool totals, badge levels, cron auth, and the craftsman loader’s missing-file path. Wire `npm test` into the CI workflow from step 6.
- **Why:** The 10% fee is real money and has zero tests. These modules do not need a database.
- **Modern standard:** Test the money function before testing the UI. Fits. A hosted test cloud does not fit this stage.
- **Size / risk:** Small / low.
- **Cost:** None.

### Step 13. Untrack the cost book and stop describing it as a price source

- **Does:** After Steven agrees in review of this plan: stop calling `craftsman-lookup` from the AI prompt, delete the “published unit costs” wording, gitignore `goldbridgebid/data/*estimator*` and the parsed JSON, and `git rm --cached` the PDF, the text extract, the JSON, and the parser script. Keep `trade-wages.ts` as a clearly labeled California seed, and show “no published unit cost” when a line has no estimator-entered price. Update `DESIGN_PRINCIPLES.md` only if a sentence still implies the book is present.
- **Why:** The files are a third-party estimating book. Shipping them is not how STACK, ProEst, or a licensed RSMeans workflow works. The loader already survives a missing file.
- **Modern standard:** Licensed data feed, or the user’s own assemblies. The second one fits this budget. The first one costs money and is not recommended here.
- **Size / risk:** Medium / medium. Scope-check output will have fewer dollar figures. That is the honest behavior `DESIGN_PRINCIPLES.md` asks for. Do not replace the book with web scraping.
- **Cost:** $0 to remove. A paid cost license is out of band.
- **Not in this PR:** rewriting git history. That is a separate, explicit operation (filter the blobs and force-push) and it needs Steven’s approval because it rewrites published history. Say so in the PR and stop there.
- **Depends on:** Step 12’s missing-file test, so the removal is proven.

### Step 14. Specialties become a catalog, with the CSLB list as a California seed

- **Does, first PR only:** Add a `specialty_catalog` table (stable id, label, optional region tag such as `US-CA`, optional external code). Seed it with the current `TradeCategory` labels, tagged as California license classes, plus the legacy aliases. Let a bidder store a catalog id **in addition to** the old enum column. Do not drop the enum. Do not add snow, lawn, or any new niche as a special case.
- **Later PRs:** Read paths use the catalog. “Add a specialty” writes a catalog row instead of a migration. Only then consider retiring the enum.
- **Why:** Unlimited trades cannot live in a 52-value Postgres enum. Commercial bid tools and estimating tools keep trades and cost codes in tables. A CSLB seed is a courtesy for California contractors, which matches the launch market, without making California the product.
- **Modern standard:** Catalog as data. MasterFormat can be a future import if commercial GCs ask for it. It should not be a prerequisite.
- **Size / risk:** First PR is medium / medium because it is a migration plus a dual-write. The later retirement of the enum is large and waits.
- **Cost:** None.
- **Depends on:** Step 1 so the PR description uses the same rule. Can proceed in parallel with steps 8–13 if the migration does not touch storage.

### Step 15. Quick quotes use generic quantities; niches are templates

- **Depends on:** Step 14’s idea, but it can ship against the existing service strings first if the catalog is not ready. Prefer after step 14 so there is one catalog.
- **Does, first PR:** Rename the area component in the UI sense to a general area measurement (file rename can wait if it causes a huge diff; the props, headings, and default form values cannot). Remove `defaultValue="lawn_care"` and the lawn-mowing placeholder. Add optional quantity fields that are not lawn-specific: area, length, count, and a unit label. Keep saving the old `service_vertical` column so existing rows still render.
- **Later PR:** Relax the check constraint so a service can be any catalog id or a short custom label. Move lawn / paint / gutter field sets into template rows a contractor may apply. Delete `if (vertical === "lawn_care")` style branches if any appear. Do not add a snow-removal module.
- **Why:** `LawnAreaMeasurementMap` and the seven-value check constraint make a general quick quote look like a lawn product. Area, length, and count are how estimators measure any trade.
- **Modern standard:** Takeoff quantities, plus optional templates. Vertical SaaS is the standard for a lawn company and the wrong standard here.
- **Size / risk:** First PR medium / medium (form and copy, existing rows keep working). Constraint change is a second PR, medium / medium.
- **Cost:** None. Keep the current tile fallback. Do not add a map vendor.

### Step 16. Narrow the service-role client, one area at a time

- **Does:** Start with public address-quote reads. Switch them to the user-scoped client or to a SQL function that exposes only public columns. Repeat for bidder dashboards, then customer project pages. Leave webhooks, crons, and admin mutations on the service role, with a one-line comment.
- **Why:** A service-role read skips RLS. The sealed-bid policies only help if the page uses them.
- **Modern standard:** User-scoped database access by default. Fits Supabase. A custom API layer in front of Postgres does not fit this app.
- **Size / risk:** Large if done at once. Each area is a medium PR / medium risk. Do address quotes first because those pages are public.
- **Cost:** None.
- **Depends on:** Step 8, so file URLs are not “fixed” by bypassing storage with the service role. Step 12 can cover any pure helper extracted along the way.

### Step 17. Generate database types, then split the largest action files

- **Does:** Check in Supabase-generated types beside `database.ts` and fix drift that is clearly a bug. After that, split `customer/projects/actions.ts` and `address-quotes/actions.ts` into focused modules without changing behavior. Move uploads to direct-to-storage signed URLs so the 350 MB server-action setting can come down. Revisit FFmpeg: if posters are not required, remove `ffmpeg-static` in that upload PR.
- **Why:** Hand-written types and 70 KB action files are how sealed-bid mistakes sneak in. Direct-to-storage is how large files actually work on Vercel.
- **Modern standard:** Generated types, small server modules, signed uploads. All three fit. A new upload SaaS does not.
- **Size / risk:** Medium each / medium. Do not start until steps 8 and 14 have settled the schema those types describe.
- **Cost:** None.

### Step 18. Only if production AI scope checks are timing out

- **Does:** Move the OpenAI call off the request that the user is waiting on, or confirm the Vercel plan really allows 300 seconds. Do not do both by default.
- **Why:** `maxDuration = 300` is a hosting-plan dependency hiding in a layout file.
- **Modern standard:** Long model calls run as background work with a status the page can poll. That fits, and it avoids a plan upgrade. A queue vendor (Inngest, Trigger.dev) can wait until the volume needs it. A database row plus the existing cron style is enough at the vision doc’s scale.
- **Size / risk:** Medium / medium.
- **Cost:** The background-job version is $0. Raising the Vercel plan needs approval. Do not upgrade in the same PR as the code.

---

## 11. Suggested order

1. Docs boundary (step 1) and `.temp` gitignore (step 2), in either order.
2. Lint (step 3), then Next/Tiptap/Resend (step 4), then CI (step 6). MapLibre and Sharp (step 5) can follow immediately.
3. Env contract (step 7), rich-text sanitizer (step 10), cron/salt (step 11), unit tests (step 12).
4. Private bid and credential storage (step 8) and map billing (step 9), before feature work.
5. Cost-book removal (step 13) once Steven has agreed. History purge stays a separate yes/no.
6. Specialty catalog (step 14), then generic quick-quote quantities (step 15).
7. Service-role narrowing (step 16), generated types and upload split (step 17).
8. AI timeout work (step 18) only if it is actually failing.

Steps 1–7 and 10–12 are the quick wins. Steps 8, 9, and 13 are the ones that protect users and the owner. Steps 14 and 15 are the ones that keep the product general. Steps 16–18 are cleanup once the trust boundaries are in place.

---

## 12. Verification notes for the next implementer

- Run from `goldbridgebid/`: `npm ci`, `npx tsc --noEmit`, `npx eslint . --max-warnings 0`, `npm test` once it exists, `npm run build`.
- The production build succeeds with placeholder `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`, and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`. It does not need live secrets.
- Do not point a local build at the production Supabase project to “see if it works”.
- After step 8, click through as two different bidders on one project and confirm bidder A cannot open bidder B’s file URL.
- After step 15, create a quick quote for a non-lawn service and confirm no component title says “lawn” unless the user picked a lawn template.
- Re-read `DESIGN_PRINCIPLES.md` before any AI or pricing change. False confidence is worse than no number.
