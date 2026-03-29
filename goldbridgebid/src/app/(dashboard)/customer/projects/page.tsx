import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Plus, FolderOpen, MapPin, Calendar, ImageIcon } from "lucide-react";
import { TRADE_LABELS } from "@/types/database";
import type { TradeCategory } from "@/types/database";
import { userHasRole } from "@/lib/auth/roles";

export default async function MyProjectsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  if (!(await userHasRole(user.id, "customer"))) redirect("/login");

  const { data: projects } = await supabase
    .from("projects")
    .select("*, project_files(id, file_url, thumbnail_url, file_type, annotated_url)")
    .eq("customer_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            My Projects 📋
          </h1>
          <p className="mt-1 text-text-secondary">
            Manage all your posted projects and view incoming bids.
          </p>
        </div>
        <Link
          href="/customer/projects/new"
          className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-sm hover:bg-primary-dark transition-colors"
        >
          <Plus className="h-4 w-4" />
          Post New Project
        </Link>
      </div>

      {projects && projects.length > 0 ? (
        <div className="space-y-4">
          {projects.map((project) => {
            const imageFiles = (project.project_files || []).filter(
              (f: { file_type: string }) => f.file_type.startsWith("image/")
            );
            const firstImage = imageFiles[0] as
              | { thumbnail_url: string | null; annotated_url: string | null; file_url: string }
              | undefined;
            const thumbUrl = firstImage
              ? firstImage.annotated_url || firstImage.thumbnail_url || firstImage.file_url
              : null;

            return (
            <Link
              key={project.id}
              href={`/customer/projects/${project.id}`}
              className="block rounded-xl border border-border bg-surface p-6 shadow-sm hover:shadow-md hover:border-primary/30 transition-all"
            >
              <div className="flex items-start gap-5">
                {/* Project Thumbnail */}
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-border bg-bg-warm">
                  {thumbUrl ? (
                    <img
                      src={thumbUrl}
                      alt={project.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <ImageIcon className="h-8 w-8 text-text-muted/40" />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-semibold text-text-primary truncate">
                      {project.title}
                    </h2>
                    <span
                      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        project.status === "open"
                          ? "bg-green-100 text-green-700"
                          : project.status === "awarded"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {project.status === "open"
                        ? "Open"
                        : project.status === "awarded"
                          ? "Awarded"
                          : "Closed"}
                    </span>
                  </div>

                  <p className="mt-2 text-sm text-text-secondary line-clamp-2">
                    {project.description}
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-text-muted">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {project.location_city}, {project.location_state}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      Posted{" "}
                      {new Date(project.created_at).toLocaleDateString()}
                    </span>
                    {project.budget_max && (
                      <span>
                        Budget: ${Number(project.budget_min || 0).toLocaleString()} –
                        ${Number(project.budget_max).toLocaleString()}
                      </span>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {(project.trades as TradeCategory[]).map((trade) => (
                      <span
                        key={trade}
                        className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
                      >
                        {TRADE_LABELS[trade]}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="ml-6 text-center shrink-0">
                  <p className="text-3xl font-bold text-text-primary">
                    {project.bid_count}
                  </p>
                  <p className="text-xs text-text-muted">
                    {project.bid_count === 1 ? "bid" : "bids"}
                  </p>
                </div>
              </div>
            </Link>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface py-16 text-center shadow-sm">
          <FolderOpen className="mx-auto h-12 w-12 text-text-muted/40" />
          <p className="mt-4 text-lg font-medium text-text-secondary">
            No projects yet
          </p>
          <p className="mt-1 text-sm text-text-muted">
            Post your first project and start receiving bids from qualified
            contractors!
          </p>
          <Link
            href="/customer/projects/new"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-slate-950 shadow-sm hover:bg-primary-dark transition-colors"
          >
            <Plus className="h-4 w-4" />
            Post Your First Project
          </Link>
        </div>
      )}
    </div>
  );
}
