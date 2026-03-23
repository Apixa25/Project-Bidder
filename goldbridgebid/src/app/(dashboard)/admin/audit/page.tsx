import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AdminFilterBar, { FilterDropdown } from "@/components/admin/AdminFilters";
import AdminPagination from "@/components/admin/AdminPagination";
import {
  ShieldOff,
  ShieldCheck,
  Trash2,
  Lock,
  CheckCircle2,
  XCircle,
  Eye,
} from "lucide-react";

const PAGE_SIZE = 25;

interface Props {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

const ACTION_CONFIG: Record<
  string,
  { label: string; color: string; bgColor: string; icon: typeof ShieldOff }
> = {
  ban_user: {
    label: "Ban User",
    color: "text-red-700",
    bgColor: "bg-red-100",
    icon: ShieldOff,
  },
  unban_user: {
    label: "Unban User",
    color: "text-green-700",
    bgColor: "bg-green-100",
    icon: ShieldCheck,
  },
  delete_user: {
    label: "Delete User",
    color: "text-red-700",
    bgColor: "bg-red-100",
    icon: Trash2,
  },
  delete_project: {
    label: "Delete Project",
    color: "text-red-700",
    bgColor: "bg-red-100",
    icon: Trash2,
  },
  force_close_project: {
    label: "Force Close Project",
    color: "text-amber-700",
    bgColor: "bg-amber-100",
    icon: Lock,
  },
  delete_bid: {
    label: "Delete Bid",
    color: "text-red-700",
    bgColor: "bg-red-100",
    icon: Trash2,
  },
  delete_message: {
    label: "Delete Message",
    color: "text-red-700",
    bgColor: "bg-red-100",
    icon: Trash2,
  },
  resolve_flag: {
    label: "Resolve Flag",
    color: "text-green-700",
    bgColor: "bg-green-100",
    icon: CheckCircle2,
  },
  dismiss_flag: {
    label: "Dismiss Flag",
    color: "text-gray-700",
    bgColor: "bg-gray-100",
    icon: XCircle,
  },
};

const DEFAULT_ACTION = {
  label: "Action",
  color: "text-blue-700",
  bgColor: "bg-blue-100",
  icon: Eye,
};

export default async function AdminAuditPage({ searchParams }: Props) {
  const params = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();
  if (profile?.role !== "admin") redirect("/login");

  let query = supabase
    .from("admin_audit_logs")
    .select("*")
    .order("created_at", { ascending: false });

  if (params.action) {
    query = query.eq("action_type", params.action);
  }

  const { data: allLogs } = await query;

  // Fetch admin profiles
  const adminIds = [
    ...new Set((allLogs || []).map((l) => l.admin_id)),
  ];
  const { data: adminProfiles } =
    adminIds.length > 0
      ? await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", adminIds)
      : { data: [] };
  const adminMap = new Map(
    (adminProfiles || []).map((p) => [p.user_id, p.full_name])
  );

  const totalItems = (allLogs || []).length;
  const page = Math.max(1, Number(params.page || "1"));
  const paginated = (allLogs || []).slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  const actionOptions = Object.entries(ACTION_CONFIG).map(([value, cfg]) => ({
    value,
    label: cfg.label,
  }));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">
          Audit Log 📜
        </h1>
        <p className="mt-1 text-text-secondary">
          {totalItems} admin action{totalItems !== 1 ? "s" : ""} recorded.
        </p>
      </div>

      <div className="mb-6">
        <AdminFilterBar>
          <FilterDropdown
            paramName="action"
            label="Action Type"
            options={actionOptions}
          />
        </AdminFilterBar>
      </div>

      <div className="space-y-3">
        {paginated.map((log) => {
          const config = ACTION_CONFIG[log.action_type] || DEFAULT_ACTION;
          const Icon = config.icon;
          const details = log.details as Record<string, unknown>;

          return (
            <div
              key={log.id}
              className="rounded-xl border border-border bg-surface p-4 shadow-sm"
            >
              <div className="flex items-start gap-3">
                <div
                  className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${config.bgColor}`}
                >
                  <Icon className={`h-4.5 w-4.5 ${config.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`inline-flex items-center rounded-full ${config.bgColor} px-2.5 py-0.5 text-xs font-medium ${config.color}`}
                    >
                      {config.label}
                    </span>
                    <span className="text-sm text-text-primary">
                      on{" "}
                      <span className="font-medium">
                        {log.target_type}
                      </span>
                    </span>
                    <span className="text-xs text-text-muted">
                      {log.target_id.slice(0, 8)}...
                    </span>
                  </div>

                  {/* Details */}
                  {Object.keys(details).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {Object.entries(details).map(([key, val]) =>
                        val ? (
                          <span
                            key={key}
                            className="rounded bg-bg-warm px-2 py-0.5 text-xs text-text-secondary"
                          >
                            {key.replace(/_/g, " ")}:{" "}
                            {String(val).length > 50
                              ? String(val).slice(0, 50) + "..."
                              : String(val)}
                          </span>
                        ) : null
                      )}
                    </div>
                  )}

                  <p className="mt-1 text-xs text-text-muted">
                    by {adminMap.get(log.admin_id) || "Unknown admin"} ·{" "}
                    {new Date(log.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          );
        })}

        {totalItems === 0 && (
          <div className="rounded-xl border border-border bg-surface py-12 text-center">
            <p className="text-sm text-text-muted">
              No audit log entries yet. Actions will be logged as admins use
              the platform management tools.
            </p>
          </div>
        )}
      </div>

      <AdminPagination totalItems={totalItems} pageSize={PAGE_SIZE} />
    </div>
  );
}
