import Link from "next/link";
import { BrandWordmark } from "@/components/BrandWordmark";
import {
  ClipboardList,
  Send,
  ShieldCheck,
  Award,
  MessageSquare,
  Star,
  Sparkles,
  BadgeDollarSign,
  MapPin,
  LibraryBig,
  Calculator,
  Users,
  ArrowRight,
} from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How It Works — projectxbidx",
  description:
    "ProjectXBidX is a sealed-bid construction marketplace. Customers post projects, contractors compete with private bids, and qualification badges, AI scope checklists, paid estimates, and verified reviews keep everything honest.",
  keywords: [
    "how construction bidding works",
    "sealed bid marketplace",
    "hire a contractor",
    "construction project bidding",
    "get contractor bids",
    "paid estimates",
    "construction takeoffs",
  ],
};

const CUSTOMER_STEPS = [
  {
    icon: ClipboardList,
    title: "Post Your Project",
    description:
      "Describe the work, upload photos, videos, plans, and PDFs, and pick the level of professional you need (Licensed Contractor, Handyman, or General Labor). Higher levels = higher prices and fewer eligible bidders. Lower levels = lower prices and a bigger pool. Pick the lowest level that gets the job done right.",
  },
  {
    icon: Sparkles,
    title: "Build a Bid-Ready Scope (Optional, AI-Assisted)",
    description:
      "Let our AI Scope Builder read your description, photos, and timeline to suggest a clean checklist of work items. Include what applies, skip what doesn't. The result is a planning reference that helps contractors give you cleaner, more apples-to-apples bids.",
  },
  {
    icon: Send,
    title: "Receive Sealed Bids",
    description:
      "Qualified contractors find your project and submit private bids. Bidders never see each other's prices — only you and our admins do — so contractors compete on real value, not bid-matching games.",
  },
  {
    icon: ShieldCheck,
    title: "Verify Contractors at a Glance",
    description:
      "Every bidder shows a Gold / Silver / Bronze badge based on which credentials they've uploaded — license, bond, insurance, workers' comp, EIN, and references. Each individual document gets a green check ✓ if uploaded. You can verify the people bidding on your job in seconds.",
  },
  {
    icon: BadgeDollarSign,
    title: "Optionally Fund Paid Estimates",
    description:
      "Want better engagement on a competitive job? Fund a Paid Estimate Pool with Stripe — every qualified contractor who submits a real bid earns a small reward. It's a small platform fee that buys you serious attention from serious bidders.",
  },
  {
    icon: MessageSquare,
    title: "Compare, Ask, and Award",
    description:
      "Use side-by-side bid comparison and in-platform messaging to dig into pricing, timelines, and qualifications. When you've made your pick, hit Award — the winning bidder gets notified, and other bidders get a polite notice the project is taken (no names, no prices revealed).",
  },
  {
    icon: Star,
    title: "Leave a Verified Review",
    description:
      "After the job, leave a verified platform review. Honest ratings make great contractors visible and help future customers hire with confidence.",
  },
];

const CONTRACTOR_STEPS = [
  {
    title: "Create Your Profile + Upload Credentials",
    description:
      "Sign up free. Upload as many of the six credentials as you want (license, bond, insurance, workers' comp, EIN, references). The more you upload, the higher your badge — Gold, Silver, or Bronze — and the more visible you become in customer comparisons. Nothing is required to start bidding, but more uploads = more trust = more wins.",
  },
  {
    title: "Set Your Specialties + Service Areas",
    description:
      "Pick the trades you actually work in and the cities/states you serve. We use these to filter Browse Projects so you don't waste time scrolling jobs you can't take.",
  },
  {
    title: "Browse Projects + Save Searches",
    description:
      "Discover open projects filtered by trade, location, and your service area. Save any search and turn on alerts to be notified when matching projects post — so you can be first to bid on the work that fits you best.",
  },
  {
    title: "Submit Sealed Bids",
    description:
      "Bid with a price, timeline, and start date. Optionally upload your own proposal PDF, attach photos, or break out line items. Your bid is private — only the project owner sees it. Date/time stamps protect you if the customer edits the project after you bid.",
  },
  {
    title: "Earn Paid Estimates (When Available)",
    description:
      "Some projects post a funded Paid Estimate Pool. If you meet the eligibility criteria (typically core credentials uploaded), submitting a real bid claims a paid slot — you get paid for your estimate work, win or lose.",
  },
  {
    title: "Win Projects, Build Reputation",
    description:
      "Awarded projects unlock direct customer contact (email + phone). Deliver great work, then collect verified reviews that compound over time and surface you to more customers in your area.",
  },
];

const ESTIMATOR_STEPS = [
  {
    title: "Create an Estimator Account",
    description:
      "Estimator accounts are for professional construction estimators who sell takeoffs and estimate packages. We don't put estimators on the main signup chooser — visit /signup?role=estimator to create one.",
  },
  {
    title: "Publish Estimate Packages",
    description:
      "Build and publish reusable estimate packages (kitchen remodels, roof tear-offs, fence builds, etc.) into the public Estimate Library. Customers and contractors can browse and purchase your packages on demand.",
  },
  {
    title: "Respond to Estimate Requests",
    description:
      "Answer one-off estimate requests posted by customers and contractors who need a custom takeoff. Get paid through Stripe payouts when your work is purchased.",
  },
];

const TOOLS = [
  {
    icon: MapPin,
    title: "Quick Quotes by Address",
    description:
      "Anyone can search any U.S. address and see public contractor quotes for work at that address (think drive-by estimates for fence repair, lawn care, exterior paint, etc.). Customers can claim up to 3 of their own addresses to publicly request quotes; contractors can leave quotes to win quick, no-bidding-required jobs.",
  },
  {
    icon: LibraryBig,
    title: "Estimate Library",
    description:
      "Browse pre-built estimate packages from professional estimators — full takeoffs, scope checklists, and pricing references for common project types. Buy a package once and use it as a baseline against the bids you receive.",
  },
  {
    icon: Calculator,
    title: "AI Scope Builder",
    description:
      "Built into project posting. Reads your description, photos, location, and timeline to propose a clean scope checklist — so contractors aren't guessing what you actually want included.",
  },
  {
    icon: Users,
    title: "Find Contractors Directly",
    description:
      "Browse the contractor directory by trade, badge level, and location. Heart contractors you like, message them directly, or invite them to bid on a project.",
  },
];

export default function HowItWorksPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 border-b border-border bg-surface/95 backdrop-blur-sm">
        <nav className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-2.5 sm:px-6 sm:py-3">
          <BrandWordmark
            priority
            linkClassName="flex shrink-0 items-center"
            className="h-11 w-auto max-w-[min(100%,min(92vw,380px))] object-contain object-left sm:h-12 md:h-[3.25rem]"
          />
          <div className="flex shrink-0 items-center gap-3 sm:gap-4">
            <Link
              href="/login"
              className="rounded-lg bg-secondary px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-secondary-dark"
            >
              Log In
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-slate-950 shadow-sm hover:bg-primary-dark hover:text-white transition-colors"
            >
              Get Started
            </Link>
          </div>
        </nav>
      </header>

      <main className="flex-1 bg-surface">
        {/* Hero */}
        <section className="bg-gradient-to-br from-amber-900/5 via-green-900/5 to-slate-900/5 py-16 sm:py-24">
          <div className="mx-auto max-w-4xl px-6 text-center lg:px-8">
            <h1 className="text-4xl font-bold tracking-tight text-text-primary sm:text-5xl">
              How ProjectXBidX Works
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-text-secondary">
              A fair, transparent construction marketplace where sealed bids
              mean honest pricing, qualification badges make verification
              instant, and the best contractor wins.
            </p>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-text-muted">
              Free to post projects. Free to submit bids. Optional Paid
              Estimates and Estimate Packages help when you need extra
              firepower.
            </p>
          </div>
        </section>

        {/* For Customers */}
        <section className="py-16 sm:py-20">
          <div className="mx-auto max-w-5xl px-6 lg:px-8">
            <h2 className="text-center text-3xl font-bold text-text-primary">
              For Customers (Project Owners) 🏠
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-text-secondary">
              Post your project once. Get sealed bids from real, credentialed
              contractors. Compare them apples-to-apples. Award the right one.
            </p>
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {CUSTOMER_STEPS.map((step, index) => {
                const Icon = step.icon;
                return (
                  <div
                    key={step.title}
                    className="rounded-xl border border-border bg-surface p-6 shadow-sm"
                  >
                    <div className="mb-4 flex items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                        {index + 1}
                      </span>
                      <Icon className="h-5 w-5 text-secondary" />
                    </div>
                    <h3 className="text-lg font-semibold text-text-primary">
                      {step.title}
                    </h3>
                    <p className="mt-2 text-sm text-text-secondary leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* For Contractors */}
        <section className="border-t border-border bg-bg-warm py-16 sm:py-20">
          <div className="mx-auto max-w-5xl px-6 lg:px-8">
            <h2 className="text-center text-3xl font-bold text-text-primary">
              For Contractors (Bidders) 🔨
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-text-secondary">
              Find real work, submit clean bids, build a verified reputation,
              and get paid for the estimates you'd otherwise be giving away
              for free.
            </p>
            <div className="mt-12 space-y-6">
              {CONTRACTOR_STEPS.map((step, index) => (
                <div
                  key={step.title}
                  className="flex gap-4 rounded-xl border border-border bg-surface p-6 shadow-sm"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary/10 text-sm font-bold text-secondary">
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="text-lg font-semibold text-text-primary">
                      {step.title}
                    </h3>
                    <p className="mt-1 text-sm text-text-secondary leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Tools that work for everyone */}
        <section className="py-16 sm:py-20">
          <div className="mx-auto max-w-5xl px-6 lg:px-8">
            <h2 className="text-center text-3xl font-bold text-text-primary">
              Tools That Work for Everyone 🛠️
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-text-secondary">
              Beyond posting projects and bidding, ProjectXBidX includes a
              handful of focused tools that make pricing and verification
              easier for both sides.
            </p>
            <div className="mt-12 grid gap-6 sm:grid-cols-2">
              {TOOLS.map((tool) => {
                const Icon = tool.icon;
                return (
                  <div
                    key={tool.title}
                    className="rounded-xl border border-border bg-surface p-6 shadow-sm"
                  >
                    <Icon className="h-7 w-7 text-primary" />
                    <h3 className="mt-3 text-lg font-semibold text-text-primary">
                      {tool.title}
                    </h3>
                    <p className="mt-2 text-sm text-text-secondary leading-relaxed">
                      {tool.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* For Estimators (smaller, niche) */}
        <section className="border-t border-border bg-bg-warm py-16 sm:py-20">
          <div className="mx-auto max-w-4xl px-6 lg:px-8">
            <div className="text-center">
              <Calculator className="mx-auto h-8 w-8 text-accent" />
              <h2 className="mt-3 text-2xl font-bold text-text-primary">
                For Professional Estimators 📐
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-text-secondary">
                If you sell takeoffs and estimate packages, ProjectXBidX gives
                you a marketplace + Stripe payouts so you can productize your
                work.
              </p>
            </div>
            <div className="mt-10 space-y-4">
              {ESTIMATOR_STEPS.map((step, index) => (
                <div
                  key={step.title}
                  className="flex gap-4 rounded-xl border border-border bg-surface p-5 shadow-sm"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/10 text-xs font-bold text-accent">
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="text-base font-semibold text-text-primary">
                      {step.title}
                    </h3>
                    <p className="mt-1 text-sm text-text-secondary leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-8 text-center">
              <Link
                href="/signup?role=estimator"
                className="inline-flex items-center gap-2 rounded-lg border border-accent bg-accent/5 px-5 py-2.5 text-sm font-semibold text-accent transition-colors hover:bg-accent/10"
              >
                Sign Up as an Estimator
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 sm:py-20">
          <div className="mx-auto max-w-3xl px-6 text-center lg:px-8">
            <h2 className="text-3xl font-bold text-text-primary">
              Ready to Get Started?
            </h2>
            <p className="mt-3 text-text-secondary">
              Free to post projects. Free to submit bids. Pick the side that
              fits you.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link
                href="/signup?role=customer"
                className="rounded-lg bg-primary px-8 py-3 text-sm font-semibold text-slate-950 shadow-sm hover:bg-primary-dark hover:text-white transition-colors"
              >
                I Have a Project
              </Link>
              <Link
                href="/signup?role=bidder"
                className="rounded-lg bg-secondary px-8 py-3 text-sm font-semibold text-white shadow-sm hover:bg-secondary-dark transition-colors"
              >
                I&apos;m a Contractor
              </Link>
              <Link
                href="/"
                className="rounded-lg border border-border bg-surface px-8 py-3 text-sm font-semibold text-text-primary shadow-sm hover:bg-surface-hover transition-colors"
              >
                Back to Home
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-surface py-8">
        <div className="mx-auto max-w-7xl px-6 text-center">
          <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-text-muted">
            <Link href="/" className="hover:text-text-primary transition-colors">
              Home
            </Link>
            <span aria-hidden="true">&middot;</span>
            <Link
              href="/terms"
              className="hover:text-text-primary transition-colors"
            >
              Terms
            </Link>
            <span aria-hidden="true">&middot;</span>
            <Link
              href="/privacy"
              className="hover:text-text-primary transition-colors"
            >
              Privacy
            </Link>
            <span aria-hidden="true">&middot;</span>
            <span>
              &copy; {new Date().getFullYear()} projectxbidx. All rights
              reserved.
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
