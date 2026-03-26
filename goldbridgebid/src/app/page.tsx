import Link from "next/link";
import Image from "next/image";
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
import { ScrollMoreCue } from "@/components/home/ScrollMoreCue";
import { BrandWordmark } from "@/components/BrandWordmark";

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
  "General A",
  "General B",
  "General C",
  "Handyman",
  "General Work",
  "C-2 — Insulation and Acoustical",
  "C-4 — Boiler, Hot Water Heating and Steam Fitting",
  "C-5 — Framing and Rough Carpentry",
  "C-6 — Cabinet, Millwork and Finish Carpentry",
  "C-7 — Low Voltage Systems",
  "C-8 — Concrete",
  "C-10 — Electrical",
  "C-11 — Drywall",
  "C-12 — Earthwork and Paving",
  "C-13 — Fencing",
  "C-15 — Flooring and Floor Covering",
  "C-16 — Fire Protection",
  "C-17 — Glazing",
  "C-20 — HVAC",
  "C-21 — Building Moving/Demolition",
  "C-23 — Ornamental Metal",
  "C-27 — Landscaping",
  "C-29 — Masonry",
  "C-31 — Construction Zone Traffic Control",
  "C-33 — Painting and Decorating",
  "C-34 — Pipeline",
  "C-36 — Plumbing",
  "C-38 — Refrigeration",
  "C-39 — Roofing",
  "C-42 — Sanitation System",
  "C-43 — Sheet Metal",
  "C-45 — Sign",
  "C-46 — Solar",
  "C-47 — General Manufactured Housing",
  "C-50 — Reinforcing Steel",
  "C-51 — Structural Steel",
  "C-53 — Swimming Pool",
  "C-54 — Tile (Ceramic and Mosaic)",
  "C-55 — Water Conditioning",
  "C-57 — Well Drilling",
  "C-60 — Earthquake Retrofit",
];

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Navigation */}
      <header className="sticky top-0 z-50 border-b border-border bg-surface/95 backdrop-blur-sm">
        <nav className="mx-auto flex max-w-7xl items-center px-4 py-2.5 sm:px-6">
          <BrandWordmark className="text-xl shrink-0 sm:text-2xl" />
          <div className="flex flex-1 justify-center px-2">
            <Image
              src="/logo-mark.png"
              alt="projectxbidx"
              width={256}
              height={256}
              className="h-14 w-auto max-h-16 max-w-[min(100%,220px)] object-contain sm:h-16"
              priority
            />
          </div>
          <div className="flex items-center gap-3 sm:gap-4">
            <Link
              href="/login"
              className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
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

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-gradient-to-br from-accent via-secondary-dark to-slate-950 pt-12 pb-12 sm:pt-16 sm:pb-16">
          <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
          <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-4xl text-center">
              <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
                <span className="block">
                  Do you have a{" "}
                  <span className="text-primary">project</span> you need a bid
                  on? Or are you talented at what you do and looking for{" "}
                  <span className="text-primary">more work</span>?
                </span>
                <span className="mt-5 block text-[0.5em] leading-relaxed sm:mt-6">
                  From a yard that needs mowing all the way to a bridge that needs
                  to be built, post your project here and receive bids from
                  potential contractors.
                </span>
              </h1>
              <p className="mt-6 text-lg leading-8 text-zinc-200/90">
                Post your construction project. Receive sealed bids from
                contractors.
              </p>
              <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Link
                  href="/signup?role=customer"
                  className="flex items-center gap-2 rounded-lg bg-primary px-8 py-3.5 text-base font-semibold text-slate-950 shadow-lg hover:bg-primary-light transition-colors"
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
              <div className="mt-8 flex justify-center">
                <ScrollMoreCue
                  href="#how-it-works"
                  variant="on-dark"
                  ariaLabel="Scroll down to see how it works"
                />
              </div>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section
          id="how-it-works"
          className="scroll-mt-[230px] py-20 sm:py-28 bg-surface"
        >
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
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary text-2xl font-bold text-slate-950 shadow-md">
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
            <div className="mt-12 flex justify-center sm:mt-16">
              <ScrollMoreCue
                href="#features"
                variant="on-light"
                ariaLabel="Scroll down to platform features"
              />
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section
          id="features"
          className="scroll-mt-[230px] py-20 sm:py-28 bg-bg-warm"
        >
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
            <div className="mt-12 flex justify-center sm:mt-16">
              <ScrollMoreCue
                href="#qualification"
                variant="on-light"
                ariaLabel="Scroll down to qualification badges"
              />
            </div>
          </div>
        </section>

        {/* Badge System Showcase */}
        <section
          id="qualification"
          className="scroll-mt-[230px] py-20 sm:py-28 bg-surface"
        >
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
            <div className="mt-12 flex justify-center sm:mt-16">
              <ScrollMoreCue
                href="#trades"
                variant="on-light"
                ariaLabel="Scroll down to trades we cover"
              />
            </div>
          </div>
        </section>

        {/* Trades We Cover */}
        <section
          id="trades"
          className="scroll-mt-[230px] py-20 sm:py-28 bg-bg-warm"
        >
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
                All Construction Trades Welcome
              </h2>
              <p className="mt-4 text-lg text-text-secondary">
                From foundation to finish, every trade has a place on
                projectxbidx.
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
            <div className="mt-12 flex justify-center sm:mt-16">
              <ScrollMoreCue
                href="#get-started"
                variant="on-light"
                ariaLabel="Scroll down to get started"
              />
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section
          id="get-started"
          className="relative scroll-mt-[230px] overflow-hidden bg-gradient-to-r from-accent via-secondary to-primary py-20"
        >
          <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Ready to Get Started?
              </h2>
              <p className="mt-4 text-lg text-zinc-200/90">
                Whether you&apos;re posting a project or looking for work,
                projectxbidx makes it simple.
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
            <div className="mt-12 flex justify-center sm:mt-14">
              <ScrollMoreCue
                href="#site-footer"
                variant="on-dark"
                ariaLabel="Scroll down to site footer"
              />
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer
        id="site-footer"
        className="scroll-mt-8 border-t border-border bg-surface py-12 sm:scroll-mt-12"
      >
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <div className="flex flex-col items-center gap-1">
              <Image
                src="/logo-mark.png"
                alt="projectxbidx"
                width={160}
                height={160}
                className="h-14 w-auto max-w-[160px] object-contain"
              />
              <BrandWordmark className="text-lg" />
            </div>
            <p className="text-sm text-text-muted">
              Serving Crescent City, CA — growing nationwide.
            </p>
            <p className="text-sm text-text-muted">
              &copy; {new Date().getFullYear()} projectxbidx. All rights
              reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
