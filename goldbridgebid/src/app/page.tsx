import Link from "next/link";
import {
  HardHat,
  FileText,
  Shield,
  MessageSquare,
  ClipboardCheck,
  Star,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

const FEATURES = [
  {
    icon: FileText,
    title: "Post Your Project",
    description:
      "Describe your construction project with photos, documents, and videos. Set clear completion criteria so every bidder knows exactly what 'done' means.",
  },
  {
    icon: Shield,
    title: "Verified Contractors",
    description:
      "Bidders upload their license, bond, insurance, workers' comp, EIN, and references. Gold, Silver, and Bronze badges let you screen at a glance.",
  },
  {
    icon: ClipboardCheck,
    title: "Sealed Bids",
    description:
      "Receive competitive sealed bids directly. Only you see the details — bidders never see competing offers. Fair, transparent, and confidential.",
  },
  {
    icon: Star,
    title: "Multi-Trade Support",
    description:
      "Big project needing plumbing AND electrical? Contractors bid on just their trade. You pick the best for each — all in one place.",
  },
  {
    icon: MessageSquare,
    title: "Built-In Messaging",
    description:
      "Ask questions, share extra documents, and communicate directly with bidders — all logged and organized inside the platform.",
  },
  {
    icon: HardHat,
    title: "Track Everything",
    description:
      "See bid counts, project status, and every edit — with date stamps that protect you and your bidders from scope changes.",
  },
];

const TRADES = [
  "Electrical",
  "Plumbing",
  "Roofing",
  "HVAC",
  "Concrete",
  "Framing",
  "Drywall",
  "Painting",
  "Tile",
  "Landscape",
  "General Work",
];

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Navigation */}
      <header className="sticky top-0 z-50 border-b border-border bg-surface/95 backdrop-blur-sm">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <HardHat className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold text-text-primary">
              Gold<span className="text-primary">Bridge</span>Bid
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
            >
              Log In
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-dark transition-colors"
            >
              Get Started
            </Link>
          </div>
        </nav>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-gradient-to-br from-accent via-accent-light to-primary-dark py-24 sm:py-32">
          <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
          <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl">
                Where Qualified Contractors{" "}
                <span className="text-primary-light">Compete</span> for Your
                Project
              </h1>
              <p className="mt-6 text-lg leading-8 text-amber-100/90">
                Post your construction project. Receive sealed bids from
                verified contractors. Pick the best — all in one place. Serving
                Crescent City, CA and growing nationwide.
              </p>
              <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Link
                  href="/signup?role=customer"
                  className="flex items-center gap-2 rounded-lg bg-primary px-8 py-3.5 text-base font-semibold text-white shadow-lg hover:bg-primary-light transition-colors"
                >
                  Post a Project
                  <ArrowRight className="h-5 w-5" />
                </Link>
                <Link
                  href="/signup?role=bidder"
                  className="flex items-center gap-2 rounded-lg border-2 border-white/30 bg-white/10 px-8 py-3.5 text-base font-semibold text-white shadow-lg hover:bg-white/20 transition-colors backdrop-blur-sm"
                >
                  Join as a Contractor
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-20 sm:py-28 bg-surface">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
                How It Works
              </h2>
              <p className="mt-4 text-lg text-text-secondary">
                Three simple steps to get competitive bids on your project.
              </p>
            </div>
            <div className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-8 sm:grid-cols-3">
              {[
                {
                  step: "1",
                  title: "Post Your Project",
                  desc: "Describe the work, upload plans and photos, set your completion criteria, and choose which trades you need.",
                },
                {
                  step: "2",
                  title: "Receive Sealed Bids",
                  desc: "Qualified contractors submit competitive bids with pricing, timelines, and their credentials — visible only to you.",
                },
                {
                  step: "3",
                  title: "Pick Your Contractor",
                  desc: "Compare bids side by side, check qualification badges, message bidders with questions, and award the job.",
                },
              ].map((item) => (
                <div key={item.step} className="text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary text-2xl font-bold text-white shadow-md">
                    {item.step}
                  </div>
                  <h3 className="mt-6 text-lg font-semibold text-text-primary">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-text-secondary leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="py-20 sm:py-28 bg-bg-warm">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
                Built for Construction Professionals
              </h2>
              <p className="mt-4 text-lg text-text-secondary">
                Every feature designed to make bidding fair, fast, and
                transparent.
              </p>
            </div>
            <div className="mx-auto mt-16 grid max-w-6xl grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((feature) => (
                <div
                  key={feature.title}
                  className="rounded-xl border border-border bg-surface p-8 shadow-sm hover:shadow-md transition-shadow"
                >
                  <feature.icon className="h-8 w-8 text-primary" />
                  <h3 className="mt-4 text-lg font-semibold text-text-primary">
                    {feature.title}
                  </h3>
                  <p className="mt-3 text-text-secondary leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Badge System Showcase */}
        <section className="py-20 sm:py-28 bg-surface">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-4xl">
              <div className="text-center">
                <h2 className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
                  Qualification at a Glance
                </h2>
                <p className="mt-4 text-lg text-text-secondary">
                  Contractors earn badges based on uploaded credentials. Screen
                  bidders instantly — no guesswork.
                </p>
              </div>
              <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-3">
                {[
                  {
                    badge: "🥇",
                    level: "Gold",
                    criteria: "All 6 credentials uploaded",
                    color: "border-amber-400 bg-amber-50",
                  },
                  {
                    badge: "🥈",
                    level: "Silver",
                    criteria: "4–5 credentials uploaded",
                    color: "border-gray-400 bg-gray-50",
                  },
                  {
                    badge: "🥉",
                    level: "Bronze",
                    criteria: "1–3 credentials uploaded",
                    color: "border-orange-400 bg-orange-50",
                  },
                ].map((item) => (
                  <div
                    key={item.level}
                    className={`rounded-xl border-2 ${item.color} p-8 text-center shadow-sm`}
                  >
                    <span className="text-5xl">{item.badge}</span>
                    <h3 className="mt-4 text-xl font-bold text-text-primary">
                      {item.level} Verified
                    </h3>
                    <p className="mt-2 text-text-secondary">{item.criteria}</p>
                  </div>
                ))}
              </div>
              <div className="mt-10 rounded-xl border border-border bg-bg-warm p-6">
                <p className="text-center text-sm text-text-secondary">
                  <strong>Credentials tracked:</strong> Contractor License •
                  Bond • Insurance • Workers&apos; Comp • EIN • References
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                  {[
                    "License",
                    "Bond",
                    "Insurance",
                    "Workers' Comp",
                    "EIN",
                    "References",
                  ].map((cred) => (
                    <span
                      key={cred}
                      className="inline-flex items-center gap-1.5 rounded-full bg-secondary/10 px-3 py-1 text-sm font-medium text-secondary"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {cred}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Trades We Cover */}
        <section className="py-20 sm:py-28 bg-bg-warm">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
                All Construction Trades Welcome
              </h2>
              <p className="mt-4 text-lg text-text-secondary">
                From foundation to finish, every trade has a place on
                GoldBridgeBid.
              </p>
            </div>
            <div className="mx-auto mt-12 flex max-w-3xl flex-wrap items-center justify-center gap-3">
              {TRADES.map((trade) => (
                <span
                  key={trade}
                  className="rounded-full border border-border bg-surface px-5 py-2.5 text-sm font-medium text-text-primary shadow-sm"
                >
                  {trade}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="relative overflow-hidden bg-gradient-to-r from-primary-dark via-primary to-primary-light py-20">
          <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Ready to Get Started?
              </h2>
              <p className="mt-4 text-lg text-amber-100/90">
                Whether you&apos;re posting a project or looking for work,
                GoldBridgeBid makes it simple.
              </p>
              <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Link
                  href="/signup?role=customer"
                  className="rounded-lg bg-white px-8 py-3.5 text-base font-semibold text-primary-dark shadow-lg hover:bg-amber-50 transition-colors"
                >
                  I Have a Project
                </Link>
                <Link
                  href="/signup?role=bidder"
                  className="rounded-lg border-2 border-white/40 bg-white/10 px-8 py-3.5 text-base font-semibold text-white shadow-lg hover:bg-white/20 transition-colors backdrop-blur-sm"
                >
                  I&apos;m a Contractor
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-surface py-12">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <div className="flex items-center gap-2">
              <HardHat className="h-6 w-6 text-primary" />
              <span className="text-lg font-bold text-text-primary">
                Gold<span className="text-primary">Bridge</span>Bid
              </span>
            </div>
            <p className="text-sm text-text-muted">
              Serving Crescent City, CA — growing nationwide.
            </p>
            <p className="text-sm text-text-muted">
              &copy; {new Date().getFullYear()} GoldBridgeBid. All rights
              reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
