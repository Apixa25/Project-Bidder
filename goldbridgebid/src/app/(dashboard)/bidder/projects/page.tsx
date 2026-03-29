import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { MapPin, Calendar, DollarSign, Search, ImageIcon } from "lucide-react";
import { TRADE_LABELS } from "@/types/database";
import type { TradeCategory } from "@/types/database";
import { userHasRole } from "@/lib/auth/roles";

export default async function BrowseProjectsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  if (!(await userHasRole(user.id, "bidder"))) redirect("/login");

  const { data: projects } = await supabase
    .from("projects")
    .select("*, project_files(id, file_url, thumbnail_url, file_type, annotated_url)")
    .eq("status", "open")
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">
          Browse Open Projects 🔍
        </h1>
        <p className="mt-1 text-text-secondary">
          Find projects that match your trade and submit a bid.
        </p>
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
              href={`/bidder/projects/${project.id}`}
              className="block rounded-xl border border-border bg-surface p-4 shadow-sm transition-all hover:border-secondary/30 hover:shadow-md sm:p-6"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
                {/* Project Thumbnail */}
                <div className="h-44 w-full overflow-hidden rounded-lg border border-border bg-bg-warm sm:h-20 sm:w-20 sm:shrink-0">
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
                  <h2 className="text-xl font-semibold leading-tight text-text-primary sm:text-lg">
                    {project.title}
                  </h2>

                  <p className="mt-2 text-sm text-text-secondary line-clamp-3 sm:line-clamp-2">
                    {project.description}
                  </p>

                  <div className="mt-4 grid gap-2 text-sm text-text-muted sm:mt-3 sm:flex sm:flex-wrap sm:items-center sm:gap-4 sm:text-xs">
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
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-3.5 w-3.5" />
                        ${Number(project.budget_min || 0).toLocaleString()} –
                        ${Number(project.budget_max).toLocaleString()}
                      </span>
                    )}
                    {project.desired_start_date && (
                      <span>
                        Start:{" "}
                        {new Date(
                          project.desired_start_date
                        ).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {(project.trades as TradeCategory[]).map((trade) => (
                      <span
                        key={trade}
                        className="rounded-full bg-secondary/10 px-2.5 py-0.5 text-xs font-medium text-secondary"
                      >
                        {TRADE_LABELS[trade]}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="sm:ml-6 sm:shrink-0">
                  <span className="inline-flex w-full items-center justify-center rounded-lg bg-secondary px-4 py-3 text-sm font-semibold text-white shadow-sm sm:w-auto sm:py-2">
                    View & Bid →
                  </span>
                </div>
              </div>
            </Link>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface py-16 text-center shadow-sm">
          <Search className="mx-auto h-12 w-12 text-text-muted/40" />
          <p className="mt-4 text-lg font-medium text-text-secondary">
            No open projects right now
          </p>
          <p className="mt-1 text-sm text-text-muted">
            Check back soon — new projects are posted regularly!
          </p>
        </div>
      )}
    </div>
  );
}
