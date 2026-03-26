import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  FolderOpen,
  Plus,
  ClipboardList,
  MessageSquare,
  TrendingUp,
  ImageIcon,
} from "lucide-react";

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

  if (!profile || profile.role !== "customer") redirect("/login");

  const { data: projects, count: projectCount } = await supabase
    .from("projects")
    .select("*, project_files(id, file_url, thumbnail_url, file_type, annotated_url)", { count: "exact" })
    .eq("customer_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5);

  const totalBids = projects?.reduce((sum, p) => sum + (p.bid_count || 0), 0) || 0;
  const openProjects = projects?.filter((p) => p.status === "open").length || 0;

  const { count: unreadMessages } = await supabase
    .from("messages")
    .select("*", { count: "exact", head: true })
    .eq("receiver_id", user.id)
    .eq("read", false);

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            Welcome back, {profile.full_name.split(" ")[0]}! 👋
          </h1>
          <p className="mt-1 text-text-secondary">
            Here&apos;s what&apos;s happening with your projects.
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

      {/* Stats Cards */}
      <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <FolderOpen className="h-5 w-5 text-primary" />
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
                {totalBids}
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
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-text-primary">
            Recent Projects
          </h2>
          <Link
            href="/customer/projects"
            className="text-sm font-medium text-primary hover:text-primary-dark transition-colors"
          >
            View All →
          </Link>
        </div>
        {projects && projects.length > 0 ? (
          <div className="divide-y divide-border">
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
                  className="flex items-center gap-4 px-6 py-4 hover:bg-surface-hover transition-colors"
                >
                  {/* Project Thumbnail */}
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-border bg-bg-warm">
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
                  </div>

                  {/* Status */}
                  <div className="ml-4 flex items-center gap-4 shrink-0">
                    <span className="text-sm font-medium text-text-secondary">
                      {project.bid_count}{" "}
                      {project.bid_count === 1 ? "bid" : "bids"}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
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
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-sm hover:bg-primary-dark transition-colors"
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
