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
} from "lucide-react";
import { signOut } from "@/app/(auth)/actions";
import type { UserRole } from "@/types/database";

interface DashboardNavProps {
  role: UserRole;
  userName: string;
  unreadNotifications?: number;
}

const NAV_ITEMS: Record<UserRole, { href: string; label: string; icon: typeof LayoutDashboard }[]> = {
  customer: [
    { href: "/customer", label: "Dashboard", icon: LayoutDashboard },
    { href: "/customer/projects", label: "My Projects", icon: FolderOpen },
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
    { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
    { href: "/admin/audit", label: "Audit Log", icon: ScrollText },
  ],
};

export default function DashboardNav({
  role,
  userName,
  unreadNotifications = 0,
}: DashboardNavProps) {
  const pathname = usePathname();
  const items = NAV_ITEMS[role];

  return (
    <nav className="flex h-screen w-64 flex-col border-r border-border bg-surface">
      {/* Logo */}
      <div className="border-b border-border px-6 py-4">
        <Link href="/" className="flex flex-col items-center gap-2">
          <Image
            src="/logo.png"
            alt="Gold Bridge Bid"
            width={144}
            height={144}
            className="rounded-full"
          />
          <span className="text-lg font-bold text-text-primary">
            Gold<span className="text-primary">Bridge</span>Bid
          </span>
        </Link>
      </div>

      {/* User Info */}
      <div className="border-b border-border px-6 py-4">
        <p className="text-sm font-medium text-text-primary truncate">
          {userName}
        </p>
        <p className="text-xs text-text-muted capitalize">{role} Account</p>
      </div>

      {/* Nav Links */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {items.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== `/${role}` && pathname.startsWith(item.href));

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
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
          href={`/${role}/notifications`}
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors"
        >
          <Bell className="h-5 w-5 shrink-0" />
          Notifications
          {unreadNotifications > 0 && (
            <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-white">
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
