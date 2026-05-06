import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { userHasRole } from "@/lib/auth/roles";
import {
  FolderOpen,
  Plus,
  ClipboardList,
  MessageSquare,
  TrendingUp,
  ImageIcon,
  Video,
  FileText as FileIcon,
  Users,
} from "lucide-react";
import { bidCountForDisplay } from "@/lib/projects/bidCountDisplay";
import {
  getProjectMediaSummary,
  getProjectPreviewFile,
  getProjectPreviewUrl,
  isProjectVideo,
} from "@/lib/project-media";
import ProjectStatusPill from "@/components/project/ProjectStatusPill";

export default async function CustomerDashboard() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!profile || !(await userHasRole(user.id, "customer"))) redirect("/login");

  const { data: projects, count: projectCount } = await supabase
    .from("projects")
    .select(
      "*, project_files(id, file_url, thumbnail_url, file_type, annotated_url, display_order, uploaded_at), bids!bids_project_id_fkey(count)",
      { count: "exact" }
    )
    .eq("customer_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5);

  // Scope the "Total Bids Received" stat to bids on THIS customer's projects.
  // Previous version selected all bids in the database (no filter) which made
  // the number on the dashboard nonsensical for everyone except possibly the
  // very first user. The `projects!inner(customer_id)` join + the
  // `projects.customer_id` equality filter is the same pattern used in
  // src/app/(dashboard)/customer/projects/[id]/paid-estimates/actions.ts.
  const { count: totalBids } = await supabase
    .from("bids")
    .select("id, projects!inner(customer_id)", {
      count: "exact",
      head: true,
    })
    .eq("projects.customer_id", user.id);
  const openProjects = projects?.filter((p) => p.status === "open").length || 0;

  const { count: unreadMessages } = await supabase
    .from("messages")
    .select("*", { count: "exact", head: true })
    .eq("receiver_id", user.id)
    .eq("read", false);

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            Welcome back, {profile.full_name.split(" ")[0]}! 👋
          </h1>
          <p className="mt-1 text-text-secondary">
            Here&apos;s what&apos;s happening with your projects.
          </p>
        </div>
        <div className="grid gap-3 sm:flex sm:flex-wrap">
          <Link
            href="/customer/contractors"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-surface px-5 py-3 text-sm font-semibold text-text-primary shadow-sm transition-colors hover:bg-surface-hover sm:py-2.5"
          >
            <Users className="h-4 w-4" />
            Find Contractors
          </Link>
          <Link
            href="/customer/projects/new"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent-light px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:brightness-110 sm:py-2.5"
          >
            <Plus className="h-4 w-4" />
            Post New Project
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-light/10">
              <FolderOpen className="h-5 w-5 text-accent-light" />
            </div>
            <div>
              <p className="text-2xl font-bold text-text-primary">
                {projectCount || 0}
              </p>
              <p className="text-sm text-text-muted">Total Projects</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/10">
              <TrendingUp className="h-5 w-5 text-secondary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-text-primary">
                {openProjects}
              </p>
              <p className="text-sm text-text-muted">Open Projects</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
              <ClipboardList className="h-5 w-5 text-amber-700" />
            </div>
            <div>
              <p className="text-2xl font-bold text-text-primary">
                {totalBids ?? 0}
              </p>
              <p className="text-sm text-text-muted">Total Bids Received</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
              <MessageSquare className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-text-primary">
                {unreadMessages || 0}
              </p>
              <p className="text-sm text-text-muted">Unread Messages</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Projects */}
      <div className="rounded-xl border border-border bg-surface shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-6">
          <h2 className="text-lg font-semibold text-text-primary">
            Recent Projects
          </h2>
          <Link
            href="/customer/projects"
            className="text-sm font-medium text-accent-light hover:text-accent transition-colors"
          >
            View All →
          </Link>
        </div>
        {projects && projects.length > 0 ? (
          <div className="divide-y divide-border">
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
                  className="flex flex-col gap-3 px-4 py-4 transition-colors hover:bg-surface-hover sm:flex-row sm:items-center sm:gap-4 sm:px-6"
                >
                  {/* Project Thumbnail */}
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-border bg-bg-warm">
                    {thumbUrl ? (
                      <img
                        src={thumbUrl}
                        alt={project.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <ImageIcon className="h-6 w-6 text-text-muted/40" />
                      </div>
                    )}
                    {previewIsVideo && (
                      <span className="absolute left-1.5 top-1.5 rounded-full bg-slate-950/80 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                        VIDEO
                      </span>
                    )}
                  </div>

                  {/* Project Info */}
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-medium text-text-primary truncate">
                      {project.title}
                    </h3>
                    <p className="mt-0.5 text-xs text-text-muted">
                      {project.location_city}, {project.location_state} •{" "}
                      {new Date(project.created_at).toLocaleDateString()}
                    </p>
                    {mediaSummary.totalCount > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
                        {mediaSummary.imageCount > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-surface-hover px-2 py-0.5 text-text-secondary">
                            <ImageIcon className="h-3 w-3" />
                            {mediaSummary.imageCount}
                          </span>
                        )}
                        {mediaSummary.videoCount > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-surface-hover px-2 py-0.5 text-text-secondary">
                            <Video className="h-3 w-3" />
                            {mediaSummary.videoCount}
                          </span>
                        )}
                        {mediaSummary.documentCount > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-surface-hover px-2 py-0.5 text-text-secondary">
                            <FileIcon className="h-3 w-3" />
                            {mediaSummary.documentCount}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Status */}
                  <div className="flex w-full flex-wrap items-center justify-between gap-3 sm:ml-4 sm:w-auto sm:shrink-0 sm:justify-start sm:gap-4">
                    <span className="text-sm font-medium text-text-secondary">
                      {bidsShown}{" "}
                      {bidsShown === 1 ? "bid" : "bids"}
                    </span>
                    <ProjectStatusPill status={project.status} />
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="px-6 py-12 text-center">
            <FolderOpen className="mx-auto h-12 w-12 text-text-muted/40" />
            <p className="mt-4 text-sm font-medium text-text-secondary">
              No projects yet
            </p>
            <p className="mt-1 text-sm text-text-muted">
              Post your first project and start receiving bids!
            </p>
            <Link
              href="/customer/projects/new"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-accent-light px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:brightness-110"
            >
              <Plus className="h-4 w-4" />
              Post a Project
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
