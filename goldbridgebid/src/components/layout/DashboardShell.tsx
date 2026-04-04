"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import type { UserRole } from "@/types/database";
import DashboardNav from "@/components/layout/DashboardNav";

interface DashboardShellProps {
  defaultRole: UserRole;
  availableRoles: UserRole[];
  userName: string;
  unreadNotifications?: number;
  children: ReactNode;
}

export default function DashboardShell({
  defaultRole,
  availableRoles,
  userName,
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
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-text-primary">
                {userName}
              </p>
              <p className="text-xs capitalize text-text-muted">{currentRole} account</p>
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
      </div>
    </div>
  );
}
