import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  ClipboardList,
  FolderOpen,
  MapPin,
  Calendar,
  DollarSign,
  FileText,
} from "lucide-react";
import { TRADE_LABELS } from "@/types/database";
import type { TradeCategory } from "@/types/database";

export default async function MyBidsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: bids } = await supabase
    .from("bids")
    .select("*, bid_files(*), projects!inner(title, status, location_city, location_state, trades)")
    .eq("bidder_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">My Bids 📋</h1>
          <p className="mt-1 text-text-secondary">
            Track all your bid submissions and their project status.
          </p>
        </div>
        <Link
          href="/bidder/projects"
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-secondary px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-secondary-dark sm:w-auto sm:py-2.5"
        >
          <FolderOpen className="h-4 w-4" />
          Browse Projects
        </Link>
      </div>

      {bids && bids.length > 0 ? (
        <div className="space-y-4">
          {bids.map((bid) => {
            const project = bid.projects as unknown as {
              title: string;
              status: string;
              location_city: string;
              location_state: string;
              trades: TradeCategory[];
            };
            const bidFiles = bid.bid_files as unknown as {
              id: string;
              file_url: string;
              file_name: string;
              file_type: string;
            }[];

            return (
              <div
                key={bid.id}
                className="rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-6"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                      <Link
                        href={`/bidder/projects/${bid.project_id}`}
                        className="text-lg font-semibold leading-tight text-text-primary transition-colors hover:text-primary"
                      >
                        {project.title}
                      </Link>
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

                    <div className="mt-3 grid gap-2 text-sm text-text-muted sm:mt-2 sm:flex sm:flex-wrap sm:items-center sm:gap-4 sm:text-xs">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {project.location_city}, {project.location_state}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        Bid submitted{" "}
                        {new Date(bid.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-lg bg-bg-warm px-4 py-3 sm:ml-6 sm:shrink-0 sm:bg-transparent sm:px-0 sm:py-0 sm:text-right">
                    <p className="text-xl font-bold text-primary sm:text-2xl">
                      ${Number(bid.price).toLocaleString()}
                    </p>
                    <span className="mt-2 inline-flex rounded-full bg-secondary/10 px-2.5 py-0.5 text-xs font-medium text-secondary">
                      {TRADE_LABELS[bid.trade as TradeCategory]}
                    </span>
                  </div>
                </div>

                {/* Bid Details */}
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
                  <div className="rounded-lg bg-bg-warm px-3 py-2">
                    <p className="text-xs text-text-muted">Timeline</p>
                    <p className="text-sm font-medium text-text-primary">
                      {bid.estimated_timeline}
                    </p>
                  </div>
                  <div className="rounded-lg bg-bg-warm px-3 py-2">
                    <p className="text-xs text-text-muted">Can Start</p>
                    <p className="text-sm font-medium text-text-primary">
                      {new Date(bid.estimated_start_date).toLocaleDateString()}
                    </p>
                  </div>
                  {bid.price_breakdown && (
                    <div className="rounded-lg bg-bg-warm px-3 py-2 sm:col-span-2">
                      <p className="text-xs text-text-muted">Price Breakdown</p>
                      <p className="text-sm text-text-secondary whitespace-pre-wrap line-clamp-2">
                        {bid.price_breakdown}
                      </p>
                    </div>
                  )}
                </div>

                {bid.notes && (
                  <div className="mt-3 rounded-lg bg-bg-warm px-4 py-3">
                    <p className="text-xs text-text-muted mb-1">Your Notes</p>
                    <p className="text-sm text-text-secondary whitespace-pre-wrap line-clamp-3">
                      {bid.notes}
                    </p>
                  </div>
                )}

                {/* Bid Files */}
                {bidFiles && bidFiles.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {bidFiles.map((file) => (
                      <a
                        key={file.id}
                        href={file.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-text-secondary hover:bg-surface-hover transition-colors"
                      >
                        <FileText className="h-3 w-3" />
                        {file.file_name}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface py-16 text-center shadow-sm">
          <ClipboardList className="mx-auto h-12 w-12 text-text-muted/40" />
          <p className="mt-4 text-lg font-medium text-text-secondary">
            No bids yet
          </p>
          <p className="mt-1 text-sm text-text-muted">
            Browse open projects and submit your first bid!
          </p>
          <Link
            href="/bidder/projects"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-secondary px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-secondary-dark transition-colors"
          >
            <FolderOpen className="h-4 w-4" />
            Browse Projects
          </Link>
        </div>
      )}
    </div>
  );
}
