"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import type { UserRole } from "@/types/database";
import DashboardNav from "@/components/layout/DashboardNav";

interface DashboardShellProps {
  defaultRole: UserRole;
  availableRoles: UserRole[];
  userName: string;
  avatarUrl?: string | null;
  unreadNotifications?: number;
  children: ReactNode;
}

export default function DashboardShell({
  defaultRole,
  availableRoles,
  userName,
  avatarUrl = null,
  unreadNotifications = 0,
  children,
}: DashboardShellProps) {
  const pathname = usePathname();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  const currentRole = pathname.startsWith("/bidder")
    ? "bidder"
    : pathname.startsWith("/admin")
      ? "admin"
      : pathname.startsWith("/customer")
        ? "customer"
        : defaultRole;

  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isMobileNavOpen) {
      return undefined;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isMobileNavOpen]);

  return (
    <div className="flex min-h-screen">
      <button
        type="button"
        onClick={() => setIsMobileNavOpen(false)}
        aria-label="Close navigation overlay"
        className={`fixed inset-0 z-30 bg-stone-950/40 backdrop-blur-[1px] transition-opacity duration-300 lg:hidden ${
          isMobileNavOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        }`}
      />

      <DashboardNav
        currentRole={currentRole}
        availableRoles={availableRoles}
        userName={userName}
        avatarUrl={avatarUrl}
        unreadNotifications={unreadNotifications}
        isMobileOpen={isMobileNavOpen}
        onClose={() => setIsMobileNavOpen(false)}
      />

      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-gradient-to-br from-accent via-secondary-dark to-slate-950 lg:min-h-screen">
        <div
          className="pointer-events-none absolute inset-0 bg-[url('/grid.svg')] bg-[length:40px_40px] opacity-10 text-white"
          aria-hidden
        />
        <header className="relative z-20 sticky top-0 border-b border-border bg-surface/95 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <Link
                href={`/${currentRole}/profile`}
                className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-border bg-bg-warm transition-transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-primary/30"
                aria-label="Open profile"
              >
                {avatarUrl ? (
                  <Image
                    src={avatarUrl}
                    alt={userName}
                    fill
                    sizes="40px"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/15 to-secondary/15 text-xs font-semibold text-text-primary">
                    {userName
                      .split(" ")
                      .map((part) => part[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2)}
                  </div>
                )}
              </Link>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-text-primary">
                  {userName}
                </p>
                <p className="text-xs capitalize text-text-muted">{currentRole} account</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsMobileNavOpen(true)}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-text-primary shadow-sm transition-colors hover:bg-surface-hover"
              aria-expanded={isMobileNavOpen}
              aria-controls="dashboard-navigation"
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>

          <div className="border-t border-border px-4 py-2">
            <Link
              href={`/${currentRole}`}
              className="text-xs font-medium text-accent-light transition-colors hover:text-accent"
            >
              Back to dashboard overview
            </Link>
          </div>
        </header>

        <main className="relative z-10 min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8 [&_h1.text-text-primary]:text-white [&_h1.text-text-primary+p.text-text-secondary]:text-zinc-200/90">
            {children}
          </div>
        </main>

        <footer className="relative z-10 border-t border-white/10 px-4 py-4 sm:px-6">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-3 text-xs text-zinc-400">
            <Link href="/" className="transition-colors hover:text-white">
              Home
            </Link>
            <span aria-hidden="true">&middot;</span>
            <Link
              href="/how-it-works"
              className="transition-colors hover:text-white"
            >
              How It Works
            </Link>
            <span aria-hidden="true">&middot;</span>
            <Link
              href="/terms"
              className="transition-colors hover:text-white"
            >
              Terms of Service
            </Link>
            <span aria-hidden="true">&middot;</span>
            <Link
              href="/privacy"
              className="transition-colors hover:text-white"
            >
              Privacy Policy
            </Link>
            <span aria-hidden="true">&middot;</span>
            <span>
              &copy; {new Date().getFullYear()} projectxbidx
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}
