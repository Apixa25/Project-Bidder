import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Search, User, FolderOpen, ClipboardList, MessageSquare } from "lucide-react";
import AdminSearchBar from "@/components/admin/AdminSearchBar";

const TYPE_ICONS: Record<string, typeof User> = {
  user: User,
  project: FolderOpen,
  bid: ClipboardList,
  message: MessageSquare,
};

const TYPE_COLORS: Record<string, string> = {
  user: "bg-blue-100 text-blue-600",
  project: "bg-primary/10 text-primary",
  bid: "bg-secondary/10 text-secondary",
  message: "bg-amber-100 text-amber-700",
};

interface SearchResult {
  type: string;
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

interface Props {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

export default async function AdminSearchPage({ searchParams }: Props) {
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

  const query = params.q?.trim() || "";
  const results: SearchResult[] = [];

  if (query.length >= 2) {
    const q = `%${query}%`;
    const [
      { data: users },
      { data: projects },
      { data: bids },
      { data: messages },
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("user_id, full_name, email, business_name, role")
        .or(`full_name.ilike.${q},email.ilike.${q},business_name.ilike.${q}`)
        .limit(15),
      supabase
        .from("projects")
        .select("id, title, location_city, location_state, status")
        .or(`title.ilike.${q},description.ilike.${q}`)
        .limit(15),
      supabase
        .from("bids")
        .select("id, project_id, price, trade, projects!bids_project_id_fkey(title)")
        .or(`trade.ilike.${q}`)
        .limit(10),
      supabase
        .from("messages")
        .select("id, content, project_id")
        .ilike("content", q)
        .limit(10),
    ]);

    for (const u of users || []) {
      results.push({
        type: "user",
        id: u.user_id,
        title: u.full_name,
        subtitle: `${u.role} · ${u.email}`,
        href: `/admin/users/${u.user_id}`,
      });
    }
    for (const p of projects || []) {
      results.push({
        type: "project",
        id: p.id,
        title: p.title,
        subtitle: `${p.status} · ${p.location_city || ""}, ${p.location_state || ""}`,
        href: `/admin/projects/${p.id}`,
      });
    }
    for (const b of bids || []) {
      const proj = b.projects as unknown as { title: string } | null;
      results.push({
        type: "bid",
        id: b.id,
        title: `$${Number(b.price).toLocaleString()} bid`,
        subtitle: proj?.title || b.trade || "Unknown project",
        href: `/admin/projects/${b.project_id}`,
      });
    }
    for (const m of messages || []) {
      results.push({
        type: "message",
        id: m.id,
        title: m.content.length > 100 ? m.content.slice(0, 100) + "..." : m.content,
        subtitle: "Message",
        href: `/admin/messages?q=${m.id}`,
      });
    }
  }

  const grouped = {
    user: results.filter((r) => r.type === "user"),
    project: results.filter((r) => r.type === "project"),
    bid: results.filter((r) => r.type === "bid"),
    message: results.filter((r) => r.type === "message"),
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">
          Search 🔍
        </h1>
        <p className="mt-1 text-text-secondary">
          Search across all users, projects, bids, and messages.
        </p>
      </div>

      <div className="mb-6 max-w-lg">
        <AdminSearchBar placeholder="Search everything..." />
      </div>

      {query.length >= 2 && results.length === 0 && (
        <div className="rounded-xl border border-border bg-surface py-12 text-center shadow-sm">
          <Search className="mx-auto h-10 w-10 text-text-muted" />
          <p className="mt-3 text-sm text-text-muted">
            No results for &ldquo;{query}&rdquo;
          </p>
        </div>
      )}

      {query.length < 2 && (
        <div className="rounded-xl border border-border bg-surface py-12 text-center shadow-sm">
          <Search className="mx-auto h-10 w-10 text-text-muted" />
          <p className="mt-3 text-sm text-text-muted">
            Enter at least 2 characters to search.
          </p>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-6">
          {(["user", "project", "bid", "message"] as const).map((type) => {
            const items = grouped[type];
            if (items.length === 0) return null;
            const Icon = TYPE_ICONS[type];
            const labels: Record<string, string> = {
              user: "Users",
              project: "Projects",
              bid: "Bids",
              message: "Messages",
            };
            return (
              <div key={type}>
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-text-muted">
                  <Icon className="h-4 w-4" />
                  {labels[type]} ({items.length})
                </h2>
                <div className="rounded-xl border border-border bg-surface shadow-sm divide-y divide-border">
                  {items.map((r) => {
                    const color = TYPE_COLORS[r.type];
                    const RIcon = TYPE_ICONS[r.type];
                    return (
                      <Link
                        key={r.id}
                        href={r.href}
                        className="flex items-center gap-3 px-5 py-3 hover:bg-surface-hover transition-colors"
                      >
                        <div
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${color}`}
                        >
                          <RIcon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-text-primary">
                            {r.title}
                          </p>
                          <p className="truncate text-xs text-text-muted">
                            {r.subtitle}
                          </p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
