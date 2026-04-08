"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Bell,
  ClipboardList,
  MessageSquare,
  AlertTriangle,
  CheckCheck,
  Users,
} from "lucide-react";
import {
  markNotificationRead,
  markAllNotificationsRead,
} from "@/app/(dashboard)/notifications/actions";

interface NotificationData {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  created_at: string;
}

const TYPE_ICONS: Record<string, typeof Bell> = {
  new_bid: ClipboardList,
  new_message: MessageSquare,
  project_awarded: CheckCheck,
  project_closed: AlertTriangle,
  bid_not_selected: AlertTriangle,
  contractor_search_alert: Users,
  estimate_clarification_needed: AlertTriangle,
  estimate_ready: CheckCheck,
  estimate_stale_after_edit: AlertTriangle,
};

export default function NotificationsList({
  notifications: initial,
  basePath,
}: {
  notifications: NotificationData[];
  basePath: string;
}) {
  const [notifications, setNotifications] = useState(initial);

  async function handleMarkAllRead() {
    await markAllNotificationsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  async function handleClick(id: string) {
    await markNotificationRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div>
      {unreadCount > 0 && (
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-text-muted">
            {unreadCount} unread notification{unreadCount !== 1 ? "s" : ""}
          </p>
          <button
            onClick={handleMarkAllRead}
            className="text-sm font-medium text-primary hover:text-primary-dark transition-colors"
          >
            Mark all as read
          </button>
        </div>
      )}

      {notifications.length > 0 ? (
        <div className="rounded-xl border border-border bg-surface shadow-sm divide-y divide-border">
          {notifications.map((notif) => {
            const Icon = TYPE_ICONS[notif.type] || Bell;
            const href = notif.link
              ? notif.link.startsWith("/customer") ||
                notif.link.startsWith("/bidder") ||
                notif.link.startsWith("/admin")
                ? notif.link
                : `${basePath}${notif.link.startsWith("/") ? "" : "/"}${notif.link}`
              : "#";

            return (
              <Link
                key={notif.id}
                href={href}
                onClick={() => handleClick(notif.id)}
                className={`flex items-start gap-4 px-6 py-4 transition-colors ${
                  notif.read
                    ? "hover:bg-surface-hover"
                    : "bg-bg-warm hover:bg-surface-hover"
                }`}
              >
                <div
                  className={`mt-0.5 flex h-9 w-9 items-center justify-center rounded-full shrink-0 ${
                    notif.read
                      ? "bg-gray-100 text-text-muted"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3
                      className={`text-sm ${
                        notif.read
                          ? "font-medium text-text-secondary"
                          : "font-semibold text-text-primary"
                      }`}
                    >
                      {notif.title}
                    </h3>
                    {!notif.read && (
                      <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-text-muted">
                    {notif.message}
                  </p>
                  <p className="mt-1 text-xs text-text-muted">
                    {new Date(notif.created_at).toLocaleString()}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface py-16 text-center shadow-sm">
          <Bell className="mx-auto h-12 w-12 text-text-muted/40" />
          <p className="mt-4 text-lg font-medium text-text-secondary">
            All caught up!
          </p>
          <p className="mt-1 text-sm text-text-muted">
            No notifications yet. Activity will show up here.
          </p>
        </div>
      )}
    </div>
  );
}
