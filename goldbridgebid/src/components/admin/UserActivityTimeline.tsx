"use client";

import Link from "next/link";
import {
  FolderOpen,
  ClipboardList,
  MessageSquare,
  Star,
  UserPlus,
  Shield,
  DollarSign,
} from "lucide-react";

export interface TimelineEvent {
  id: string;
  type: "signup" | "project" | "bid" | "message" | "review" | "credential" | "paid_estimate";
  title: string;
  detail: string;
  href?: string;
  timestamp: string;
}

const EVENT_ICONS = {
  signup: UserPlus,
  project: FolderOpen,
  bid: ClipboardList,
  message: MessageSquare,
  review: Star,
  credential: Shield,
  paid_estimate: DollarSign,
};

const EVENT_COLORS = {
  signup: "bg-blue-100 text-blue-600 border-blue-200",
  project: "bg-primary/10 text-primary border-primary/20",
  bid: "bg-secondary/10 text-secondary border-secondary/20",
  message: "bg-amber-100 text-amber-700 border-amber-200",
  review: "bg-purple-100 text-purple-600 border-purple-200",
  credential: "bg-green-100 text-green-600 border-green-200",
  paid_estimate: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

export default function UserActivityTimeline({
  events,
}: {
  events: TimelineEvent[];
}) {
  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface py-12 text-center shadow-sm">
        <p className="text-sm text-text-muted">No activity recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />
      <div className="space-y-1">
        {events.map((event) => {
          const Icon = EVENT_ICONS[event.type];
          const color = EVENT_COLORS[event.type];
          return (
            <div key={event.id} className="relative flex gap-4 pl-1">
              <div
                className={`relative z-10 mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${color}`}
              >
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1 rounded-lg border border-border bg-surface px-4 py-3 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    {event.href ? (
                      <Link
                        href={event.href}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        {event.title}
                      </Link>
                    ) : (
                      <p className="text-sm font-medium text-text-primary">
                        {event.title}
                      </p>
                    )}
                    <p className="mt-0.5 text-xs text-text-muted">
                      {event.detail}
                    </p>
                  </div>
                  <time className="shrink-0 text-[11px] text-text-muted">
                    {new Date(event.timestamp).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                    {" "}
                    {new Date(event.timestamp).toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </time>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
