"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import type { UserRole } from "@/types/database";
import DashboardNav from "@/components/layout/DashboardNav";

interface DashboardShellProps {
  role: UserRole;
  userName: string;
  unreadNotifications?: number;
  children: ReactNode;
}

export default function DashboardShell({
  role,
  userName,
  unreadNotifications = 0,
  children,
}: DashboardShellProps) {
  const pathname = usePathname();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

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
    <div className="flex min-h-screen bg-bg-warm">
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
        role={role}
        userName={userName}
        unreadNotifications={unreadNotifications}
        isMobileOpen={isMobileNavOpen}
        onClose={() => setIsMobileNavOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-border bg-surface/95 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-text-primary">
                {userName}
              </p>
              <p className="text-xs capitalize text-text-muted">{role} account</p>
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
              href={`/${role}`}
              className="text-xs font-medium text-primary transition-colors hover:text-primary-dark"
            >
              Back to dashboard overview
            </Link>
          </div>
        </header>

        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
