import Link from "next/link";
import { HardHat, FileText, ClipboardCheck } from "lucide-react";

export default function SignupPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg-warm px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2">
            <HardHat className="h-10 w-10 text-primary" />
            <span className="text-2xl font-bold text-text-primary">
              Gold<span className="text-primary">Bridge</span>Bid
            </span>
          </Link>
          <p className="mt-3 text-text-secondary">
            Create your account
          </p>
        </div>

        {/* Role Selection */}
        <div className="mb-6 grid grid-cols-2 gap-4">
          <button
            type="button"
            className="group flex flex-col items-center gap-3 rounded-xl border-2 border-primary bg-primary/5 p-6 text-center transition-all hover:bg-primary/10"
          >
            <FileText className="h-8 w-8 text-primary" />
            <span className="text-sm font-semibold text-text-primary">
              I Have a Project
            </span>
            <span className="text-xs text-text-muted">Customer Account</span>
          </button>
          <button
            type="button"
            className="group flex flex-col items-center gap-3 rounded-xl border-2 border-border bg-surface p-6 text-center transition-all hover:border-secondary hover:bg-secondary/5"
          >
            <ClipboardCheck className="h-8 w-8 text-secondary" />
            <span className="text-sm font-semibold text-text-primary">
              I&apos;m a Contractor
            </span>
            <span className="text-xs text-text-muted">Bidder Account</span>
          </button>
        </div>

        <div className="rounded-xl border border-border bg-surface p-8 shadow-sm">
          <form className="space-y-5">
            <div>
              <label
                htmlFor="fullName"
                className="block text-sm font-medium text-text-primary"
              >
                Full Name
              </label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                required
                className="mt-1.5 block w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="John Smith"
              />
            </div>

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-text-primary"
              >
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="mt-1.5 block w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label
                htmlFor="phone"
                className="block text-sm font-medium text-text-primary"
              >
                Phone Number
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                required
                className="mt-1.5 block w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="(555) 555-5555"
              />
            </div>

            <div>
              <label
                htmlFor="address"
                className="block text-sm font-medium text-text-primary"
              >
                Address
              </label>
              <input
                id="address"
                name="address"
                type="text"
                required
                className="mt-1.5 block w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="123 Main St, Crescent City, CA"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-text-primary"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="mt-1.5 block w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-dark transition-colors"
            >
              Create Account
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-surface px-3 text-text-muted">
                Or continue with
              </span>
            </div>
          </div>

          <button
            type="button"
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-medium text-text-primary shadow-sm hover:bg-surface-hover transition-colors"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Sign up with Google
          </button>
        </div>

        <p className="mt-6 text-center text-sm text-text-muted">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-semibold text-primary hover:text-primary-dark transition-colors"
          >
            Sign in here
          </Link>
        </p>
      </div>
    </div>
  );
}
