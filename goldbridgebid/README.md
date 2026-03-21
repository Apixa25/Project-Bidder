# 🏗️ GoldBridgeBid.com

> **Where qualified contractors compete for your project.**

A construction bidding marketplace connecting customers who have projects with verified contractors who want to bid on them. Sealed bids, qualification badges, in-platform messaging, and full project tracking — all in one place.

## Tech Stack

- **Frontend:** [Next.js](https://nextjs.org/) (React, TypeScript, Tailwind CSS)
- **Backend/Database:** [Supabase](https://supabase.com/) (PostgreSQL, Auth, Storage, Realtime)
- **Hosting:** [Vercel](https://vercel.com/)
- **Icons:** [Lucide React](https://lucide.dev/)

## Getting Started

### Prerequisites

- Node.js 20+ and npm
- A [Supabase](https://supabase.com/) project (free tier works)

### Setup

1. **Clone the repository:**

   ```bash
   git clone <your-repo-url>
   cd goldbridgebid
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Set up environment variables:**

   ```bash
   cp .env.local.example .env.local
   ```

   Then edit `.env.local` with your Supabase project URL and anon key from the [Supabase Dashboard](https://supabase.com/dashboard).

4. **Run the database migration:**

   Copy the contents of `supabase/migrations/001_initial_schema.sql` and run it in your Supabase SQL Editor.

5. **Start the development server:**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) to see the app.

## Project Structure

```
goldbridgebid/
├── public/                   # Static assets
├── src/
│   ├── app/                  # Next.js App Router pages
│   │   ├── (auth)/           # Login & Signup pages
│   │   ├── (dashboard)/      # Customer, Bidder, Admin dashboards
│   │   ├── globals.css       # Tailwind + custom theme
│   │   ├── layout.tsx        # Root layout
│   │   └── page.tsx          # Landing page
│   ├── components/           # Reusable UI components
│   │   ├── layout/           # Navigation, footer, etc.
│   │   └── ui/               # Buttons, badges, cards, etc.
│   ├── lib/                  # Utility functions & configs
│   │   ├── supabase/         # Supabase client (browser, server, middleware)
│   │   └── badges.ts         # Qualification badge logic
│   ├── types/                # TypeScript type definitions
│   │   └── database.ts       # Database types & interfaces
│   └── middleware.ts          # Auth middleware
├── supabase/
│   └── migrations/           # SQL migration files
├── project-vision.md         # Complete project vision & specs
├── .env.local.example        # Environment variables template
└── package.json
```

## Key Features

- **Project Posting** — Customers post projects with descriptions, file uploads, trade categories, and mandatory completion criteria
- **Sealed Bidding** — Contractors submit bids visible only to the project owner and admin
- **Qualification Badges** — 🥇 Gold / 🥈 Silver / 🥉 Bronze based on uploaded credentials
- **Multi-Trade Support** — Projects can require multiple trades; bidders select their specialty
- **Edit Tracking** — Project edits are highlighted with timestamps protecting existing bidders
- **In-Platform Messaging** — Direct chat between customers and bidders per project
- **Notifications** — Real-time alerts for bids, awards, edits, and messages
- **Admin Dashboard** — Full platform oversight with analytics

## Documentation

See [project-vision.md](../project-vision.md) for the complete project specification including:
- Feature requirements
- Database architecture
- User flows
- MVP scope & future phases
- Security & privacy details

## License

Private — All rights reserved.
