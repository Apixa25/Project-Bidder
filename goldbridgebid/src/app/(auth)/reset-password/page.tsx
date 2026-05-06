"use client";

import Link from "next/link";
import { useState } from "react";
import Image from "next/image";
import { CheckCircle2, KeyRound, Loader2 } from "lucide-react";
import { updatePassword } from "../actions";
import { BrandWordmark } from "@/components/BrandWordmark";

export default function ResetPasswordPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    const result = await updatePassword(formData);
    setLoading(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setDone(true);
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
          <p className="mt-3 text-text-secondary">Set a new password</p>
        </div>

        <div className="rounded-xl border border-border bg-surface p-5 shadow-sm sm:p-8">
          {done ? (
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
              <h2 className="mt-4 text-lg font-semibold text-text-primary">
                Password updated
              </h2>
              <p className="mt-2 text-sm text-text-secondary">
                Your password has been changed. You can now sign in with your
                new password.
              </p>
              <Link
                href="/login"
                className="mt-6 inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-sm hover:bg-primary-dark transition-colors"
              >
                Continue to Sign In
              </Link>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <KeyRound className="h-5 w-5 text-primary" />
                </div>
                <h1 className="text-lg font-semibold text-text-primary">
                  Choose a new password
                </h1>
              </div>
              <p className="mt-2 text-sm text-text-secondary">
                Enter a new password for your account. Use at least 8
                characters and pick something you don&apos;t use anywhere else.
              </p>

              {error && (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <form action={handleSubmit} className="mt-5 space-y-5">
                <div>
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-text-primary"
                  >
                    New Password
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    className="mt-1.5 block w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="At least 8 characters"
                  />
                </div>

                <div>
                  <label
                    htmlFor="confirmPassword"
                    className="block text-sm font-medium text-text-primary"
                  >
                    Confirm New Password
                  </label>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    className="mt-1.5 block w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="Re-type your new password"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-sm hover:bg-primary-dark transition-colors disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Updating Password...
                    </>
                  ) : (
                    "Update Password"
                  )}
                </button>
              </form>

              <p className="mt-5 text-center text-xs text-text-muted">
                Reset link expired or didn&apos;t work?{" "}
                <Link
                  href="/forgot-password"
                  className="font-medium text-primary hover:text-primary-dark transition-colors"
                >
                  Request a new one
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
