"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import {
  LayoutDashboard,
  FolderOpen,
  ClipboardList,
  MessageSquare,
  Bell,
  User,
  LogOut,
  Shield,
  Users,
  BarChart3,
  Flag,
  ScrollText,
  X,
  Star,
  BadgeDollarSign,
  Scale,
} from "lucide-react";
import { signOut } from "@/app/(auth)/actions";
import type { UserRole } from "@/types/database";
import { BrandWordmark } from "@/components/BrandWordmark";
import RoleSwitcher from "@/components/layout/RoleSwitcher";

interface DashboardNavProps {
  currentRole: UserRole;
  availableRoles: UserRole[];
  userName: string;
  unreadNotifications?: number;
  isMobileOpen?: boolean;
  onClose?: () => void;
}

const NAV_ITEMS: Record<UserRole, { href: string; label: string; icon: typeof LayoutDashboard }[]> = {
  customer: [
    { href: "/customer", label: "Dashboard", icon: LayoutDashboard },
    { href: "/customer/projects", label: "My Projects", icon: FolderOpen },
    { href: "/customer/contractors", label: "Find Contractors", icon: Users },
    { href: "/customer/messages", label: "Messages", icon: MessageSquare },
    { href: "/customer/profile", label: "Profile", icon: User },
  ],
  bidder: [
    { href: "/bidder", label: "Dashboard", icon: LayoutDashboard },
    { href: "/bidder/bids", label: "My Bids", icon: ClipboardList },
    { href: "/bidder/projects", label: "Browse Projects", icon: FolderOpen },
    { href: "/bidder/messages", label: "Messages", icon: MessageSquare },
    { href: "/bidder/credentials", label: "Credentials", icon: Shield },
    { href: "/bidder/profile", label: "Profile", icon: User },
  ],
  admin: [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/projects", label: "All Projects", icon: FolderOpen },
    { href: "/admin/bids", label: "All Bids", icon: ClipboardList },
    { href: "/admin/users", label: "Users", icon: Users },
    { href: "/admin/messages", label: "Messages", icon: MessageSquare },
    { href: "/admin/flags", label: "Flagged Content", icon: Flag },
    { href: "/admin/reviews", label: "Reviews", icon: Star },
    { href: "/admin/paid-estimates", label: "Paid Estimates", icon: BadgeDollarSign },
    { href: "/admin/disputes", label: "Disputes", icon: Scale },
    { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
    { href: "/admin/audit", label: "Audit Log", icon: ScrollText },
  ],
};

export default function DashboardNav({
  currentRole,
  availableRoles,
  userName,
  unreadNotifications = 0,
  isMobileOpen = false,
  onClose,
}: DashboardNavProps) {
  const pathname = usePathname();
  const items = NAV_ITEMS[currentRole];

  return (
    <nav
      id="dashboard-navigation"
      className={`fixed inset-y-0 left-0 z-40 flex h-full w-[85vw] max-w-72 flex-col border-r border-border bg-surface shadow-2xl transition-transform duration-300 ease-out lg:static lg:h-screen lg:w-64 lg:max-w-none lg:translate-x-0 lg:shadow-none ${
        isMobileOpen ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      {/* Logo */}
      <div className="border-b border-border px-6 py-4">
        <div className="mb-3 flex items-center justify-end lg:hidden">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
            aria-label="Close navigation menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <Link href="/" className="flex flex-col items-center gap-2">
          <Image
            src="/logo-mark.png"
            alt="projectxbidx"
            width={768}
            height={768}
            className="h-32 w-auto max-w-full object-contain px-1"
          />
          <BrandWordmark
            asLink={false}
            className="h-[18px] w-auto max-w-full object-contain px-0.5"
          />
        </Link>
      </div>

      {/* User Info */}
      <div className="border-b border-border px-6 py-4">
        <p className="text-sm font-medium text-text-primary truncate">
          {userName}
        </p>
        <p className="text-xs text-text-muted capitalize">{currentRole} Account</p>
        <div className="mt-4">
          <RoleSwitcher
            availableRoles={availableRoles}
            currentRole={currentRole}
          />
        </div>
      </div>

      {/* Nav Links */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {items.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== `/${currentRole}` && pathname.startsWith(item.href));

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onClose}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
                  }`}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Notifications & Sign Out */}
      <div className="border-t border-border px-3 py-4 space-y-1">
        <Link
          href={`/${currentRole}/notifications`}
          onClick={onClose}
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors"
        >
          <Bell className="h-5 w-5 shrink-0" />
          Notifications
          {unreadNotifications > 0 && (
            <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-slate-950">
              {unreadNotifications}
            </span>
          )}
        </Link>
        <form action={signOut}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-text-secondary hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <LogOut className="h-5 w-5 shrink-0" />
            Sign Out
          </button>
        </form>
      </div>
    </nav>
  );
}
