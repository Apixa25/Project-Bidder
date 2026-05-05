import Link from "next/link";
import Image from "next/image";
import {
  HardHat,
  FileText,
  Shield,
  MessageSquare,
  ClipboardCheck,
  Sparkles,
  BadgeDollarSign,
  MapPin,
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
      "Describe your construction project with photos, documents, and videos. Pick the level of professional you need — Licensed Contractor, Handyman, or General Labor — and we'll match you with the right pool of bidders.",
  },
  {
    icon: Shield,
    title: "Easy to Verify Contractors",
    description:
      "Bidders upload their license, bond, insurance, workers' comp, EIN, and references — and Gold, Silver, and Bronze badges show which documents are on file at a glance, so you can verify them yourself in seconds.",
  },
  {
    icon: ClipboardCheck,
    title: "Sealed Bids",
    description:
      "Receive competitive sealed bids directly. Only you see the details — bidders never see competing offers. Fair, transparent, and confidential.",
  },
  {
    icon: Sparkles,
    title: "AI Scope Builder",
    description:
      "Our AI reads your description, photos, and timeline to suggest a clean scope checklist. Include what applies, skip what doesn't — so contractors give you cleaner, apples-to-apples bids.",
  },
  {
    icon: BadgeDollarSign,
    title: "Paid Estimates (Optional)",
    description:
      "Want serious attention on a competitive job? Fund a Paid Estimate Pool with Stripe, and qualified contractors get a small reward for submitting real bids.",
  },
  {
    icon: MapPin,
    title: "Quick Quotes by Address",
    description:
      "Look up any address and see public contractor quotes left for that property. Perfect for small jobs (lawn care, exterior paint, fence repair) where a sealed-bid project is overkill.",
  },
  {
    icon: MessageSquare,
    title: "Built-In Messaging + Q&A",
    description:
      "Ask questions, share extra documents, and message bidders directly — all logged and organized inside the platform. Public Q&A on each project keeps everyone on the same page.",
  },
  {
    icon: HardHat,
    title: "Track Everything",
    description:
      "See bid counts, project status, every edit, and verified reviews — with date stamps that protect both sides from scope creep.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen overflow-x-clip">
      {/* Navigation */}
      <header className="sticky top-0 z-50 border-b border-border bg-surface/95 backdrop-blur-sm">
        <nav className="mx-auto flex w-full max-w-7xl items-center gap-2 px-4 py-2.5 sm:gap-4 sm:px-6 sm:py-3">
          <BrandWordmark
            priority
            linkClassName="flex shrink-0 items-center"
            className="h-7 w-auto max-w-[min(100%,min(48vw,180px))] object-contain object-left sm:h-12 sm:max-w-[min(100%,min(92vw,380px))] md:h-[3.25rem]"
          />
          {/* Decorative X logo — only render on md+ where there's room. On phones
              it would otherwise eat all the available width and push the auth
              buttons off-screen (see mobile audit). */}
          <div className="hidden min-h-0 min-w-0 flex-1 items-center justify-center px-2 md:flex">
            <Image
              src="/logo-mark.png"
              alt="projectxbidx"
              width={1600}
              height={720}
              className="h-44 w-auto max-w-[min(100%,880px)] object-contain sm:h-48 sm:max-w-[min(100%,1120px)] md:max-w-[min(100%,1280px)]"
              priority
            />
          </div>
          {/* On phones we still want the nav buttons to push to the right edge;
              the spacer below replaces the (now hidden) center logo's flex-grow. */}
          <div className="flex-1 md:hidden" aria-hidden />
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-4">
            <Link
              href="/address-quotes"
              className="hidden items-center gap-2 rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-sm font-semibold text-text-primary shadow-sm transition-colors hover:border-primary/50 hover:bg-primary/20 sm:inline-flex"
            >
              <Image
                src="/address-lookup-map.svg"
                alt=""
                width={56}
                height={34}
                className="h-8 w-12 rounded-lg object-cover"
              />
              <span>Look Up Your Address</span>
            </Link>
            <Link
              href="/how-it-works"
              className="hidden sm:inline-flex text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
            >
              How It Works
            </Link>
            <Link
              href="/login"
              className="rounded-lg bg-secondary px-2.5 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-secondary-dark sm:px-4 sm:text-sm"
            >
              Log In
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-primary px-2.5 py-2 text-xs font-semibold text-slate-950 shadow-sm hover:bg-primary-dark hover:text-white transition-colors sm:px-4 sm:text-sm"
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
                Where{" "}
                <span className="text-[#eab308]">qualified contractors</span>{" "}
                compete for your project.
              </h1>
              <p className="mt-6 text-lg leading-8 text-zinc-200/90">
                Post your construction project — from a yard that needs mowing
                to a bridge that needs to be built — and receive sealed bids
                from real contractors. It&apos;s free for both sides.
              </p>
              <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Link
                  href="/signup?role=customer"
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#eab308] px-5 py-3.5 text-center text-sm font-semibold text-slate-950 shadow-lg transition-colors hover:bg-[#fde047] sm:w-auto sm:px-8 sm:text-base"
                >
                  I Have a Project
                  <ArrowRight className="h-5 w-5 shrink-0" />
                </Link>
                <Link
                  href="/signup?role=bidder"
                  className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-white/30 bg-white/10 px-5 py-3.5 text-center text-sm font-semibold text-white shadow-lg backdrop-blur-sm transition-colors hover:bg-white/20 sm:w-auto sm:px-8 sm:text-base"
                >
                  I&apos;m a Contractor
                  <ArrowRight className="h-5 w-5 shrink-0" />
                </Link>
              </div>
              {/* Secondary CTA — small text link so the address lookup is still
                  discoverable without competing with the two role buttons. */}
              <p className="mt-6 text-sm text-zinc-200/80">
                Just curious about contractor pricing on your property?{" "}
                <Link
                  href="/address-quotes"
                  className="font-semibold text-[#fde047] underline underline-offset-4 hover:text-white"
                >
                  Look up an address →
                </Link>
              </p>
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
          className="scroll-mt-52 sm:scroll-mt-60 py-20 sm:py-28 bg-surface"
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
          className="scroll-mt-52 sm:scroll-mt-60 py-20 sm:py-28 bg-bg-warm"
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
          className="scroll-mt-52 sm:scroll-mt-60 py-20 sm:py-28 bg-surface"
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
          className="relative scroll-mt-52 sm:scroll-mt-60 overflow-hidden bg-gradient-to-r from-accent via-secondary to-primary py-20"
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
                width={320}
                height={320}
                className="h-14 w-auto max-w-[160px] object-contain"
              />
              <BrandWordmark className="h-5 w-auto max-w-[min(100%,150px)] object-contain" />
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-text-muted">
              <Link
                href="/how-it-works"
                className="hover:text-text-primary transition-colors"
              >
                How It Works
              </Link>
              <span aria-hidden="true">&middot;</span>
              <Link
                href="/terms"
                className="hover:text-text-primary transition-colors"
              >
                Terms of Service
              </Link>
              <span aria-hidden="true">&middot;</span>
              <Link
                href="/privacy"
                className="hover:text-text-primary transition-colors"
              >
                Privacy Policy
              </Link>
              <span aria-hidden="true">&middot;</span>
              <span>Serving Crescent City, CA — growing nationwide.</span>
            </div>
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
