import {
  FolderOpen,
  ClipboardList,
  UserPlus,
  Flag,
  CheckCircle2,
} from "lucide-react";

export interface ActivityItem {
  id: string;
  type: "project" | "bid" | "signup" | "flag" | "resolve";
  title: string;
  detail: string;
  time: string;
}

const ICONS = {
  project: FolderOpen,
  bid: ClipboardList,
  signup: UserPlus,
  flag: Flag,
  resolve: CheckCircle2,
};

const COLORS = {
  project: "bg-primary/10 text-primary",
  bid: "bg-secondary/10 text-secondary",
  signup: "bg-blue-100 text-blue-600",
  flag: "bg-red-100 text-red-600",
  resolve: "bg-green-100 text-green-600",
};

export default function ActivityFeed({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-text-muted">
        No recent activity.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const Icon = ICONS[item.type];
        const color = COLORS[item.type];
        return (
          <div key={item.id} className="flex items-start gap-3">
            <div
              className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${color}`}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-text-primary">
                {item.title}
              </p>
              <p className="text-xs text-text-muted">{item.detail}</p>
            </div>
            <span className="shrink-0 text-xs text-text-muted">
              {item.time}
            </span>
          </div>
        );
      })}
    </div>
  );
}
