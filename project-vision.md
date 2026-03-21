# 🏗️ GoldBridgeBid.com — Project Vision

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
   - [Bidder Onboarding & Profiles](#bidder-onboarding--profiles)
   - [Bid Submission](#bid-submission-bidder-side)
   - [Bid Visibility & Award Flow](#bid-visibility--award-flow)
   - [Edit Tracking & Date Stamps](#edit-tracking--date-stamps)
   - [Messaging System](#messaging-system)
   - [Notification System](#notification-system)
   - [Dashboards](#dashboards)
   - [Admin Dashboard](#admin-dashboard)
7. [Project Status Lifecycle](#project-status-lifecycle)
8. [MVP Scope (Phase 1)](#mvp-scope-phase-1)
9. [Future Phases](#future-phases-post-mvp)
10. [Database Architecture Overview](#database-architecture-overview)
11. [Security & Privacy](#security--privacy)

---

## Overview

**GoldBridgeBid.com** is a construction bidding marketplace that connects **customers** who have projects with **qualified contractors** who want to bid on them. Customers post projects with detailed descriptions, documents, photos, and videos. Pre-qualified bidders browse available projects and submit sealed bids. The platform provides clear tracking, visual qualification badges, in-platform messaging, and a streamlined experience for both sides.

- **Industry:** All types of construction
- **Launch Market:** Crescent City, California
- **Database Scope:** Designed for nationwide scale from day one
- **Initial Expected Scale:** ~100 customers, ~500 bidders

---

## Core Concept

This is a **sealed-bid marketplace** for construction projects:

1. **Customers** post projects with rich details (descriptions, uploads, categories, completion criteria)
2. **Bidders** create accounts, optionally upload credentials (license, bond, insurance, etc.), and earn visual qualification badges
3. Bidders browse projects and **submit sealed bids** — only the customer and admin can see bid details
4. Customers review all bids with full bidder profiles, qualification badges, and contact info
5. Customers award jobs and coordinate with winning bidders directly (email/phone)
6. All communication, bidding, and tracking happens within the platform

**Key differentiator:** Projects can involve **multiple trades** (e.g., a kitchen remodel needing plumbing, electrical, and tile). Bidders **self-select which trade** they're bidding on within their bid form. This allows specialized contractors to bid on just their portion of a larger project.

---

## User Types & Roles

### Customer (Project Owner)
- Posts projects with detailed descriptions, uploads, and completion criteria
- Reviews sealed bids from all bidders
- Awards jobs (optional formal award with notifications, or quiet close)
- Communicates with bidders through in-platform messaging
- Manages projects through a personal dashboard

### Bidder (Contractor)
- Creates an account with business info
- Uploads optional credentials (license, bond, insurance, workers' comp, EIN, references)
- Earns qualification badges based on uploaded documents
- Browses projects by trade/category and location
- Submits sealed bids with pricing, timeline, and supporting documents
- Communicates with customers through in-platform messaging
- Tracks all submitted bids through a personal dashboard

### Admin (Platform Owner)
- Full visibility into all projects and all bids across the platform
- User management (ban/remove bad actors)
- Flagged/reported content moderation
- Platform analytics (total projects, bids, active users, etc.)
- No pre-approval required for project posting (instant publish)

### Future: Dual-Role Accounts
- In a future phase, a single user will be able to act as both a customer AND a bidder
- Initially, accounts are single-role: you pick "Customer" or "Bidder" at signup

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Next.js (React) | Mobile-responsive web application |
| **Backend/Database** | Supabase (PostgreSQL) | Database, authentication, storage, realtime |
| **Hosting** | Vercel | Frontend hosting, serverless functions, edge network |
| **Authentication** | Supabase Auth | Email/password + Google OAuth |
| **File Storage** | Supabase Storage | Private buckets for documents, photos, videos, bid files |
| **Realtime** | Supabase Realtime | Live chat, bid notifications, project update alerts |
| **Styling** | Tailwind CSS | Utility-first CSS for rapid, consistent UI development |

### Why This Stack?
- **Supabase** provides PostgreSQL with row-level security (bidders can't see other bids), built-in auth, file storage with private URLs, and realtime subscriptions — all in one platform
- **Next.js on Vercel** gives us server-side rendering, API routes, image optimization, and blazing-fast deployments
- **Cost at launch scale** (~600 users): effectively free tier or very low cost
- **Scalability:** Both Supabase and Vercel scale automatically as the platform grows nationwide

---

## Design & Branding

### Name & Domain
- **Platform Name:** GoldBridgeBid.com
- **Working Tagline:** "Where qualified contractors compete for your project."

### Color Palette
Warm, earthy, construction-appropriate tones inspired by [duda.com](https://www.duda.com/):

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

---

## Feature Specifications

### Project Posting (Customer Side)

#### Required Fields
| Field | Description |
|-------|-------------|
| **Title** | Short, descriptive project name |
| **Description** | Detailed project description with full scope of work |
| **Category/Trade(s)** | Multi-select from fixed trade list (see below) |
| **Location** | Address or general area |
| **Timeline / Desired Start Date** | When the customer wants work to begin |
| **Completion Criteria** | **MANDATORY** — What "done" means for this project. Clear, specific definition of project completion |

#### Optional Fields
| Field | Description |
|-------|-------------|
| **Budget Range** | Estimated budget (helps bidders decide if it's worth bidding) |
| **File Uploads** | Photos, documents (PDFs, plans), videos of the project site/scope |

#### Trade Categories (Fixed List)
- Electrical
- Plumbing
- Roofing
- HVAC
- Concrete
- Framing
- Drywall
- Painting
- Tile
- Landscape
- General Work

A project can be tagged with **multiple trades**. Bidders self-select which trade they're bidding on when submitting their bid.

#### Project Editing Rules
- Customers **can edit** their projects after posting
- All edits are **highlighted in a visually distinct color** (e.g., amber/yellow background) so bidders are clearly warned that changes were made
- All existing bids carry **date stamps** — it is always clear whether a bid was submitted before or after an edit
- Bidders who have already bid on the project **receive a notification** when edits are made

#### Project Closing
- Customers can **close** a project at any time to stop receiving new bids

---

### Bidder Onboarding & Profiles

#### Account Creation
- Email + password (required)
- Google OAuth (optional sign-in method)
- Phone number (required)
- Address (required)
- Business name and basic info

#### Credential Uploads (All Optional)
| Document | Description |
|----------|-------------|
| **Contractor License** | Copy of their trade license |
| **Bond** | Surety bond documentation |
| **Insurance** | General liability insurance certificate |
| **Workers' Compensation** | Workers' comp certificate |
| **EIN** | Employer Identification Number documentation |
| **References** | Professional references (text or uploaded documents) |

**None of these are required to bid.** Many great contractors won't fill everything out initially, and we don't want to create barriers to entry. However, uploading more documents earns a higher qualification badge.

#### Qualification Badge System
Visual badges displayed on every bidder profile and every bid submission:

| Badge | Criteria | Visual |
|-------|----------|--------|
| 🥇 **Gold Star** | All 6 documents uploaded | Gold star icon |
| 🥈 **Silver Star** | 4–5 documents uploaded | Silver star icon |
| 🥉 **Bronze Star** | 1–3 documents uploaded | Bronze star icon |
| *(No badge)* | 0 documents uploaded | No badge shown |

Additionally, each individual document shows a **green checkmark** (✅) if present or a **gray placeholder** if not, allowing customers to see at a glance exactly which credentials a bidder has.

---

### Bid Submission (Bidder Side)

#### Two Submission Methods

**Method 1: Form Entry**
Bidders fill out a structured form with all bid details — they can cut and paste their information directly into the form fields.

**Method 2: Document Upload**
Bidders scan and upload their own bid documents (PDFs, images, etc.) — for contractors who already have proposals in their own format.

Both methods can be used together (fill out the form AND attach documents).

#### Bid Form Fields
| Field | Required? | Description |
|-------|-----------|-------------|
| **Trade Selection** | Yes | Which trade(s) they're bidding on from the project's listed categories |
| **Price** | Yes | Lump sum bid amount. Breakdown (labor, materials, etc.) is optional but encouraged |
| **Estimated Timeline** | Yes | How long the work will take |
| **Estimated Start Date** | Yes | When they can begin work |
| **Notes / Message** | Optional | Free-text message to the customer |
| **File Uploads** | Optional | Supporting documents, proposals, photos, plans, etc. |

#### Bid Integrity
- Every bid has a **date/time stamp** showing exactly when it was submitted
- This timestamp is critical for protecting bidders when projects are edited after they've already bid
- Bids cannot be edited by the customer — only the bidder who submitted it

---

### Bid Visibility & Award Flow

#### Sealed Bids
- Bids are **sealed** — only the **customer** (project owner) and the **admin** can see bid details
- Bidders **never** see competing bids (no bid amounts, no competing bidder info)
- Customers see **all bids** with:
  - Full bidder profile (name, company, contact info)
  - Qualification badge (Gold/Silver/Bronze)
  - Individual document checkmarks
  - Bid price, timeline, start date, notes
  - All uploaded bid documents

#### Awarding a Project
- **Optional "Award" button** — When a customer selects a winning bidder, they can press "Award" which:
  - Marks the project as "Awarded"
  - Sends a **courtesy notification** to all non-selected bidders that the project has been awarded (without revealing who won)
- **Quiet Close** — Alternatively, the customer can simply close the project without notifying anyone
- The award/close decision is entirely up to the customer — neither is mandatory

#### Post-Award
- The customer already has the winning bidder's **email and phone number** from the bid
- All coordination happens **offline** (phone, email, in-person)
- No built-in contracts, escrow, or payment processing at this stage

---

### Edit Tracking & Date Stamps

This system protects bidders from scope creep and ensures transparency:

1. **All project edits** are visually highlighted in a **distinct color** (e.g., amber background)
2. **Every bid** carries a permanent **date/time stamp** showing when it was submitted
3. **Edit history** is preserved — customers and bidders can see what changed and when
4. **Bidders who already bid** receive a **notification** when the project is updated, prompting them to review changes
5. This makes it crystal clear whether a bid was placed **before or after** any scope changes

---

### Messaging System

In-platform messaging for direct communication between customers and bidders.

#### How It Works
- Every project has messaging capability
- **Customers** can message any bidder who has submitted a bid on their project
- **Bidders** can message the customer of a project they've bid on
- Messages support **text** and **file sharing** (additional photos, revised proposals, clarifying documents)
- **Real-time** delivery via Supabase Realtime
- Conversation history is preserved and accessible from both dashboards

#### Modeled After
- **Upwork's** clean per-project messaging rooms (structured, logged, professional)
- **Angi's** simplicity (mobile-friendly, fast, construction-appropriate)

---

### Notification System

Users receive notifications for key platform events:

#### Customer Notifications
- New bid received on their project
- New message from a bidder
- (Future: bid incentive milestones)

#### Bidder Notifications
- Project they bid on was **edited** (with prompt to review changes)
- Project they bid on was **awarded** (courtesy notification if customer chooses to send)
- Project they bid on was **closed**
- New message from a customer
- (Future: new projects matching their trade posted)

#### Delivery
- **In-app notifications** (notification bell/badge in the dashboard)
- **Email notifications** (for critical events like bids received, project edits)
- (Future: SMS notifications)

---

### Dashboards

#### Customer Dashboard — "My Projects"
- List of all posted projects
- **Status pill** per project: `Open` / `X Bids Received` / `Awarded` / `Closed`
- Quick "View Bids" button per project
- Bid count displayed prominently
- Easy access to project editing and closing
- Message inbox / notification center

#### Bidder Dashboard — "My Bids"
- List of all projects they've bid on
- Status of each bid (project still open, awarded, closed)
- Trade they bid on per project
- Quick access to their profile and credential uploads
- Message inbox / notification center

#### Admin Dashboard
- **All projects** across the entire platform with search/filter
- **All bids** on any project (full visibility)
- **User management** — view all users, ban/remove bad actors
- **Flagged/reported content** moderation queue
- **Analytics overview:**
  - Total projects posted
  - Total bids submitted
  - Active users (customers + bidders)
  - Projects by status breakdown
  - Projects by trade/category
  - Geographic distribution (for nationwide growth tracking)

---

## Project Status Lifecycle

```
┌──────────┐     ┌────────────────────┐     ┌──────────┐     ┌──────────┐
│   Open   │ ──► │  X Bids Received   │ ──► │ Awarded  │ ──► │  Closed  │
└──────────┘     └────────────────────┘     └──────────┘     └──────────┘
      │                                            │
      │                                            │
      └──────────── (Customer closes) ─────────────┘
                         directly
```

- **Open:** Project is live, accepting bids
- **X Bids Received:** Project has bids (X = count), still accepting more
- **Awarded:** Customer selected a winning bidder (optional step)
- **Closed:** Project is no longer accepting bids

A customer can close a project at any point — they don't have to go through "Awarded" first.

---

## MVP Scope (Phase 1)

All of the following are included in the **initial launch**:

### Core Features
1. ✅ **Customer project posting** — full form with all fields, file uploads, multi-trade tagging
2. ✅ **Bidder account creation** — signup with email/Google, phone + address required
3. ✅ **Bidder credential uploads** — all 6 document types with qualification badge system
4. ✅ **Sealed bid submission** — form entry + document upload methods, trade self-selection
5. ✅ **Customer bid viewing** — all bids visible with full bidder profiles, badges, and contact info
6. ✅ **In-platform messaging** — per-project chat between customers and bidders
7. ✅ **Admin dashboard** — all projects, all bids, user management, flags, analytics
8. ✅ **Notification system** — in-app + email for bids, awards, edits, messages
9. ✅ **Edit tracking** — highlighted changes, date stamps, bidder notifications on edits
10. ✅ **Project lifecycle management** — open, close, award with optional bidder notifications

### Authentication (MVP)
- Email/password signup
- Google OAuth
- Phone number required
- Address required
- Single role per account: Customer **or** Bidder

---

## Future Phases (Post-MVP)

### Phase 2 — Enhanced Platform
- **Dual-role accounts** — a user can be both a customer and a bidder
- **SMS notifications** — text alerts for critical events
- **Advanced search & filtering** — AI-powered matching ("These 5 bidders are qualified for your electrical job")
- **Reviews & ratings** — post-completion feedback system

### Phase 3 — Monetization & Growth
- **Paid estimate incentives** — customers can offer money (e.g., $100) to the first X qualified bidders who bid their project
- **Premium bidder visibility** — paid upgrades for bidders who want more exposure
- **Boosted project listings** — customers pay to feature their project

### Phase 4 — Full Platform
- **Contract templates + e-signatures** — built-in contract generation
- **Payment escrow / milestone tracking** — secure payments through the platform
- **Native mobile app** (React Native) — dedicated iOS/Android apps
- **Contractor verification APIs** — integrate with state license lookup databases
- **Background checks** — optional verified background check badges

---

## Database Architecture Overview

High-level table structure for the Supabase PostgreSQL database:

### Core Tables
- **users** — all users (customers, bidders, admin) with role field
- **profiles** — extended profile info (business name, phone, address, bio)
- **projects** — customer-posted projects with all fields
- **project_trades** — junction table linking projects to their required trades
- **trades** — fixed list of trade categories
- **bids** — sealed bid submissions linked to projects and bidders
- **documents** — bidder credential uploads (license, bond, insurance, etc.)
- **messages** — in-platform chat messages between users on projects
- **notifications** — notification records for all user events
- **project_edits** — edit history log for tracking project changes
- **flagged_content** — reported/flagged items for admin review

### Key Relationships
- A **user** has one **profile** and one **role** (customer or bidder)
- A **project** belongs to one **customer** and can have multiple **trades**
- A **bid** belongs to one **bidder** and one **project**, and specifies a **trade**
- A **bidder** can have multiple **documents** (credentials)
- **Messages** are between two users within the context of a project
- **Notifications** are per-user, triggered by platform events

### Row-Level Security (RLS)
Supabase RLS policies will enforce:
- Bidders can only see their **own** bids (never competing bids)
- Customers can see **all bids** on their own projects
- Admin can see **everything**
- Document uploads are private to the bidder (but profile badge status is public)
- Messages are only visible to the two participants

---

## Security & Privacy

- **File storage:** All uploaded documents stored in Supabase private buckets with signed URLs
- **Row-Level Security:** Enforced at the database level — no API bypass possible
- **Authentication:** Supabase Auth with JWT tokens, Google OAuth integration
- **Data isolation:** Bidders cannot access other bidders' data, bids, or documents
- **Admin access:** Full platform visibility for moderation and support
- **HTTPS everywhere:** Vercel provides automatic SSL
- **Environment variables:** All secrets (Supabase keys, OAuth credentials) stored securely in Vercel environment config

---

## Summary

**GoldBridgeBid.com** is a clean, practical, construction-focused sealed-bid marketplace. It solves a real problem: connecting project owners with qualified contractors through a transparent, trackable, professional platform. The qualification badge system provides visual trust signals without creating barriers. Sealed bids keep competition fair. In-platform messaging keeps communication professional and logged.

Starting in Crescent City, California with a nationwide-ready database, this platform is built to grow — from a local construction tool to a national bidding marketplace.

**Let's build something contractors will actually want to use every day.** 🏗️
