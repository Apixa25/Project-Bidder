import Link from "next/link";
import { BrandWordmark } from "@/components/BrandWordmark";
import {
  ClipboardList,
  Send,
  ShieldCheck,
  Award,
  MessageSquare,
  Star,
} from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How It Works — projectxbidx",
  description:
    "Learn how ProjectXBidX's sealed-bid construction marketplace works for customers and contractors. Post projects, receive bids, hire with confidence.",
  keywords: [
    "how construction bidding works",
    "sealed bid marketplace",
    "hire a contractor",
    "construction project bidding",
    "get contractor bids",
  ],
};

const CUSTOMER_STEPS = [
  {
    icon: ClipboardList,
    title: "Post Your Project",
    description:
      "Describe your construction project with details, photos, videos, and a budget range. Choose which trades you need and set your timeline.",
  },
  {
    icon: Send,
    title: "Receive Sealed Bids",
    description:
      "Qualified contractors discover your project and submit sealed bids. Each bid is private — contractors can't see competing bids, ensuring honest pricing.",
  },
  {
    icon: ShieldCheck,
    title: "Review Qualification Badges",
    description:
      "Every contractor has a qualification badge (Gold, Silver, or Bronze) based on their uploaded credentials — license, bond, insurance, and more.",
  },
  {
    icon: MessageSquare,
    title: "Communicate & Compare",
    description:
      "Use in-platform messaging to ask questions. Compare bids side-by-side on price, timeline, and contractor qualifications before deciding.",
  },
  {
    icon: Award,
    title: "Award & Complete",
    description:
      "Award the winning bid to your chosen contractor. When the work is done, mark the project complete and leave a verified review.",
  },
  {
    icon: Star,
    title: "Build Trust",
    description:
      "Your verified review helps other customers make informed decisions and rewards great contractors with visibility on the platform.",
  },
];

const CONTRACTOR_STEPS = [
  {
    title: "Create Your Profile",
    description:
      "Sign up, upload your credentials (license, bond, insurance), set your trade specialties, and define your service area.",
  },
  {
    title: "Browse Open Projects",
    description:
      "Discover projects filtered by your trade, location, and service area. Save searches and get alerts when new matching projects are posted.",
  },
  {
    title: "Submit Competitive Bids",
    description:
      "Submit sealed bids with your price, timeline, and any supporting documents. Your bid is private — only the project owner sees it.",
  },
  {
    title: "Earn Paid Estimates",
    description:
      "Some projects offer paid estimate pools. Qualify by uploading your credentials and earn money just for submitting a bid.",
  },
  {
    title: "Win Projects & Build Your Reputation",
    description:
      "Win awarded projects, deliver great work, and collect verified reviews that boost your visibility and credibility on the platform.",
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
              mean honest pricing and the best contractor wins.
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
              Post your project and let qualified contractors come to you. No
              more cold-calling — just sealed bids from real professionals.
            </p>
            <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
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
              Find real projects, submit professional bids, and build your
              reputation with verified reviews and qualification badges.
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

        {/* CTA */}
        <section className="py-16 sm:py-20">
          <div className="mx-auto max-w-3xl px-6 text-center lg:px-8">
            <h2 className="text-3xl font-bold text-text-primary">
              Ready to Get Started?
            </h2>
            <p className="mt-3 text-text-secondary">
              Join ProjectXBidX today — it&apos;s free to post projects and submit
              bids.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link
                href="/signup"
                className="rounded-lg bg-primary px-8 py-3 text-sm font-semibold text-slate-950 shadow-sm hover:bg-primary-dark hover:text-white transition-colors"
              >
                Create Account
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
