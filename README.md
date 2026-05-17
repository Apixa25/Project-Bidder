<p align="center">
  <img src="goldbridgebid/public/wordmark.png" alt="ProjectXBidX" width="320" />
</p>

<h3 align="center">Where qualified contractors compete for your project.</h3>

<p align="center">
  <a href="https://projectxbidx.com">🌐 Live Site</a> &nbsp;·&nbsp;
  <a href="#features">✨ Features</a> &nbsp;·&nbsp;
  <a href="#tech-stack">🛠️ Tech Stack</a> &nbsp;·&nbsp;
  <a href="#getting-started">🚀 Getting Started</a> &nbsp;·&nbsp;
  <a href="#architecture">📐 Architecture</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" alt="Next.js 16" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react" alt="React 19" />
  <img src="https://img.shields.io/badge/Supabase-PostgreSQL-3FCF8E?logo=supabase" alt="Supabase" />
  <img src="https://img.shields.io/badge/Stripe-Connect-635BFF?logo=stripe" alt="Stripe" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Deployed_on-Vercel-000?logo=vercel" alt="Vercel" />
</p>

---

## 📖 What is ProjectXBidX?

**ProjectXBidX.com** is a full-stack **sealed-bid marketplace for the construction industry**. It connects customers who have projects with qualified contractors who want to bid on them — fairly, transparently, and without the usual runaround.

Customers post projects with rich descriptions, photos, videos, and documents. Contractors browse jobs that match their specialties and service areas, then submit **sealed bids** that only the project owner can see. No bidding wars, no undercutting — just honest competition on price, qualifications, and reputation.

> **Launch market:** Crescent City, California · **Database scope:** Designed for nationwide scale from day one

---

## ✨ Features

### 🏗️ Core Sealed-Bid Marketplace

| For Customers | For Contractors |
|---|---|
| Post projects with photos, videos, plans, and documents | Create a profile with business info and credentials |
| Choose expertise level (Licensed Contractor / Handyman / General Labor) | Earn qualification badges (🥇 Gold · 🥈 Silver · 🥉 Bronze) |
| Review all sealed bids with side-by-side comparison | Browse projects filtered by your specialties & service areas |
| Award jobs and leave verified reviews | Submit sealed bids with pricing, timeline, and supporting docs |
| In-platform messaging and per-project Q&A | Save searches and get alerts for matching new projects |

### 🤖 AI Scope Builder

Customers describe their project and the AI generates a structured **scope checklist** of work items — so bids are apples-to-apples. Customers can include, skip, or add custom items. The AI also asks clarifying questions to refine scope before publishing.

### 💰 Paid Estimate Pools

Customers can fund a reward pool (via Stripe) to attract more serious bids. Qualified contractors who submit a real bid claim a paid slot and receive a payout through Stripe Connect.

### 📍 Quick Quotes by Address

A public marketplace for short-form quotes tied to real-world addresses. Contractors leave drive-by estimates (fence repair, lawn care, exterior paint), and property owners can claim addresses and request quotes.

### 📦 Estimate Library & Estimator Role

Professional estimators publish reusable **Estimate Packages** (takeoffs, scope checklists, pricing references) that customers and contractors can browse and purchase.

### ⭐ Verified Reviews & Hearts

After a project is awarded and completed, both sides leave verified reviews. A lightweight "heart" system lets users bookmark profiles. Review averages appear on profiles and in bid comparisons.

### 🔔 Real-Time Notifications

In-app and email notifications for new bids, messages, project edits, award announcements, paid estimate status changes, and matching project alerts.

### 🛡️ Admin Dashboard

Full platform visibility — all projects, bids, messages, users. Moderation queues for flagged content, reviews, and paid estimate disputes. Stripe readiness tracking, platform analytics, and audit log.

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | [Next.js 16](https://nextjs.org/) (React 19) | App Router, server components, API routes |
| **Database** | [Supabase](https://supabase.com/) (PostgreSQL) | Database, auth, storage, realtime subscriptions |
| **Hosting** | [Vercel](https://vercel.com/) | Edge network, serverless functions, auto-deploys |
| **Auth** | Supabase Auth | Email/password + Google OAuth |
| **Storage** | Supabase Storage | Private buckets for documents, photos, videos |
| **Payments** | [Stripe](https://stripe.com/) | Checkout for funding pools, Connect for contractor payouts |
| **Styling** | [Tailwind CSS 4](https://tailwindcss.com/) | Utility-first CSS |
| **Rich Text** | [Tiptap](https://tiptap.dev/) | Rich text editor for bids and descriptions |
| **Maps** | [MapLibre GL](https://maplibre.org/) | Address lookup and project location previews |
| **AI** | [OpenAI API](https://openai.com/) | Powers the AI Scope Builder |
| **Email** | [Resend](https://resend.com/) | Transactional email notifications |
| **Charts** | [Recharts](https://recharts.org/) | Admin analytics dashboards |
| **Validation** | [Zod](https://zod.dev/) | Runtime schema validation |

---

## 📐 Architecture

```
Project-Bidder/
├── goldbridgebid/                # Next.js application (legacy folder name)
│   ├── src/
│   │   ├── app/                  # App Router pages & API routes
│   │   │   ├── (auth)/           # Auth-protected route group
│   │   │   ├── (dashboard)/      # Dashboard pages (customer, bidder, estimator, admin)
│   │   │   ├── address-quotes/   # Public Quick Quotes marketplace
│   │   │   ├── api/              # Server-side API routes (Stripe webhooks, crons, AI)
│   │   │   ├── how-it-works/     # Public informational pages
│   │   │   ├── login/            # Login page
│   │   │   ├── signup/           # Signup page (supports ?role=estimator)
│   │   │   └── ...
│   │   ├── components/           # Reusable React components
│   │   ├── lib/                  # Shared utilities, Supabase client, Stripe helpers
│   │   └── types/                # TypeScript type definitions
│   ├── supabase/
│   │   └── migrations/           # Database migration files
│   ├── public/                   # Static assets (logos, icons, service worker)
│   └── package.json
├── project-vision.md             # Product vision & feature specs (source of truth)
├── DESIGN_PRINCIPLES.md          # Design & honesty principles
└── README.md                     # You are here
```

### Database Security

All data access is protected by **Supabase Row-Level Security (RLS)**:

- Bidders can only see their **own** bids — never competing bids
- Customers see **all bids** on their own projects
- Messages are private between the two participants
- Document uploads are private to the uploader
- Admin has full platform visibility for moderation

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ and **npm**
- A [Supabase](https://supabase.com/) project (free tier works)
- A [Stripe](https://stripe.com/) account (test mode)
- *(Optional)* An [OpenAI](https://openai.com/) API key for the AI Scope Builder

### 1. Clone the repository

```bash
git clone https://github.com/Apixa25/Project-Bidder.git
cd Project-Bidder/goldbridgebid
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

```bash
cp .env.local.example .env.local
```

Fill in your keys in `.env.local`:

| Variable | Source |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Settings → API |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe Dashboard → API Keys |
| `STRIPE_SECRET_KEY` | Stripe Dashboard → API Keys |
| `STRIPE_WEBHOOK_SECRET` | Stripe Dashboard → Webhooks |
| `CRON_SECRET` | Any random string for cron route auth |

### 4. Run the database migrations

Apply the Supabase migrations to set up your database schema:

```bash
npx supabase db push
```

### 5. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 👥 User Roles

| Role | Description | Signup |
|---|---|---|
| **Customer** | Posts projects, reviews bids, awards jobs | Public signup |
| **Bidder** | Browses projects, submits sealed bids, earns badges | Public signup |
| **Estimator** | Publishes estimate packages, fulfills estimate requests | `/signup?role=estimator` (direct link) |
| **Admin** | Full platform access, moderation, analytics | Assigned manually |

The platform supports **multi-role accounts** — a single user can hold multiple roles and switch between them via the dashboard sidebar.

---

## 🏆 Qualification Badge System

Contractors earn trust badges by uploading credentials:

| Badge | Requirement |
|---|---|
| 🥇 **Gold Star** | All 6 documents uploaded (license, bond, insurance, workers' comp, EIN, references) |
| 🥈 **Silver Star** | 4–5 documents uploaded |
| 🥉 **Bronze Star** | 1–3 documents uploaded |

Uploading the **core trio** (license + bond + insurance) earns an additional "Core Credentials ✅" indicator. No documents are *required* to bid — the badge system incentivizes transparency without creating barriers.

---

## 🔄 Project Lifecycle

```
Open  →  Bids Received  →  Awarded  →  Completed  →  Closed
  │                            │                         ▲
  └──── (Customer closes) ─────┴─────────────────────────┘
```

Customers can close a project at any point. Edit history is fully tracked — every bid carries a timestamp so it's always clear whether a bid was placed before or after a scope change.

---

## 🎨 Design Philosophy

- **Professional & trustworthy** — both contractors and homeowners feel confident
- **Clean and uncluttered** — easy to scan bids, projects, and profiles
- **Mobile-responsive** — works on phones (contractors are on-site) and desktops (document uploads, bid reviews)
- **Construction-appropriate** — warm, earthy tones (orange, forest green, earth brown) — not corporate sterile
- **Honest by default** — *"False confidence is much worse than no confidence."* The system never fabricates pricing or presents algorithm defaults as AI insight

---

## 📄 License

This project is proprietary. All rights reserved.

---

## 🔗 Links

- **Live Site:** [projectxbidx.com](https://projectxbidx.com)
- **Product Vision:** [project-vision.md](project-vision.md)
- **Design Principles:** [DESIGN_PRINCIPLES.md](DESIGN_PRINCIPLES.md)

---

<p align="center">
  Built with ☕ and 🏗️ — starting in Crescent City, CA · scaling nationwide
</p>
