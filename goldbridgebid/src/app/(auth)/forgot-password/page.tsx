"use client";

import Link from "next/link";
import { useState } from "react";
import Image from "next/image";
import { CheckCircle2, Loader2, Mail } from "lucide-react";
import { requestPasswordReset } from "../actions";
import { BrandWordmark } from "@/components/BrandWordmark";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // We always show "we sent a link if the email is registered" regardless of
  // whether the email exists — never reveal which emails are registered.
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    const result = await requestPasswordReset(formData);
    setLoading(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setSubmitted(true);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg-warm px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex flex-col items-center gap-2">
            <Image
              src="/logo-mark.png"
              alt="projectxbidx"
              width={512}
              height={512}
              className="h-24 w-auto max-w-[280px] object-contain"
            />
            <BrandWordmark
              asLink={false}
              className="mx-auto h-6 w-auto max-w-[min(100%,180px)] object-contain"
            />
          </Link>
          <p className="mt-3 text-text-secondary">
            Forgot your password? No problem.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-surface p-5 shadow-sm sm:p-8">
          {submitted ? (
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
              <h2 className="mt-4 text-lg font-semibold text-text-primary">
                Check your email
              </h2>
              <p className="mt-2 text-sm text-text-secondary">
                If an account exists for{" "}
                <span className="font-semibold text-text-primary">
                  {email}
                </span>
                , we&apos;ve sent a password reset link. Click the link in the
                email to set a new password.
              </p>
              <p className="mt-4 text-xs text-text-muted">
                The link expires in about an hour. Don&apos;t forget to check
                your spam folder.
              </p>
              <div className="mt-6 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSubmitted(false);
                    setEmail("");
                  }}
                  className="text-sm font-medium text-primary hover:text-primary-dark transition-colors"
                >
                  Use a different email
                </button>
                <Link
                  href="/login"
                  className="text-sm font-medium text-text-muted hover:text-text-primary transition-colors"
                >
                  Back to sign in
                </Link>
              </div>
            </div>
          ) : (
            <>
              <h1 className="text-lg font-semibold text-text-primary">
                Reset your password
              </h1>
              <p className="mt-1 text-sm text-text-secondary">
                Enter the email you signed up with and we&apos;ll send you a
                link to choose a new password.
              </p>

              {error && (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <form action={handleSubmit} className="mt-5 space-y-5">
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-text-primary"
                  >
                    Email Address
                  </label>
                  <div className="relative mt-1.5">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                    <input
                      id="email"
                      name="email"
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="block w-full rounded-lg border border-border bg-surface py-2.5 pl-9 pr-4 text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      placeholder="you@example.com"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-sm hover:bg-primary-dark transition-colors disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sending Reset Link...
                    </>
                  ) : (
                    "Send Reset Link"
                  )}
                </button>
              </form>
            </>
          )}
        </div>

        {!submitted && (
          <p className="mt-6 text-center text-sm text-text-muted">
            Remembered your password?{" "}
            <Link
              href="/login"
              className="font-semibold text-primary hover:text-primary-dark transition-colors"
            >
              Sign in here
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
