"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import Image from "next/image";
import { FileText, ClipboardCheck, Loader2 } from "lucide-react";
import { signup, signInWithGoogle } from "../actions";
import { BrandWordmark } from "@/components/BrandWordmark";

function SignupForm() {
  const searchParams = useSearchParams();
  const defaultRole = searchParams.get("role") || "customer";
  const [role, setRole] = useState<"customer" | "bidder">(
    defaultRole === "bidder" ? "bidder" : "customer"
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    formData.set("role", role);
    const result = await signup(formData);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  async function handleGoogleSignup() {
    setLoading(true);
    setError(null);
    const result = await signInWithGoogle(role);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="mb-8 text-center">
        <Link href="/" className="inline-flex flex-col items-center gap-2">
          <Image
            src="/logo-mark.png"
            alt="projectxbidx"
            width={512}
            height={512}
            className="h-48 w-auto max-w-[560px] object-contain"
          />
          <BrandWordmark
            asLink={false}
            className="mx-auto h-12 w-auto max-w-[min(100%,360px)] object-contain"
          />
        </Link>
        <p className="mt-3 text-text-secondary">Create your account</p>
      </div>

      {/* Role Selection */}
      <div className="mb-6 grid grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => setRole("customer")}
          className={`group flex flex-col items-center gap-3 rounded-xl border-2 p-6 text-center transition-all ${
            role === "customer"
              ? "border-primary bg-primary/5"
              : "border-border bg-surface hover:border-primary/40"
          }`}
        >
          <FileText
            className={`h-8 w-8 ${role === "customer" ? "text-primary" : "text-text-muted"}`}
          />
          <span className="text-sm font-semibold text-text-primary">
            I Have a Project
          </span>
          <span className="text-xs text-text-muted">Customer Account</span>
        </button>
        <button
          type="button"
          onClick={() => setRole("bidder")}
          className={`group flex flex-col items-center gap-3 rounded-xl border-2 p-6 text-center transition-all ${
            role === "bidder"
              ? "border-secondary bg-secondary/5"
              : "border-border bg-surface hover:border-secondary/40"
          }`}
        >
          <ClipboardCheck
            className={`h-8 w-8 ${role === "bidder" ? "text-secondary" : "text-text-muted"}`}
          />
          <span className="text-sm font-semibold text-text-primary">
            I&apos;m a Contractor
          </span>
          <span className="text-xs text-text-muted">Bidder Account</span>
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-border bg-surface p-8 shadow-sm">
        <form action={handleSubmit} className="space-y-5">
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

          {role === "bidder" && (
            <div>
              <label
                htmlFor="businessName"
                className="block text-sm font-medium text-text-primary"
              >
                Business Name{" "}
                <span className="text-text-muted">(optional)</span>
              </label>
              <input
                id="businessName"
                name="businessName"
                type="text"
                className="mt-1.5 block w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="Smith Electrical LLC"
              />
            </div>
          )}

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
              placeholder="123 Main St, Crescent City, CA 95531"
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
              minLength={6}
              className="mt-1.5 block w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="••••••••"
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
                Creating Account...
              </>
            ) : (
              `Create ${role === "customer" ? "Customer" : "Contractor"} Account`
            )}
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
          onClick={handleGoogleSignup}
          disabled={loading}
          className="flex w-full items-center justify-center gap-3 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-medium text-text-primary shadow-sm hover:bg-surface-hover transition-colors disabled:opacity-60"
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
  );
}

export default function SignupPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg-warm px-4 py-12">
      <Suspense
        fallback={
          <div className="flex items-center gap-2 text-text-muted">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading...
          </div>
        }
      >
        <SignupForm />
      </Suspense>
    </div>
  );
}
