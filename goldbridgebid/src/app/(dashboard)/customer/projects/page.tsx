import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  Plus,
  FolderOpen,
  MapPin,
  Calendar,
  ImageIcon,
  Video,
  FileText as FileIcon,
} from "lucide-react";
import { TRADE_LABELS, EXPERTISE_LEVEL_LABELS } from "@/types/database";
import type { ExpertiseLevel } from "@/types/database";
import type { TradeCategory } from "@/types/database";
import { stripHtml } from "@/components/ui/RichTextRenderer";
import { userHasRole } from "@/lib/auth/roles";
import { bidCountForDisplay } from "@/lib/projects/bidCountDisplay";
import {
  getProjectMediaSummary,
  getProjectPreviewFile,
  getProjectPreviewUrl,
  isProjectVideo,
} from "@/lib/project-media";

export default async function MyProjectsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  if (!(await userHasRole(user.id, "customer"))) redirect("/login");

  const { data: projects } = await supabase
    .from("projects")
    .select(
      "*, project_files(id, file_url, thumbnail_url, file_type, annotated_url, display_order, uploaded_at), bids!bids_project_id_fkey(count)"
    )
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
          className="flex items-center gap-2 rounded-lg bg-accent-light px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:brightness-110"
        >
          <Plus className="h-4 w-4" />
          Post New Project
        </Link>
      </div>

      {projects && projects.length > 0 ? (
        <div className="space-y-4">
          {projects.map((project) => {
            const bidsShown = bidCountForDisplay(project);
            const previewFile = getProjectPreviewFile(project.project_files || []);
            const thumbUrl = getProjectPreviewUrl(previewFile);
            const mediaSummary = getProjectMediaSummary(project.project_files || []);
            const previewIsVideo = isProjectVideo(previewFile);

            return (
            <Link
              key={project.id}
              href={`/customer/projects/${project.id}`}
              className="block rounded-xl border border-border bg-surface p-6 shadow-sm hover:shadow-md hover:border-primary/30 transition-all"
            >
              <div className="flex items-start gap-5">
                {/* Project Thumbnail */}
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-border bg-bg-warm">
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
                  {previewIsVideo && (
                    <span className="absolute left-2 top-2 rounded-full bg-slate-950/80 px-2 py-0.5 text-[10px] font-semibold text-white">
                      VIDEO
                    </span>
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
                    {stripHtml(project.description)}
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

                  {mediaSummary.totalCount > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      {mediaSummary.imageCount > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-surface-hover px-2.5 py-1 text-text-secondary">
                          <ImageIcon className="h-3.5 w-3.5" />
                          {mediaSummary.imageCount} photo
                          {mediaSummary.imageCount === 1 ? "" : "s"}
                        </span>
                      )}
                      {mediaSummary.videoCount > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-surface-hover px-2.5 py-1 text-text-secondary">
                          <Video className="h-3.5 w-3.5" />
                          {mediaSummary.videoCount} video
                          {mediaSummary.videoCount === 1 ? "" : "s"}
                        </span>
                      )}
                      {mediaSummary.documentCount > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-surface-hover px-2.5 py-1 text-text-secondary">
                          <FileIcon className="h-3.5 w-3.5" />
                          {mediaSummary.documentCount} doc
                          {mediaSummary.documentCount === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {project.expertise_level ? (
                      <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                        {EXPERTISE_LEVEL_LABELS[project.expertise_level as ExpertiseLevel]}
                      </span>
                    ) : (
                      (project.trades as TradeCategory[]).map((trade) => (
                        <span
                          key={trade}
                          className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
                        >
                          {TRADE_LABELS[trade]}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                <div className="ml-6 text-center shrink-0">
                  <p className="text-3xl font-bold text-text-primary">
                    {bidsShown}
                  </p>
                  <p className="text-xs text-text-muted">
                    {bidsShown === 1 ? "bid" : "bids"}
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
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-accent-light px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:brightness-110"
          >
            <Plus className="h-4 w-4" />
            Post Your First Project
          </Link>
        </div>
      )}
    </div>
  );
}
