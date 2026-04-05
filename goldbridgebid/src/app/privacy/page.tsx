import Link from "next/link";
import { BrandWordmark } from "@/components/BrandWordmark";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — projectxbidx",
  description:
    "Privacy Policy for ProjectXBidX.com, the sealed-bid construction marketplace.",
};

export default function PrivacyPolicyPage() {
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
            Privacy Policy
          </h1>
          <p className="mt-2 text-sm text-text-muted">
            Effective Date: {effectiveDate}
          </p>

          <div className="mt-10 space-y-8 text-text-secondary leading-relaxed [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-text-primary [&_h2]:mt-10 [&_h2]:mb-3 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-text-primary [&_h3]:mt-6 [&_h3]:mb-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:space-y-2">
            <p>
              ProjectXBidX.com (&quot;Platform,&quot; &quot;we,&quot;
              &quot;us,&quot; or &quot;our&quot;) is committed to protecting your
              privacy. This Privacy Policy explains what information we collect,
              how we use it, how we share it, and your choices regarding your
              data.
            </p>

            <h2>1. Information We Collect</h2>

            <h3>1a. Information You Provide</h3>
            <ul>
              <li>
                <strong>Account Information:</strong> Full name, email address,
                phone number, physical address, business name, and password when
                you create an account.
              </li>
              <li>
                <strong>Profile Information:</strong> Bio, avatar photo, website
                URL, social media links, trade specialties, and years of
                experience.
              </li>
              <li>
                <strong>Credential Documents:</strong> Contractor license, bond,
                insurance certificate, workers&apos; compensation certificate,
                EIN documentation, and professional references uploaded by
                bidders.
              </li>
              <li>
                <strong>Project Information:</strong> Project descriptions,
                locations, photos, videos, documents, budget ranges, and
                completion criteria posted by customers.
              </li>
              <li>
                <strong>Bid Information:</strong> Bid prices, timelines, start
                dates, trade selections, notes, and supporting documents
                submitted by bidders.
              </li>
              <li>
                <strong>Messages:</strong> Text content and file attachments sent
                through in-platform messaging.
              </li>
              <li>
                <strong>Reviews:</strong> Ratings, review text, and relationship
                context submitted about other users.
              </li>
              <li>
                <strong>Payment Information:</strong> When using paid features
                (paid estimate pools), payment processing is handled by Stripe.
                We do not directly store credit card numbers or bank account
                details.
              </li>
            </ul>

            <h3>1b. Information Collected Automatically</h3>
            <ul>
              <li>
                <strong>Usage Data:</strong> Pages visited, features used, and
                interactions with the Platform.
              </li>
              <li>
                <strong>Device Information:</strong> Browser type, operating
                system, screen resolution, and device identifiers.
              </li>
              <li>
                <strong>Log Data:</strong> IP addresses, access times, and
                referring URLs.
              </li>
              <li>
                <strong>Cookies:</strong> We use essential cookies for
                authentication and session management. We do not currently use
                third-party advertising cookies.
              </li>
            </ul>

            <h2>2. How We Use Your Information</h2>
            <ul>
              <li>
                <strong>To operate the Platform:</strong> Facilitate project
                posting, bid submission, messaging, notifications, and the
                contractor directory.
              </li>
              <li>
                <strong>To display profiles and badges:</strong> Show bidder
                qualification badges, profile information, and reviews to
                customers evaluating bids.
              </li>
              <li>
                <strong>To process payments:</strong> Facilitate paid estimate
                pool funding, contractor payouts, and related financial
                transactions via Stripe.
              </li>
              <li>
                <strong>To send notifications:</strong> Deliver in-app and email
                notifications for bids, messages, project updates, and account
                activity.
              </li>
              <li>
                <strong>To enforce our Terms:</strong> Detect and prevent fraud,
                abuse, and violations of our Terms of Service.
              </li>
              <li>
                <strong>To improve the Platform:</strong> Analyze usage patterns,
                troubleshoot issues, and develop new features.
              </li>
              <li>
                <strong>To communicate with you:</strong> Respond to support
                requests, send service updates, and provide important
                information about your account.
              </li>
            </ul>

            <h2>3. How We Share Your Information</h2>
            <ul>
              <li>
                <strong>With other Platform users:</strong> Your profile
                information, qualification badges, portfolio, and reviews are
                visible to other users as part of normal Platform functionality.
                Bid details are only visible to the project owner and Platform
                administrators (sealed bid system).
              </li>
              <li>
                <strong>With Stripe:</strong> Payment-related data is shared with
                Stripe for payment processing. See{" "}
                <a
                  href="https://stripe.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline hover:text-primary-dark"
                >
                  Stripe&apos;s Privacy Policy
                </a>
                .
              </li>
              <li>
                <strong>With Supabase:</strong> Your data is stored in
                Supabase-hosted PostgreSQL databases with row-level security. See{" "}
                <a
                  href="https://supabase.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline hover:text-primary-dark"
                >
                  Supabase&apos;s Privacy Policy
                </a>
                .
              </li>
              <li>
                <strong>With Vercel:</strong> The Platform is hosted on Vercel.
                See{" "}
                <a
                  href="https://vercel.com/legal/privacy-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline hover:text-primary-dark"
                >
                  Vercel&apos;s Privacy Policy
                </a>
                .
              </li>
              <li>
                <strong>For legal compliance:</strong> We may disclose
                information when required by law, subpoena, court order, or
                government request, or to protect the rights, safety, or
                property of our users or the public.
              </li>
              <li>
                <strong>We do not sell your personal information</strong> to
                third parties for advertising or marketing purposes.
              </li>
            </ul>

            <h2>4. Data Security</h2>
            <ul>
              <li>
                All data is transmitted over HTTPS (TLS encryption).
              </li>
              <li>
                Uploaded files (credentials, project photos, bid documents) are
                stored in private Supabase Storage buckets with signed URLs —
                they are not publicly accessible.
              </li>
              <li>
                Row-Level Security (RLS) policies are enforced at the database
                level, ensuring users can only access data they are authorized to
                see.
              </li>
              <li>
                Authentication is managed by Supabase Auth with JWT tokens and
                optional Google OAuth.
              </li>
              <li>
                While we implement reasonable security measures, no system is
                100% secure. You are responsible for keeping your account
                credentials confidential.
              </li>
            </ul>

            <h2>5. Data Retention</h2>
            <ul>
              <li>
                Account data is retained for as long as your account is active.
              </li>
              <li>
                If you request account deletion, we will remove your profile and
                personal information within 30 days. Certain data (bids and
                messages associated with other users&apos; active projects) may
                be retained in anonymized form for platform integrity.
              </li>
              <li>
                Admin audit logs and flagged content records are retained
                indefinitely for platform security and compliance purposes.
              </li>
            </ul>

            <h2>6. Your Rights &amp; Choices</h2>
            <ul>
              <li>
                <strong>Access &amp; Correction:</strong> You can view and update
                your profile information, credentials, and portfolio at any time
                through your dashboard.
              </li>
              <li>
                <strong>Data Export:</strong> You may request a copy of your
                personal data by contacting us at{" "}
                <a
                  href="mailto:support@projectxbidx.com"
                  className="text-primary underline hover:text-primary-dark"
                >
                  support@projectxbidx.com
                </a>
                .
              </li>
              <li>
                <strong>Account Deletion:</strong> You may request deletion of
                your account and personal data by contacting support.
              </li>
              <li>
                <strong>Notification Preferences:</strong> You can manage your
                notification settings through your dashboard.
              </li>
              <li>
                <strong>Do Not Track:</strong> We do not currently respond to
                &quot;Do Not Track&quot; browser signals, as there is no industry
                standard for compliance.
              </li>
            </ul>

            <h2>7. California Privacy Rights (CCPA)</h2>
            <p>
              If you are a California resident, you have additional rights under
              the California Consumer Privacy Act (CCPA):
            </p>
            <ul>
              <li>
                The right to know what personal information we collect, use, and
                disclose.
              </li>
              <li>
                The right to request deletion of your personal information.
              </li>
              <li>
                The right to opt out of the sale of personal information. We do
                not sell personal information.
              </li>
              <li>
                The right to non-discrimination for exercising your privacy
                rights.
              </li>
            </ul>
            <p>
              To exercise your CCPA rights, contact us at{" "}
              <a
                href="mailto:support@projectxbidx.com"
                className="text-primary underline hover:text-primary-dark"
              >
                support@projectxbidx.com
              </a>
              .
            </p>

            <h2>8. Children&apos;s Privacy</h2>
            <p>
              The Platform is not intended for use by individuals under the age
              of 18. We do not knowingly collect personal information from
              children. If we become aware that a user is under 18, we will
              promptly delete their account and associated data.
            </p>

            <h2>9. Third-Party Links</h2>
            <p>
              The Platform may contain links to third-party websites or services
              (e.g., contractor websites, social media profiles). We are not
              responsible for the privacy practices of these third parties. We
              encourage you to review their privacy policies before providing
              personal information.
            </p>

            <h2>10. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. When we make
              material changes, we will notify users via in-platform notification
              and update the &quot;Effective Date&quot; at the top of this page.
              Your continued use of the Platform after changes are posted
              constitutes acceptance of the updated Privacy Policy.
            </p>

            <h2>11. Contact Us</h2>
            <p>
              If you have questions about this Privacy Policy or your personal
              data, please contact us at:
            </p>
            <ul>
              <li>
                <strong>Email:</strong>{" "}
                <a
                  href="mailto:support@projectxbidx.com"
                  className="text-primary underline hover:text-primary-dark"
                >
                  support@projectxbidx.com
                </a>
              </li>
              <li>
                <strong>Platform:</strong>{" "}
                <a
                  href="https://projectxbidx.com"
                  className="text-primary underline hover:text-primary-dark"
                >
                  ProjectXBidX.com
                </a>
              </li>
            </ul>
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
              href="/terms"
              className="hover:text-text-primary transition-colors"
            >
              Terms of Service
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
