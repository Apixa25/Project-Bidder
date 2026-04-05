import Link from "next/link";
import Image from "next/image";
import { BrandWordmark } from "@/components/BrandWordmark";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — projectxbidx",
  description:
    "Terms of Service for ProjectXBidX.com, the sealed-bid construction marketplace.",
};

export default function TermsOfServicePage() {
  const effectiveDate = "April 5, 2026";

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

      <main className="flex-1 bg-surface py-12 sm:py-16">
        <article className="mx-auto max-w-3xl px-6 lg:px-8">
          <h1 className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
            Terms of Service
          </h1>
          <p className="mt-2 text-sm text-text-muted">
            Effective Date: {effectiveDate}
          </p>

          <div className="mt-10 space-y-8 text-text-secondary leading-relaxed [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-text-primary [&_h2]:mt-10 [&_h2]:mb-3 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-text-primary [&_h3]:mt-6 [&_h3]:mb-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:space-y-2">
            <p>
              Welcome to ProjectXBidX.com (&quot;Platform,&quot; &quot;we,&quot;
              &quot;us,&quot; or &quot;our&quot;). By accessing or using our
              website, services, or any associated applications, you agree to be
              bound by these Terms of Service (&quot;Terms&quot;). If you do not
              agree to these Terms, you may not use the Platform.
            </p>

            <h2>1. Description of Service</h2>
            <p>
              ProjectXBidX.com is a sealed-bid construction marketplace that
              connects customers who have projects with qualified contractors who
              submit competitive bids. The Platform provides project posting, bid
              submission, contractor profiles, in-platform messaging,
              notifications, and related tools.
            </p>
            <p>
              We are a <strong>marketplace platform only</strong>. We do not
              perform construction work, employ contractors, guarantee the
              quality of work, or serve as a party to any agreement between
              customers and contractors.
            </p>

            <h2>2. Eligibility &amp; Accounts</h2>
            <ul>
              <li>
                You must be at least 18 years old and legally able to enter into
                binding agreements.
              </li>
              <li>
                You must provide accurate, current, and complete information
                during registration and keep your account information updated.
              </li>
              <li>
                Each account is for a single individual or business entity. You
                are responsible for all activity that occurs under your account.
              </li>
              <li>
                You may register as a <strong>Customer</strong> (project owner),
                a <strong>Bidder</strong> (contractor), or both. Each role is
                governed by these Terms.
              </li>
            </ul>

            <h2>3. Customer Responsibilities</h2>
            <ul>
              <li>
                Provide accurate and complete project descriptions, including
                scope of work, location, and completion criteria.
              </li>
              <li>
                Review bids in good faith and treat all bidders with
                professionalism.
              </li>
              <li>
                Understand that awarding a bid through the Platform does not
                constitute a binding construction contract — you are responsible
                for executing your own agreements with chosen contractors.
              </li>
              <li>
                Do not post fraudulent, misleading, or illegal project listings.
              </li>
            </ul>

            <h2>4. Bidder (Contractor) Responsibilities</h2>
            <ul>
              <li>
                Provide truthful business information, credentials, and bid
                details.
              </li>
              <li>
                Only upload credentials (license, bond, insurance, etc.) that are
                valid and belong to you or your business.
              </li>
              <li>
                Submit bids in good faith with realistic pricing and timelines.
              </li>
              <li>
                Understand that qualification badges (Gold, Silver, Bronze) are
                based on documents you upload. We do not independently verify the
                authenticity or validity of uploaded credentials at this time.
              </li>
              <li>
                Do not submit spam bids, fraudulent proposals, or bids on
                projects you have no intention or ability to complete.
              </li>
            </ul>

            <h2>5. Sealed Bid System</h2>
            <ul>
              <li>
                All bids are <strong>sealed</strong> — only the customer (project
                owner) and Platform administrators can view bid details.
              </li>
              <li>
                Bidders cannot see competing bids, bid amounts, or other
                bidders&apos; information on the same project.
              </li>
              <li>
                Any attempt to circumvent the sealed-bid system (e.g.,
                soliciting bid information from other bidders or the customer)
                may result in account suspension.
              </li>
            </ul>

            <h2>6. Paid Estimate Incentives</h2>
            <p>
              Customers may optionally fund a &quot;Paid Estimate Pool&quot; for
              a project, offering monetary rewards to qualified bidders who
              submit estimates. These payments are processed through Stripe.
            </p>
            <ul>
              <li>
                Paid estimate rewards are subject to eligibility criteria set by
                the customer and enforced by the Platform.
              </li>
              <li>
                Customers may dispute paid estimate claims for reasons including
                spam, wrong trade, duplicate submissions, or unqualified bids.
              </li>
              <li>
                Disputes are reviewed by Platform administrators, whose
                decisions are final.
              </li>
              <li>
                Platform fees are deducted from paid estimate rewards before
                contractor payouts.
              </li>
            </ul>

            <h2>7. Payments &amp; Fees</h2>
            <ul>
              <li>
                Account registration and basic use of the Platform (posting
                projects, submitting bids, messaging) are currently{" "}
                <strong>free</strong>.
              </li>
              <li>
                Paid features (paid estimate pools, premium listings, etc.) are
                processed through Stripe. By using paid features, you also agree
                to{" "}
                <a
                  href="https://stripe.com/legal"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline hover:text-primary-dark"
                >
                  Stripe&apos;s Terms of Service
                </a>
                .
              </li>
              <li>
                We reserve the right to introduce new fees or modify existing fee
                structures with reasonable notice.
              </li>
            </ul>

            <h2>8. Content &amp; Uploads</h2>
            <ul>
              <li>
                You retain ownership of content you upload (photos, documents,
                videos, bid proposals).
              </li>
              <li>
                By uploading content, you grant us a non-exclusive, worldwide,
                royalty-free license to store, display, and distribute your
                content as necessary to operate the Platform.
              </li>
              <li>
                You must not upload content that is illegal, defamatory,
                infringing, obscene, or harmful.
              </li>
              <li>
                We reserve the right to remove any content that violates these
                Terms or is flagged for review.
              </li>
            </ul>

            <h2>9. Messaging &amp; Communication</h2>
            <ul>
              <li>
                All in-platform messages are logged and may be reviewed by
                administrators for moderation purposes.
              </li>
              <li>
                Do not use the messaging system for harassment, spam, soliciting
                personal information unrelated to a project, or any illegal
                activity.
              </li>
            </ul>

            <h2>10. Reviews &amp; Ratings</h2>
            <ul>
              <li>
                Reviews must be honest, based on genuine experience, and not
                intended to manipulate ratings.
              </li>
              <li>
                Fake reviews, paid reviews, or review manipulation will result in
                content removal and potential account suspension.
              </li>
              <li>
                We reserve the right to moderate, flag, or remove reviews that
                violate our guidelines.
              </li>
            </ul>

            <h2>11. Prohibited Conduct</h2>
            <p>You agree not to:</p>
            <ul>
              <li>
                Use the Platform for any unlawful purpose or in violation of any
                applicable laws or regulations.
              </li>
              <li>
                Attempt to access other users&apos; accounts, bids, or private
                data.
              </li>
              <li>
                Reverse-engineer, decompile, or attempt to extract the source
                code of the Platform.
              </li>
              <li>
                Use automated tools (bots, scrapers) to access or interact with
                the Platform without permission.
              </li>
              <li>
                Impersonate another person, business, or entity.
              </li>
              <li>
                Engage in bid manipulation, price-fixing, or collusion.
              </li>
            </ul>

            <h2>12. Account Suspension &amp; Termination</h2>
            <ul>
              <li>
                We may suspend or terminate your account at our discretion if you
                violate these Terms, engage in fraud, or are reported for
                misconduct.
              </li>
              <li>
                Banned users will be redirected to a notice page and will not be
                able to access Platform features.
              </li>
              <li>
                You may delete your account at any time by contacting support.
                Certain data (bids, messages related to active projects) may be
                retained as necessary for platform integrity.
              </li>
            </ul>

            <h2>13. Disclaimers</h2>
            <ul>
              <li>
                The Platform is provided &quot;as is&quot; and &quot;as
                available&quot; without warranties of any kind, express or
                implied.
              </li>
              <li>
                We do not guarantee the accuracy of contractor credentials,
                badges, or qualifications. Customers are responsible for
                independently verifying contractor qualifications before hiring.
              </li>
              <li>
                We are not responsible for the quality, safety, legality, or
                completion of any construction work arranged through the
                Platform.
              </li>
              <li>
                We do not guarantee any specific number of bids, response times,
                or project outcomes.
              </li>
            </ul>

            <h2>14. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, ProjectXBidX.com, its
              owners, officers, employees, and affiliates shall not be liable for
              any indirect, incidental, special, consequential, or punitive
              damages arising from your use of the Platform, including but not
              limited to loss of profits, data, or business opportunities.
            </p>

            <h2>15. Indemnification</h2>
            <p>
              You agree to indemnify and hold harmless ProjectXBidX.com and its
              affiliates from any claims, damages, losses, or expenses
              (including reasonable attorney fees) arising from your use of the
              Platform, your violation of these Terms, or your violation of any
              third-party rights.
            </p>

            <h2>16. Changes to These Terms</h2>
            <p>
              We may update these Terms from time to time. When we make material
              changes, we will notify users via in-platform notification and/or
              email. Your continued use of the Platform after changes are posted
              constitutes acceptance of the updated Terms.
            </p>

            <h2>17. Governing Law</h2>
            <p>
              These Terms are governed by and construed in accordance with the
              laws of the State of California. Any disputes arising from these
              Terms or your use of the Platform shall be resolved in the courts
              of Del Norte County, California.
            </p>

            <h2>18. Contact Us</h2>
            <p>
              If you have questions about these Terms, please contact us at{" "}
              <a
                href="mailto:support@projectxbidx.com"
                className="text-primary underline hover:text-primary-dark"
              >
                support@projectxbidx.com
              </a>
              .
            </p>
          </div>
        </article>
      </main>

      <footer className="border-t border-border bg-surface py-8">
        <div className="mx-auto max-w-7xl px-6 text-center">
          <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-text-muted">
            <Link href="/" className="hover:text-text-primary transition-colors">
              Home
            </Link>
            <span aria-hidden="true">&middot;</span>
            <Link
              href="/privacy"
              className="hover:text-text-primary transition-colors"
            >
              Privacy Policy
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
