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
  Search,
  X,
} from "lucide-react";
import {
  FORM_TRADES,
  TRADE_LABELS,
  EXPERTISE_LEVEL_LABELS,
} from "@/types/database";
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
import PrintProjectButton from "@/components/project/PrintProjectButton";
import ProjectStatusPill from "@/components/project/ProjectStatusPill";
import AdminSearchBar from "@/components/admin/AdminSearchBar";
import AdminFilterBar, { FilterDropdown } from "@/components/admin/AdminFilters";

interface MyProjectsPageProps {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

export default async function MyProjectsPage({
  searchParams,
}: MyProjectsPageProps) {
  const params = await searchParams;
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

  const allProjects = projects || [];

  // ---- URL-driven filter state for "My Projects" ----
  const searchTerm = (params.q || "").trim().toLowerCase();
  const selectedTrade = (params.trade || "").trim();
  const selectedStatus = (params.status || "").trim();

  // Trade dropdown only includes trades the customer has actually used in
  // their own projects — keeps the dropdown short and meaningful.
  const tradesInProjects = new Set<string>();
  for (const project of allProjects) {
    for (const trade of (project.trades || []) as string[]) {
      tradesInProjects.add(trade);
    }
  }
  const tradeOptions = FORM_TRADES.filter((trade) =>
    tradesInProjects.has(trade)
  ).map((trade) => ({ value: trade, label: TRADE_LABELS[trade] }));

  const filteredProjects = allProjects.filter((project) => {
    if (selectedTrade) {
      const trades = (project.trades || []) as string[];
      if (!trades.includes(selectedTrade)) return false;
    }

    if (selectedStatus && project.status !== selectedStatus) {
      return false;
    }

    if (!searchTerm) return true;

    const tradeLabels = ((project.trades || []) as TradeCategory[]).map(
      (trade) => TRADE_LABELS[trade]
    );
    const searchable = [
      project.title,
      stripHtml(project.description || ""),
      project.location_city,
      project.location_state,
      ...tradeLabels,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return searchable.includes(searchTerm);
  });

  const hasActiveFilters = Boolean(
    searchTerm || selectedTrade || selectedStatus
  );

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent-light px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:brightness-110 sm:w-auto sm:py-2.5"
        >
          <Plus className="h-4 w-4" />
          Post New Project
        </Link>
      </div>

      {/* Filter by Trade + status — purely additive. Without filters, the page
          looks identical to before; with filters, the URL drives the result
          set so links can be shared and back/forward navigation just works. */}
      {allProjects.length > 0 && (
        <div className="mb-6 rounded-xl border border-border bg-surface p-4 shadow-sm space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-base font-semibold text-text-primary">
                <Search className="h-4 w-4" />
                Filter My Projects
              </h2>
              <p className="mt-1 text-sm text-text-muted">
                Showing {filteredProjects.length} of {allProjects.length}{" "}
                project{allProjects.length === 1 ? "" : "s"}.
              </p>
            </div>
            {hasActiveFilters && (
              <Link
                href="/customer/projects"
                className="inline-flex items-center gap-2 self-start rounded-full bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
              >
                <X className="h-4 w-4" />
                Clear all filters
              </Link>
            )}
          </div>

          <div className="max-w-xl">
            <AdminSearchBar placeholder="Search title, description, location, or trade..." />
          </div>

          <AdminFilterBar>
            <FilterDropdown
              paramName="trade"
              label="Trade"
              options={tradeOptions}
            />
            <FilterDropdown
              paramName="status"
              label="Status"
              options={[
                { value: "open", label: "Open" },
                { value: "awarded", label: "Awarded" },
                { value: "completed", label: "Completed" },
                { value: "closed", label: "Closed" },
              ]}
            />
          </AdminFilterBar>
        </div>
      )}

      {filteredProjects.length > 0 ? (
        <div className="space-y-4">
          {filteredProjects.map((project) => {
            const bidsShown = bidCountForDisplay(project);
            const previewFile = getProjectPreviewFile(project.project_files || []);
            const thumbUrl = getProjectPreviewUrl(previewFile);
            const mediaSummary = getProjectMediaSummary(project.project_files || []);
            const previewIsVideo = isProjectVideo(previewFile);

            return (
            <div key={project.id} className="group relative">
              {/* Print button overlay — sits ABOVE the card link so clicking
                  it opens the printable summary instead of navigating into
                  the project. Reveals on hover for a clean default look. */}
              <div className="pointer-events-none absolute right-4 top-4 z-10 hidden opacity-0 transition-opacity group-hover:opacity-100 sm:block">
                <div className="pointer-events-auto">
                  <PrintProjectButton
                    projectId={project.id}
                    variant="muted"
                    label="Print"
                    title="Open a print-friendly copy of this project"
                  />
                </div>
              </div>
            <Link
              href={`/customer/projects/${project.id}`}
              className="block rounded-xl border border-border bg-surface p-4 shadow-sm transition-all hover:border-primary/30 hover:shadow-md sm:p-6"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
                {/* Project Thumbnail */}
                <div className="relative h-44 w-full overflow-hidden rounded-lg border border-border bg-bg-warm sm:h-20 sm:w-20 sm:shrink-0">
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
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                    <h2 className="text-lg font-semibold leading-tight text-text-primary sm:truncate">
                      {project.title}
                    </h2>
                    <ProjectStatusPill
                      status={project.status}
                      className="shrink-0"
                    />
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

                <div className="rounded-lg bg-bg-warm px-4 py-3 text-center sm:ml-6 sm:shrink-0 sm:bg-transparent sm:px-0 sm:py-0">
                  <p className="text-2xl font-bold text-text-primary sm:text-3xl">
                    {bidsShown}
                  </p>
                  <p className="text-xs text-text-muted">
                    {bidsShown === 1 ? "bid" : "bids"}
                  </p>
                </div>
              </div>
            </Link>
            </div>
            );
          })}
        </div>
      ) : allProjects.length > 0 ? (
        <div className="rounded-xl border border-border bg-surface py-16 text-center shadow-sm">
          <Search className="mx-auto h-12 w-12 text-text-muted/40" />
          <p className="mt-4 text-lg font-medium text-text-secondary">
            No projects match those filters
          </p>
          <p className="mt-1 text-sm text-text-muted">
            Try a different trade or status, or{" "}
            <Link
              href="/customer/projects"
              className="font-medium text-primary hover:underline"
            >
              clear all filters
            </Link>
            .
          </p>
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
