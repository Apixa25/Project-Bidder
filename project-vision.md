# 🏗️ ProjectXBidX.com — Project Vision

> **"Where qualified contractors compete for your project."**

---

## Table of Contents

1. [Overview](#overview)
2. [Core Concept](#core-concept)
3. [User Types & Roles](#user-types--roles)
4. [Tech Stack](#tech-stack)
5. [Design & Branding](#design--branding)
6. [Feature Specifications](#feature-specifications)
   - [Project Posting (Customer)](#project-posting-customer-side)
   - [AI Scope Builder](#ai-scope-builder)
   - [Bidder Onboarding & Profiles](#bidder-onboarding--profiles)
   - [Bid Submission](#bid-submission-bidder-side)
   - [Bid Visibility & Award Flow](#bid-visibility--award-flow)
   - [Edit Tracking & Date Stamps](#edit-tracking--date-stamps)
   - [Project Q&A](#project-qa)
   - [Messaging System](#messaging-system)
   - [Notification System](#notification-system)
   - [Verified Reviews & Hearts](#verified-reviews--hearts)
   - [Paid Estimates](#paid-estimates)
   - [Quick Quotes by Address](#quick-quotes-by-address)
   - [Estimate Library & Estimator Role](#estimate-library--estimator-role)
   - [Dashboards](#dashboards)
   - [Admin Dashboard](#admin-dashboard)
7. [Project Status Lifecycle](#project-status-lifecycle)
8. [Currently Shipped](#currently-shipped)
9. [Future Phases](#future-phases-still-to-build)
10. [Database Architecture Overview](#database-architecture-overview)
11. [Security & Privacy](#security--privacy)
12. [Document History](#document-history)

---

## Overview

**ProjectXBidX.com** is a construction bidding marketplace that connects **customers** who have projects with **qualified contractors** who want to bid on them. Customers post projects with rich descriptions, documents, photos, and videos. Pre-qualified bidders browse available projects and submit sealed bids. The platform layers in qualification badges, AI-assisted scope building, optional paid estimate pools, in-platform messaging, verified reviews, and a public quick-quote-by-address marketplace.

- **Industry:** All types of construction
- **Launch Market:** Crescent City, California
- **Database Scope:** Designed for nationwide scale from day one
- **Initial Expected Scale:** ~100 customers, ~500 bidders

---

## Core Concept

This is a **sealed-bid marketplace** for construction projects, plus a set of focused tools that make pricing and verification easier for both sides:

1. **Customers** post projects with rich details (descriptions, uploads, expertise level, completion criteria)
2. **Bidders** create accounts, optionally upload credentials (license, bond, insurance, workers' comp, EIN, references), and earn visual qualification badges
3. **AI Scope Builder** helps customers turn a description into a clean checklist of work items so bids are apples-to-apples
4. Bidders browse projects (filtered by their service area + specialties) and **submit sealed bids** — only the customer and admin can see bid details
5. Customers can optionally fund a **Paid Estimate Pool** with Stripe to reward qualified contractors for submitting bids
6. Customers review all bids with full bidder profiles, qualification badges, contact info, and a side-by-side bid comparison view
7. Customers award jobs (optional formal award with notifications, or quiet close)
8. After the job, both sides can leave **verified reviews** that build long-term reputation
9. Separately, a **public Quick-Quotes-by-Address** marketplace lets contractors leave drive-by quotes on real properties and customers claim and request quotes for their own addresses
10. **Estimators** publish reusable estimate packages (takeoffs, scope checklists) into a public Estimate Library that customers and contractors can purchase

**Key insight:** Customers pick a **Level of Professional Needed** (Licensed Contractor / Handyman / General Labor) instead of selecting trades. Higher levels = higher prices and a smaller pool of credentialed bidders. Lower levels = lower prices and a larger pool. This replaces the original "multi-trade selection" design and lets a single project flex across price points.

---

## User Types & Roles

### Customer (Project Owner)

- Posts projects with detailed descriptions, uploads, expertise level, and completion criteria
- Optionally uses the AI Scope Builder to generate a scope checklist
- Reviews sealed bids from all bidders (with side-by-side comparison)
- Optionally funds Paid Estimate Pools to reward qualified bidders
- Awards jobs (optional formal award with notifications, or quiet close)
- Communicates with bidders through in-platform messaging and per-project Q&A
- Leaves verified reviews after awarded projects
- Can also claim addresses and request public Quick Quotes from contractors
- Can browse and purchase Estimate Packages from the Estimate Library
- Manages projects through a personal dashboard

### Bidder (Contractor)

- Creates an account with business info
- Uploads optional credentials (license, bond, insurance, workers' comp, EIN, references)
- Earns qualification badges (Gold / Silver / Bronze) based on uploaded documents
- Picks **Specialties** (the trades they actually work in) and **Service Areas** (cities/states they cover)
- Browses projects filtered by their specialties and service areas
- Submits sealed bids with pricing, timeline, start date, and supporting documents
- Can save searches and turn on alerts for matching new projects
- Can claim **Paid Estimate** rewards by submitting bids on funded projects (when eligible)
- Connects a Stripe payout account to receive paid estimate payouts
- Communicates with customers through in-platform messaging and Q&A
- Leaves verified reviews after winning awarded projects
- Can also leave public **Quick Quotes** at any address to win small drive-by jobs
- Can browse and purchase Estimate Packages from the Estimate Library
- Tracks all submitted bids through a personal dashboard

### Estimator (Niche Role)

- Publishes professional **Estimate Packages** (full takeoffs, scope checklists, pricing references for common project types) into the public Estimate Library
- Responds to one-off **Estimate Requests** from customers and contractors who need custom takeoffs
- Receives Stripe payouts when packages or estimates are purchased
- **Not shown on the public signup chooser** — estimators arrive via a direct link (`/signup?role=estimator`) or a future invite flow. Expected to be ~1 in 1,000 signups.

### Admin (Platform Owner)

- Full visibility into all projects, all bids, all messages across the platform
- User management (ban/remove bad actors)
- Flagged/reported content moderation queue
- Reviews moderation queue
- Disputes queue (paid estimate disputes between customers and bidders)
- Stripe Readiness dashboard (payout account status across all bidders/estimators)
- Platform analytics and audit log
- No pre-approval required for project posting (instant publish)

### Future: Dual-Role Accounts

- In a future phase, a single user will be able to act as Customer + Bidder + Estimator simultaneously
- The platform already supports multiple roles per user (`user_roles` table + a Role Switcher in the dashboard sidebar) — the dual-role experience is technically supported but not yet promoted publicly. Today, signup creates a single role and most users stay there.

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Next.js 16 (React) | Mobile-responsive web application with App Router |
| **Backend/Database** | Supabase (PostgreSQL) | Database, authentication, storage, realtime |
| **Hosting** | Vercel | Frontend hosting, serverless functions, edge network |
| **Authentication** | Supabase Auth | Email/password + Google OAuth |
| **File Storage** | Supabase Storage | Private buckets for documents, photos, videos, bid files |
| **Realtime** | Supabase Realtime | Live chat, bid notifications, project update alerts |
| **Styling** | Tailwind CSS | Utility-first CSS for rapid, consistent UI development |
| **Payments / Payouts** | Stripe | Paid Estimate Pool funding, contractor/estimator payouts via Connect |
| **AI Analysis** | Server-side LLM | Powers the AI Scope Builder for project posting |
| **Maps** | Custom address lookup + map preview | Address Quote discovery, project location previews |

### Why This Stack?

- **Supabase** provides PostgreSQL with row-level security (bidders can't see other bids), built-in auth, file storage with private URLs, and realtime subscriptions — all in one platform
- **Next.js on Vercel** gives us server-side rendering, API routes, image optimization, and blazing-fast deployments
- **Stripe** handles the money: customers fund Paid Estimate Pools via Checkout; bidders/estimators get paid via Connect onboarding
- **Cost at launch scale** (~600 users): low — most billing flows through Stripe processing fees, not platform infrastructure
- **Scalability:** Both Supabase and Vercel scale automatically as the platform grows nationwide

---

## Design & Branding

### Name & Domain

- **Platform Name:** ProjectXBidX.com
- **Working Tagline:** "Where qualified contractors compete for your project."

### Naming & repository (for contributors and tooling)

- **Public product / brand:** **ProjectXBidX.com** in prose; **projectxbidx.com** is the live domain (and addresses like `support@projectxbidx.com`). The UI often uses the stylized **`projectxbidx`** wordmark — that is the same product, not a different name.
- **Early working name:** The product was previously referred to as *GoldBridgeBid.com* in some docs and paths; treat **ProjectXBidX.com** / **projectxbidx** as canonical for product questions.
- **This repo:** The Next.js app lives in the **`goldbridgebid/`** directory (legacy folder name). Renaming it would touch Vercel root, imports, and scripts — only do that as a deliberate migration.
- **`package.json` name:** The internal npm name (`projectxbidx`) is a stable technical identifier and may differ from the marketing domain.

### Color Palette

Warm, earthy, construction-appropriate tones:

| Role | Color | Hex (Approximate) |
|------|-------|--------------------|
| **Primary** | Warm Orange | `#D97706` |
| **Secondary** | Forest Green | `#15803D` |
| **Accent** | Earth Brown | `#78350F` |
| **Background** | Warm White / Light Sand | `#FFFBEB` |
| **Text** | Charcoal | `#1C1917` |
| **Muted** | Warm Gray | `#78716C` |

### Design Principles

- **Professional & trustworthy** — contractors and homeowners both feel confident using it
- **Clean and uncluttered** — easy to scan bids, projects, and profiles quickly
- **Mobile-responsive** — works perfectly on phones (contractors are often on-site) but optimized for desktop workflows (document uploads, bid reviews)
- **Visual qualification system** — badge icons and green checks make screening instant
- **Construction-appropriate** — bold, warm, sturdy aesthetic — not corporate sterile
- **Honest copy** — see `DESIGN_PRINCIPLES.md`: *"False confidence is much worse than no confidence."* Never fabricate pricing, never present algorithm defaults as AI insight, ask rather than assume, and show your work.

---

## Feature Specifications

### Project Posting (Customer Side)

#### Required Fields

| Field | Description |
|-------|-------------|
| **Title** | Short, descriptive project name |
| **Description** | Detailed project description (rich text) with full scope of work |
| **Level of Professional Needed** | Licensed Contractor / Handyman / General Labor (replaces the old multi-trade selection) |
| **Location** | Street, city, state, ZIP |

#### Optional Fields

| Field | Description |
|-------|-------------|
| **Desired Start Date** | When the customer wants work to begin |
| **Expected Duration** | Free text estimate ("e.g., 2–3 weeks") |
| **Budget Range** | Min/max in USD (helps bidders decide if it's worth bidding) |
| **File Uploads** | Photos, videos (MP4/MOV/WEBM/M4V), PDFs, plans, spreadsheets |
| **AI Scope Builder Output** | A scope checklist generated by the AI and curated by the customer |
| **Paid Estimate Pool** | Optional funded reward pool for bidders, configured at post time or later |

#### Expertise Level Logic

Customers no longer pick from the original 11-trade fixed list. Instead they pick one of three expertise levels:

- **Licensed Contractor** — Highest qualifications, fewer eligible bidders, typically the highest bid prices
- **Handyman** — Mid-range bid prices, broader pool of bidders, no full contractor license required
- **General Labor** — Lowest bid prices, largest pool of bidders, no license or specialized skills needed

The customer-facing posting form includes an explicit price/qualification primer so customers don't accidentally over-shop a small job.

> **Why this changed:** Multi-trade selection produced too many false-negative matches and forced customers to know construction taxonomy upfront. Expertise Level lets the customer say what kind of professional they want and lets contractors self-select if they fit. Bidders still pick their own **Specialties** for filtering.

#### Project Editing Rules

- Customers **can edit** their projects after posting
- Edit history is logged in `project_edits` and displayed on the project page
- All existing bids carry **date stamps** — it is always clear whether a bid was submitted before or after an edit
- Bidders who have already bid on the project **receive a notification** when edits are made

#### Project Closing

- Customers can **close** a project at any time to stop receiving new bids
- Customers can **award** a winning bidder; awarding can optionally notify all non-selected bidders the project has been taken (without revealing who won)

---

### AI Scope Builder

The AI Scope Builder is a built-in tool on the project posting page that helps customers turn an unstructured description into a clean checklist of work items.

- The customer fills in title, description, expertise level, location, files, etc.
- They click **"Build My Scope Checklist"**
- The AI reads everything (including file metadata) and proposes a list of standard scope items for the project type
- The customer can include or skip each item, plus add custom items ("e.g. pick up trash in driveway before leaving")
- The AI also returns clarifying questions (typed: free-text, single-select, multi-select) the customer can answer to refine the scope
- The final scope is stored in `project_ai_estimates`, `project_ai_scope_items`, `project_ai_clarifications`, and `project_ai_item_clarifications`
- The customer can publish the curated scope to bidders, who then see "Expected Items to Bid On" in the bid form

**Important honesty constraint:** The AI Scope Builder is a *scope-building tool*, not a final price. The UI consistently labels it as a planning reference, not a quote. We never present its output as "the right price" — we let real contractor bids do that.

---

### Bidder Onboarding & Profiles

#### Account Creation

- Email + password (required)
- Google OAuth (optional sign-in method)
- Phone number (required)
- Address (required)
- Business name (optional but encouraged)

#### Credential Uploads (All Optional, but Some Are Encouraged)

| Document | Description |
|----------|-------------|
| **Contractor License** | Copy of their trade license |
| **Bond** | Surety bond documentation |
| **Insurance** | General liability insurance certificate |
| **Workers' Compensation** | Workers' comp certificate |
| **EIN** | Employer Identification Number documentation |
| **References** | Professional references (text or uploaded documents) |

**None of these are required to bid.** Many great contractors won't fill everything out initially. However, uploading more documents earns a higher qualification badge. The Credentials page surfaces License, Bond, and Insurance as "core" credentials — uploading those three earns a green "core check" indicator alongside the badge.

#### Qualification Badge System

| Badge | Criteria | Visual |
|-------|----------|--------|
| 🥇 **Gold Star** | All 6 documents uploaded | Gold star icon |
| 🥈 **Silver Star** | 4–5 documents uploaded | Silver star icon |
| 🥉 **Bronze Star** | 1–3 documents uploaded | Bronze star icon |
| *(No badge)* | 0 documents uploaded | "No Badge Yet" placeholder |

Each individual document shows a **green checkmark** (✅) if present or a **gray placeholder** if not, allowing customers to see at a glance exactly which credentials a bidder has. The license, bond, and insurance triplet earns a separate "Core Credentials" check.

#### Specialties + Service Areas

- **Specialties:** Bidders pick one or more trades they actually work in (electrical, plumbing, framing, etc.). Used for filtering Browse Projects and surfacing the bidder in customer searches.
- **Service Areas:** Bidders pick the cities/states they cover. Browse Projects automatically filters to show only projects inside those areas (with a visible "Showing X of Y" hint).

---

### Bid Submission (Bidder Side)

#### Two Submission Methods

**Method 1: Form Entry**
Bidders fill out a structured form with all bid details — they can cut and paste their information directly into the form fields.

**Method 2: Document Upload**
Bidders scan and upload their own bid documents (PDFs, images, etc.) — for contractors who already have proposals in their own format.

Both methods can be used together (fill out the form AND attach documents). Bidders can also break the bid into structured **line items** for cleaner side-by-side comparison.

#### Bid Form Fields

| Field | Required? | Description |
|-------|-----------|-------------|
| **Trade Selection** | Yes | Which of the bidder's specialties they're bidding under |
| **Price** | Yes | Lump sum bid amount |
| **Price Breakdown** | Optional | Free text breakdown of labor/materials/etc. |
| **Bid Line Items** | Optional | Structured line items (label, qty, unit price) for clean comparison |
| **Estimated Timeline** | Yes | How long the work will take |
| **Estimated Start Date** | Yes | When they can begin work |
| **Notes / Message** | Optional | Free-text rich-text message to the customer |
| **File Uploads** | Optional | Supporting documents, proposals, photos, plans, etc. |

#### Bid Integrity

- Every bid has a **date/time stamp** showing exactly when it was submitted
- This timestamp is critical for protecting bidders when projects are edited after they've already bid
- Bidders can submit additional bids on the same project under different trades they specialize in
- Bidders can edit their own submitted bids; the project owner cannot

---

### Bid Visibility & Award Flow

#### Sealed Bids

- Bids are **sealed** — only the **customer** (project owner) and **admin** can see bid details
- Bidders **never** see competing bids (no bid amounts, no competing bidder info)
- Customers see **all bids** with:
  - Full bidder profile (name, company, contact info, avatar, specialties)
  - Qualification badge (Gold/Silver/Bronze) and Core Credentials check
  - Individual document checkmarks
  - Verified review average + count
  - Bid price, timeline, start date, notes, line items
  - All uploaded bid documents
- A **Bid Comparison** toggle renders all bids in a side-by-side table for fast review

#### Awarding a Project

- **Optional "Award" button** — When a customer selects a winning bidder, they can press "Award" which:
  - Marks the project as "Awarded" and the bid as the winning bid
  - Sends a **courtesy notification** to all non-selected bidders that the project has been awarded (without revealing who won)
- **Quiet Close** — Alternatively, the customer can simply close the project without notifying anyone
- Either side can later leave a **verified review** of the other party

#### Post-Award

- The customer already has the winning bidder's **email and phone number** from the bid
- All coordination happens **offline** (phone, email, in-person)
- No built-in contracts or escrow at this stage

---

### Edit Tracking & Date Stamps

This system protects bidders from scope creep and ensures transparency:

1. **All project edits** are logged in `project_edits` and visible on the project page
2. **Every bid** carries a permanent **date/time stamp** showing when it was submitted
3. **Bidders who already bid** receive a **notification** when the project is updated, prompting them to review changes
4. This makes it crystal clear whether a bid was placed **before or after** any scope changes

---

### Project Q&A

- Every project has a public **Q&A** section visible to bidders
- Bidders can ask clarifying questions about scope; customers can answer
- All Q&A is preserved on the project page so future bidders see the answers
- This is separate from private 1:1 messaging — Q&A is intentionally public so the customer doesn't have to answer the same question 10 times

---

### Messaging System

In-platform messaging for direct communication between customers and bidders.

- Every project has messaging capability
- **Customers** can message any bidder who has submitted a bid on their project
- **Bidders** can message the customer of a project they've bid on
- Messages support **text** and **file sharing** (additional photos, revised proposals, clarifying documents)
- **Real-time** delivery via Supabase Realtime
- Conversation history is preserved and accessible from both dashboards
- Conversations are scoped per-project per-other-user (Upwork-style "rooms")

---

### Notification System

Users receive notifications for key platform events:

#### Customer Notifications

- New bid received on their project
- New message from a bidder
- New Q&A question on their project
- (Future: bid milestone notifications)

#### Bidder Notifications

- Project they bid on was **edited** (with prompt to review changes)
- Project they bid on was **awarded** (courtesy notification if customer chooses to send)
- Project they bid on was **closed**
- New message from a customer
- New project matches a saved search (when saved-search alerts are enabled)
- Paid estimate claim status changes (reserved, paid out, denied)

#### Delivery

- **In-app notifications** (notification bell/badge in the dashboard)
- **Email notifications** (for critical events like bids received, project edits, paid estimate updates)
- (Future: SMS notifications)

---

### Verified Reviews & Hearts

#### Verified Platform Reviews

- After a project is awarded, both the customer and the winning bidder can leave a **verified review** of the other party
- Verified reviews are tied to a specific project and require the award to be in place
- Average rating + count are surfaced on profiles, in bid comparisons, and in browse-project customer snapshots
- Reviews are moderated by admin (with a Reviews queue in the admin dashboard)

#### Hearts

- Customers and contractors can "heart" each other's profiles to express interest or save them for later
- Heart counts are public on the profile page and on bid comparison rows
- Used as a lightweight social signal alongside formal reviews

---

### Paid Estimates

Customers can optionally fund a **Paid Estimate Pool** on a project to attract more serious bids.

- The customer enables the pool (either at project post time or later from the project detail page)
- They set a **reward per estimate** (e.g., $100) and a **number of paid slots** (e.g., 3 → $300 total funding)
- They pick a **filter**: `open_to_anyone` or `core_verified_only` (only bidders with license + bond + insurance)
- Stripe Checkout collects the funding from the customer
- Eligible bidders who submit a real bid claim a paid slot (`paid_estimate_claims` table)
- Claims auto-pay out after a configurable period unless the customer raises a **dispute** (via the project page)
- Bidders need a connected **Stripe payout account** to actually receive funds — claims sit in a `payout_pending` state until then
- Admins have a Disputes queue to resolve customer-vs-bidder paid estimate disputes

This is one of the platform's primary revenue mechanisms (we take a small platform fee on the funding side).

---

### Quick Quotes by Address

A separate, public-facing marketplace for short-form quotes tied to a specific real-world address.

- Anyone can search any U.S. address from `/address-quotes` and see published quotes for that address
- Customers can **claim** up to 3 of their own addresses (with verification) and create **Quick Quote Requests** asking specific contractors to leave a quote
- Contractors can leave **public quotes** at any address (think drive-by estimates for fence repair, lawn care, exterior paint, etc.)
- Customer-side dashboard: "My Quick Quote Requests" (under Tools)
- Bidder-side dashboard: "Open Quick Quote Requests" (under Tools)

This is meant for the "I just want a price for X at my house" use case where a full sealed-bid project is overkill. Internally the database tables use `address_quote_*` naming; the user-facing labels use "Quick Quotes" / "Quote Requests" for clarity.

---

### Estimate Library & Estimator Role

#### Estimate Library

- A public catalog of **Estimate Packages** published by professional estimators
- Each package is a reusable scope/takeoff/pricing reference for a common project type (kitchen remodel, roof tear-off, fence build, etc.)
- Customers and contractors can browse and purchase packages
- Purchased packages live under the buyer's "My Estimate Packages" section

#### Estimate Requests

- One-off requests where a customer or contractor pays an estimator to produce a custom takeoff
- Estimators see open requests in their dashboard and can claim/respond

#### Estimator Role

- Estimators get a dedicated dashboard with My Packages, Estimate Requests, Payouts, Messages, Profile
- Estimators are not on the public signup chooser. They arrive via `/signup?role=estimator` (linked from the bottom of the signup page and the How It Works page) or via direct admin invite
- Stripe payouts are required to receive funds

---

### Dashboards

The dashboard sidebar is grouped into visual sections per role to keep the most-used links at the top.

#### Customer Dashboard

- **(Top, no header):** Dashboard, My Projects, Incoming Bids, Messages
- **Tools:** Find Contractors, Look Up an Address, My Quick Quote Requests, Estimate Library, My Estimate Packages
- **Account:** Profile

#### Bidder Dashboard

- **(Top, no header):** Dashboard, Browse Projects, My Bids, Messages
- **Tools:** My Quick Quotes, Open Quick Quote Requests, Estimate Library, My Estimate Packages
- **Setup:** Credentials, Payouts, Profile

#### Estimator Dashboard

- **(Top, no header):** Dashboard, Estimate Requests, My Packages, Messages
- **Tools:** My Purchases
- **Setup:** Payouts, Profile

#### Admin Dashboard

- **(Top, no header):** Dashboard, All Projects, All Bids, Users, Messages
- **Moderation:** Flagged Content, Reviews, Disputes
- **Tools:** Paid Estimates, Quick Quotes, Estimate Packages, Estimate Requests
- **Platform:** Stripe Readiness, Analytics, Audit Log

---

### Admin Dashboard

- **All projects** across the entire platform with search/filter
- **All bids** on any project (full visibility)
- **All messages** (admin can audit conversations)
- **User management** — view all users, ban/remove bad actors, revoke roles
- **Flagged/reported content** moderation queue
- **Reviews** moderation queue
- **Paid Estimate Disputes** queue
- **Stripe Readiness** dashboard (which bidders/estimators are ready to receive payouts)
- **Analytics overview:**
  - Total projects posted
  - Total bids submitted
  - Active users (customers + bidders + estimators)
  - Projects by status breakdown
  - Geographic distribution (for nationwide growth tracking)
- **Audit Log** of admin-affecting actions
- No pre-approval required for project posting (instant publish)

---

## Project Status Lifecycle

```
┌──────────┐     ┌────────────────────┐     ┌──────────┐     ┌────────────┐     ┌──────────┐
│   Open   │ ──► │  X Bids Received   │ ──► │ Awarded  │ ──► │ Completed  │ ──► │  Closed  │
└──────────┘     └────────────────────┘     └──────────┘     └────────────┘     └──────────┘
      │                                            │                                  ▲
      │                                            │                                  │
      └──────────── (Customer closes) ─────────────┴──────────────────────────────────┘
```

- **Open:** Project is live, accepting bids
- **X Bids Received:** Project has bids (X = count), still accepting more
- **Awarded:** Customer selected a winning bidder
- **Completed:** Customer has marked the project as fully finished (eligible for verified review)
- **Closed:** Project is no longer accepting bids (can be reached from any earlier state)

A customer can close a project at any point — they don't have to go through "Awarded" or "Completed" first.

> **Implementation note:** The status pill UI must handle all four user-visible states (`open`, `awarded`, `completed`, `closed`). A previous version of the pill used a 3-way ternary that silently mislabeled `completed` projects as `Closed`. Centralize the pill in a shared component to avoid this.

---

## Currently Shipped

These features are live in production today:

### Sealed-Bid Marketplace (Original MVP)

1. ✅ Customer project posting (with photos, videos, documents, expertise level, location, timeline, budget)
2. ✅ Bidder account creation (email/Google OAuth, phone + address required)
3. ✅ Bidder credential uploads (6 documents, qualification badge system, core credentials check)
4. ✅ Specialties + service areas for bidders, with auto-filtered Browse Projects
5. ✅ Sealed bid submission (form + document upload + structured line items)
6. ✅ Customer bid viewing with side-by-side comparison
7. ✅ In-platform messaging + per-project Q&A
8. ✅ Notification system (in-app + email)
9. ✅ Project edit tracking with date stamps + bidder notifications
10. ✅ Project lifecycle management (open, award, complete, close)

### Beyond MVP (Already Shipped)

11. ✅ **AI Scope Builder** — LLM-powered scope checklist generation for project posting
12. ✅ **Paid Estimate Pools** — Stripe-funded reward pools for serious bids, with claim/dispute flows
13. ✅ **Verified Reviews + Hearts** — post-project ratings with admin moderation
14. ✅ **Public Quick Quotes by Address** — drive-by-estimate marketplace
15. ✅ **Estimate Library + Estimator Role** — marketplace for reusable estimate packages
16. ✅ **Stripe Connect payouts** for bidders and estimators
17. ✅ **Saved Project Searches + Alerts** for bidders
18. ✅ **Find Contractors directory** for customers (browse by trade/badge/location, heart, message)
19. ✅ **Multi-role accounts** technically supported (Role Switcher in sidebar) — single role at signup is the default UX

---

## Future Phases (Still To Build)

### Near-Term Cleanup (from App Usability Audit)

- 🔧 **"Forgot Password" flow** on the login page (currently missing — users locked out have no recovery path)
- 🔧 **Admin password reset** — admin-only field/action to reset a user's password
- 🔧 **Centralized status pill** — fix the recurring `completed → Closed` mislabeling across multiple pages
- 🔧 **Customer dashboard "Total Bids Received"** — currently counts global bids; needs to scope to the customer's projects
- 🔧 **Terms of Service + Privacy Policy checkbox** on signup
- 🔧 **Better friendly labels** for paid estimate claim statuses (replace raw enum text like "payout_denied_refunded")
- 🔧 **In-app help chat** — automated explainer that answers "how do I do X?" questions (see chat-tool design notes in audit conversation)

### Phase 2 — Enhanced Platform

- **Dual-role accounts** promoted publicly (signup picker, profile UI)
- **SMS notifications** — text alerts for critical events
- **Advanced search & filtering** — AI-powered matching ("These 5 bidders are qualified for your job")
- **More AI Scope Builder tuning** — better prompts, more project types

### Phase 3 — Monetization & Growth

- **Premium bidder visibility** — paid upgrades for bidders who want more exposure
- **Boosted project listings** — customers pay to feature their project
- **Estimator subscriptions** — recurring fees for estimators with high publish volume

### Phase 4 — Full Platform

- **Contract templates + e-signatures** — built-in contract generation
- **Payment escrow / milestone tracking** — secure payments through the platform
- **Native mobile app** (React Native) — dedicated iOS/Android apps
- **Contractor verification APIs** — integrate with state license lookup databases
- **Background checks** — optional verified background check badges

---

## Database Architecture Overview

High-level table structure for the Supabase PostgreSQL database (this is a partial map — see migrations for the full schema):

### Core Tables (Sealed-Bid Marketplace)

- **users** — all users (customers, bidders, admin, estimators) with role field
- **user_roles** — explicit role grants (supports multi-role accounts)
- **profiles** — extended profile info (business name, phone, address, avatar, exact_address_map_image_url)
- **projects** — customer-posted projects with all fields (including `expertise_level`, `awarded_bid_id`, `awarded_bidder_id`)
- **project_files** — photos, videos, documents attached to a project
- **project_edits** — edit history log
- **project_questions** — per-project Q&A
- **bids** — sealed bid submissions linked to projects and bidders
- **bid_files** — supporting files per bid
- **bid_line_items** — structured per-bid line items
- **bidder_credentials** — uploaded license, bond, insurance, etc., with computed badge_level
- **bidder_specialties** — trades a bidder works in
- **bidder_service_areas** — cities/states a bidder covers
- **bidder_saved_project_searches** — saved Browse Projects filters with optional alerts
- **messages** — in-platform chat messages between users on projects
- **notifications** — notification records for all user events

### AI Scope Builder Tables

- **project_ai_estimates** — top-level AI estimate per project
- **project_ai_scope_items** — generated scope items (with customer inclusion choice)
- **project_ai_clarifications** — top-level clarifying questions
- **project_ai_item_clarifications** — per-scope-item clarifying questions
- **project_ai_analysis_runs** — log of AI runs (model name, etc.)

### Paid Estimates Tables

- **project_paid_estimate_pools** — funded reward pools (with Stripe session/intent IDs)
- **paid_estimate_claims** — claims by bidders with status (paid_reserved, payout_pending, paid_out, etc.)
- **paid_estimate_disputes** — customer-raised disputes against claims
- **bidder_payout_accounts** — Stripe Connect onboarding state per bidder

### Reviews + Hearts Tables

- **user_reviews** — verified platform reviews (and other types)
- **profile_hearts** — public hearts left on a profile

### Quick Quotes Tables

- **property_addresses** — canonical address records (with lat/long)
- **property_address_claims** — customer claims on their own properties
- **address_quotes** — public quotes left at an address
- **address_quote_requests** — customer requests for quotes at a claimed address
- **address_quote_request_responses** — bidder responses to a request

### Estimate Library Tables

- **estimate_packages** — published reusable estimate packages
- **estimate_package_purchases** — buyer records
- **estimate_requests** — one-off custom estimate requests
- (estimator payouts share the bidder payout infrastructure)

### Moderation + Admin Tables

- **flagged_content** — reported/flagged items for admin review
- **audit_log** — admin-affecting actions (where applicable)

### Row-Level Security (RLS)

Supabase RLS policies enforce:

- Bidders can only see their **own** bids (never competing bids)
- Customers can see **all bids** on their own projects
- Admin can see **everything**
- Document uploads are private to the bidder (but profile badge status is public)
- Messages are only visible to the two participants
- Paid estimate funding/payout records are admin-only or self-only as appropriate

---

## Security & Privacy

- **File storage:** All uploaded documents stored in Supabase private buckets with signed URLs
- **Row-Level Security:** Enforced at the database level — no API bypass possible
- **Authentication:** Supabase Auth with JWT tokens, Google OAuth integration
- **Data isolation:** Bidders cannot access other bidders' data, bids, or documents
- **Admin access:** Full platform visibility for moderation and support
- **Payments:** All Stripe interactions go through server-side actions (no card data ever touches our servers); customer funding flows through Stripe Checkout, payouts through Stripe Connect
- **HTTPS everywhere:** Vercel provides automatic SSL
- **Environment variables:** All secrets (Supabase keys, Stripe keys, OAuth credentials) stored securely in Vercel environment config

---

## Document History

This vision doc was rewritten on **May 4, 2026** to match what is actually shipped in production. Prior versions described a much smaller MVP (sealed bids only) and listed many of the now-shipped features (AI Scope Builder, Paid Estimates, Quick Quotes, Estimate Library, Reviews, Stripe payouts, multi-role accounts) as Phase 2–4 work. The product grew faster than the doc, and the audit conversation that triggered this rewrite found dozens of places where the UI had drifted from the doc's promises. **Treat this version as the new source of truth.** Update it whenever the product expands further.

---

## Summary

**ProjectXBidX.com** is a clean, practical, construction-focused **sealed-bid marketplace**, plus a layered set of focused tools — AI Scope Builder, Paid Estimates, Quick Quotes by Address, Estimate Library, Verified Reviews — that make pricing and verification dramatically easier for both customers and contractors. The qualification badge system provides visual trust signals without creating barriers. Sealed bids keep competition fair. In-platform messaging and Q&A keep communication professional and logged.

Starting in Crescent City, California with a nationwide-ready database, this platform is built to grow — from a local construction tool to a national bidding marketplace.

**Let's build something contractors will actually want to use every day.** 🏗️
