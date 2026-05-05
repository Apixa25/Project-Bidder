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
  WalletCards,
  CreditCard,
  LibraryBig,
  PackagePlus,
  ReceiptText,
  MapPin,
} from "lucide-react";
import { signOut } from "@/app/(auth)/actions";
import type { UserRole } from "@/types/database";
import { BrandWordmark } from "@/components/BrandWordmark";
import RoleSwitcher from "@/components/layout/RoleSwitcher";

interface DashboardNavProps {
  currentRole: UserRole;
  availableRoles: UserRole[];
  userName: string;
  avatarUrl?: string | null;
  unreadNotifications?: number;
  isMobileOpen?: boolean;
  isMobileViewport?: boolean;
  onClose?: () => void;
}

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
};

type NavGroup = {
  // null = no header rendered (used for the top "Working" group, which is the
  // most-used links and doesn't need a label).
  label: string | null;
  items: NavItem[];
};

// Sidebar items are grouped into visual sections (Working / Setup / Tools)
// so the most-used links float to the top and the rest cluster by purpose.
// See the App Usability Audit conversation — this replaces the old flat list
// that had grown to 10–11 items per role and felt like a wall of text.
const NAV_GROUPS: Record<UserRole, NavGroup[]> = {
  customer: [
    {
      label: null,
      items: [
        { href: "/customer", label: "Dashboard", icon: LayoutDashboard },
        { href: "/customer/projects", label: "My Projects", icon: FolderOpen },
        { href: "/customer/bids", label: "Incoming Bids", icon: ClipboardList },
        { href: "/customer/messages", label: "Messages", icon: MessageSquare },
      ],
    },
    {
      label: "Tools",
      items: [
        { href: "/customer/contractors", label: "Find Contractors", icon: Users },
        { href: "/address-quotes", label: "Look Up an Address", icon: MapPin },
        {
          href: "/customer/address-requests",
          label: "My Quick Quote Requests",
          icon: BadgeDollarSign,
        },
        { href: "/estimate-packages", label: "Estimate Library", icon: LibraryBig },
        {
          href: "/estimate-packages/purchases",
          label: "My Estimate Packages",
          icon: ReceiptText,
        },
      ],
    },
    {
      label: "Account",
      items: [
        { href: "/customer/profile", label: "Profile", icon: User },
      ],
    },
  ],
  bidder: [
    {
      label: null,
      items: [
        { href: "/bidder", label: "Dashboard", icon: LayoutDashboard },
        { href: "/bidder/projects", label: "Browse Projects", icon: FolderOpen },
        { href: "/bidder/bids", label: "My Bids", icon: ClipboardList },
        { href: "/bidder/messages", label: "Messages", icon: MessageSquare },
      ],
    },
    {
      label: "Tools",
      items: [
        { href: "/bidder/address-quotes", label: "My Quick Quotes", icon: MapPin },
        {
          href: "/bidder/address-requests",
          label: "Open Quick Quote Requests",
          icon: BadgeDollarSign,
        },
        { href: "/estimate-packages", label: "Estimate Library", icon: LibraryBig },
        {
          href: "/estimate-packages/purchases",
          label: "My Estimate Packages",
          icon: ReceiptText,
        },
      ],
    },
    {
      label: "Setup",
      items: [
        { href: "/bidder/credentials", label: "Credentials", icon: Shield },
        { href: "/bidder/payouts", label: "Payouts", icon: WalletCards },
        { href: "/bidder/profile", label: "Profile", icon: User },
      ],
    },
  ],
  estimator: [
    {
      label: null,
      items: [
        { href: "/estimator", label: "Dashboard", icon: LayoutDashboard },
        { href: "/estimator/requests", label: "Estimate Requests", icon: PackagePlus },
        { href: "/estimator/packages", label: "My Packages", icon: LibraryBig },
        { href: "/estimator/messages", label: "Messages", icon: MessageSquare },
      ],
    },
    {
      label: "Tools",
      items: [
        { href: "/estimate-packages/purchases", label: "My Purchases", icon: ReceiptText },
      ],
    },
    {
      label: "Setup",
      items: [
        { href: "/estimator/payouts", label: "Payouts", icon: WalletCards },
        { href: "/estimator/profile", label: "Profile", icon: User },
      ],
    },
  ],
  admin: [
    {
      label: null,
      items: [
        { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
        { href: "/admin/projects", label: "All Projects", icon: FolderOpen },
        { href: "/admin/bids", label: "All Bids", icon: ClipboardList },
        { href: "/admin/users", label: "Users", icon: Users },
        { href: "/admin/messages", label: "Messages", icon: MessageSquare },
      ],
    },
    {
      label: "Moderation",
      items: [
        { href: "/admin/flags", label: "Flagged Content", icon: Flag },
        { href: "/admin/reviews", label: "Reviews", icon: Star },
        { href: "/admin/disputes", label: "Disputes", icon: Scale },
      ],
    },
    {
      label: "Tools",
      items: [
        { href: "/admin/paid-estimates", label: "Paid Estimates", icon: BadgeDollarSign },
        { href: "/admin/address-quotes", label: "Quick Quotes", icon: MapPin },
        { href: "/admin/estimate-packages", label: "Estimate Packages", icon: LibraryBig },
        { href: "/admin/estimate-requests", label: "Estimate Requests", icon: PackagePlus },
      ],
    },
    {
      label: "Platform",
      items: [
        { href: "/admin/stripe", label: "Stripe Readiness", icon: CreditCard },
        { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
        { href: "/admin/audit", label: "Audit Log", icon: ScrollText },
      ],
    },
  ],
};

export default function DashboardNav({
  currentRole,
  availableRoles,
  userName,
  avatarUrl = null,
  unreadNotifications = 0,
  isMobileOpen = false,
  isMobileViewport = false,
  onClose,
}: DashboardNavProps) {
  const pathname = usePathname();
  const groups = NAV_GROUPS[currentRole];
  const profileHref = `/${currentRole}/profile`;
  const userInitials = userName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <nav
      id="dashboard-navigation"
      className={`z-40 flex flex-col border-r border-border bg-surface transition-transform duration-300 ease-out ${
        isMobileViewport
          ? "fixed inset-y-0 left-0 h-full w-[85vw] max-w-72 shadow-2xl"
          : "sticky top-0 h-screen w-64 shrink-0 shadow-none"
      } ${
        !isMobileViewport || isMobileOpen ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      {/* Logo */}
      <div className="border-b border-border px-6 py-4">
        {isMobileViewport && (
        <div className="mb-3 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
            aria-label="Close navigation menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        )}
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
        <div className="flex items-center gap-3">
          <Link
            href={profileHref}
            onClick={onClose}
            aria-label="Open profile"
            className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border border-border bg-bg-warm transition-transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt={userName}
                fill
                sizes="48px"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/15 to-secondary/15 text-sm font-semibold text-text-primary">
                {userInitials}
              </div>
            )}
          </Link>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-text-primary">
              {userName}
            </p>
            <p className="text-xs text-text-muted capitalize">{currentRole} Account</p>
          </div>
        </div>
        <div className="mt-4">
          <RoleSwitcher
            availableRoles={availableRoles}
            currentRole={currentRole}
          />
        </div>
      </div>

      {/* Nav Links — grouped into visual sections so the sidebar isn't a
          single 10–11 item wall. The first group has no header (it's the
          most-used links). Subsequent groups use a small uppercase label. */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        {groups.map((group, groupIndex) => (
          <div
            key={group.label ?? `group-${groupIndex}`}
            className={groupIndex > 0 ? "mt-5" : ""}
          >
            {group.label && (
              <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">
                {group.label}
              </p>
            )}
            <ul className="space-y-1">
              {group.items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== `/${currentRole}` &&
                    pathname.startsWith(item.href));

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onClose}
                      className={`nav-btn-glow flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${
                        isActive
                          ? "bg-accent-light/10 text-accent-light"
                          : "text-text-secondary"
                      }`}
                    >
                      <item.icon className="nav-btn-glow-icon h-5 w-5 shrink-0" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {/* Notifications & Sign Out */}
      <div className="border-t border-border px-3 py-4 space-y-1">
        <Link
          href={`/${currentRole}/notifications`}
          onClick={onClose}
          className="nav-btn-glow flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-text-secondary"
        >
          <Bell className="nav-btn-glow-icon h-5 w-5 shrink-0" />
          Notifications
          {unreadNotifications > 0 && (
            <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-light px-1.5 text-xs font-bold text-white">
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
