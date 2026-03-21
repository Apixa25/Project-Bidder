import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  MapPin,
  Calendar,
  DollarSign,
  Clock,
  ClipboardCheck,
  FileText,
  Image as ImageIcon,
  MessageSquare,
} from "lucide-react";
import { TRADE_LABELS } from "@/types/database";
import type { TradeCategory } from "@/types/database";
import BidForm from "./BidForm";

export default async function BidderProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .eq("status", "open")
    .single();

  if (!project) notFound();

  const { data: projectFiles } = await supabase
    .from("project_files")
    .select("*")
    .eq("project_id", id)
    .order("uploaded_at", { ascending: false });

  const { data: existingBids } = await supabase
    .from("bids")
    .select("trade")
    .eq("project_id", id)
    .eq("bidder_id", user.id);

  const alreadyBidTrades = (existingBids || []).map((b) => b.trade);
  const availableTrades = (project.trades as TradeCategory[]).filter(
    (t) => !alreadyBidTrades.includes(t)
  );

  const { data: projectEdits } = await supabase
    .from("project_edits")
    .select("*")
    .eq("project_id", id)
    .order("edited_at", { ascending: false });

  const imageFiles = (projectFiles || []).filter((f) =>
    f.file_type.startsWith("image/")
  );
  const docFiles = (projectFiles || []).filter(
    (f) => !f.file_type.startsWith("image/")
  );

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/bidder/projects"
          className="mb-4 inline-flex items-center gap-1 text-sm text-text-muted hover:text-text-primary transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Browse Projects
        </Link>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">
              {project.title}
            </h1>
            <p className="mt-1 text-sm text-text-muted">
              Posted {new Date(project.created_at).toLocaleDateString()} •{" "}
              {project.bid_count} {project.bid_count === 1 ? "bid" : "bids"}{" "}
              received
            </p>
          </div>
          <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
            Open for Bidding
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Edits Warning */}
          {projectEdits && projectEdits.length > 0 && (
            <section className="rounded-xl border border-amber-300 bg-amber-50 p-5 shadow-sm">
              <h2 className="mb-2 text-sm font-semibold text-amber-900">
                ⚠️ This project has been edited
              </h2>
              <div className="space-y-2">
                {projectEdits.map((edit) => (
                  <div
                    key={edit.id}
                    className="rounded-lg bg-white/60 px-3 py-2 text-xs"
                  >
                    <span className="font-medium text-amber-800">
                      {edit.field_name}
                    </span>{" "}
                    was changed on{" "}
                    {new Date(edit.edited_at).toLocaleDateString()} at{" "}
                    {new Date(edit.edited_at).toLocaleTimeString()}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Description */}
          <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold text-text-primary">
              Project Description
            </h2>
            <p className="whitespace-pre-wrap text-text-secondary leading-relaxed">
              {project.description}
            </p>
          </section>

          {/* Completion Criteria */}
          <section className="rounded-xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <ClipboardCheck className="h-5 w-5 text-amber-700" />
              <h2 className="text-lg font-semibold text-amber-900">
                Completion Criteria
              </h2>
            </div>
            <p className="whitespace-pre-wrap text-amber-800 leading-relaxed">
              {project.completion_criteria}
            </p>
          </section>

          {/* Project Photos */}
          {imageFiles.length > 0 && (
            <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <ImageIcon className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold text-text-primary">
                  Project Photos
                </h2>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {imageFiles.map((file) => (
                  <a
                    key={file.id}
                    href={file.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative aspect-square overflow-hidden rounded-lg border border-border"
                  >
                    <img
                      src={file.file_url}
                      alt={file.file_name}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                      <p className="text-xs text-white truncate">
                        {file.file_name}
                      </p>
                    </div>
                  </a>
                ))}
              </div>
            </section>
          )}

          {/* Documents */}
          {docFiles.length > 0 && (
            <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold text-text-primary">
                  Documents & Plans
                </h2>
              </div>
              <div className="space-y-2">
                {docFiles.map((file) => (
                  <a
                    key={file.id}
                    href={file.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 rounded-lg border border-border px-4 py-3 hover:bg-surface-hover transition-colors"
                  >
                    <FileText className="h-5 w-5 text-primary shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-text-primary truncate">
                        {file.file_name}
                      </p>
                      <p className="text-xs text-text-muted">{file.file_type}</p>
                    </div>
                  </a>
                ))}
              </div>
            </section>
          )}

          {/* Bid Form */}
          <section
            id="bid-form"
            className="rounded-xl border-2 border-secondary/30 bg-surface p-6 shadow-sm"
          >
            <h2 className="mb-1 text-xl font-bold text-text-primary">
              Submit Your Bid 📝
            </h2>
            <p className="mb-6 text-sm text-text-secondary">
              Fill in your proposal details below. Bids are sealed — only the
              project owner will see your submission.
            </p>

            {availableTrades.length > 0 ? (
              <BidForm
                projectId={project.id}
                availableTrades={availableTrades}
              />
            ) : (
              <div className="rounded-lg bg-green-50 px-6 py-8 text-center">
                <ClipboardCheck className="mx-auto h-10 w-10 text-green-500" />
                <p className="mt-3 text-sm font-medium text-green-800">
                  You&apos;ve already bid on all trades for this project!
                </p>
                <Link
                  href="/bidder/bids"
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-secondary px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-secondary-dark transition-colors"
                >
                  View My Bids →
                </Link>
              </div>
            )}
          </section>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Info */}
          <div className="rounded-xl border border-border bg-surface p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-semibold text-text-primary">
              Project Details
            </h3>

            <div className="flex items-center gap-3">
              <MapPin className="h-5 w-5 text-text-muted shrink-0" />
              <div>
                <p className="text-xs text-text-muted">Location</p>
                <p className="text-sm font-medium text-text-primary">
                  {project.location_address}
                </p>
                <p className="text-sm text-text-secondary">
                  {project.location_city}, {project.location_state}{" "}
                  {project.location_zip}
                </p>
              </div>
            </div>

            {project.desired_start_date && (
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-text-muted shrink-0" />
                <div>
                  <p className="text-xs text-text-muted">Desired Start</p>
                  <p className="text-sm font-medium text-text-primary">
                    {new Date(project.desired_start_date).toLocaleDateString()}
                  </p>
                </div>
              </div>
            )}

            {project.timeline && (
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-text-muted shrink-0" />
                <div>
                  <p className="text-xs text-text-muted">Expected Duration</p>
                  <p className="text-sm font-medium text-text-primary">
                    {project.timeline}
                  </p>
                </div>
              </div>
            )}

            {(project.budget_min || project.budget_max) && (
              <div className="flex items-center gap-3">
                <DollarSign className="h-5 w-5 text-text-muted shrink-0" />
                <div>
                  <p className="text-xs text-text-muted">Budget Range</p>
                  <p className="text-sm font-medium text-text-primary">
                    {project.budget_min && project.budget_max
                      ? `$${Number(project.budget_min).toLocaleString()} – $${Number(project.budget_max).toLocaleString()}`
                      : project.budget_max
                        ? `Up to $${Number(project.budget_max).toLocaleString()}`
                        : `From $${Number(project.budget_min).toLocaleString()}`}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Trades Required */}
          <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-text-primary">
              Trades Required
            </h3>
            <div className="flex flex-wrap gap-2">
              {(project.trades as TradeCategory[]).map((trade) => {
                const alreadyBid = alreadyBidTrades.includes(trade);
                return (
                  <span
                    key={trade}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      alreadyBid
                        ? "bg-green-100 text-green-700"
                        : "bg-primary/10 text-primary"
                    }`}
                  >
                    {TRADE_LABELS[trade]}
                    {alreadyBid && " ✓"}
                  </span>
                );
              })}
            </div>
            {alreadyBidTrades.length > 0 && (
              <p className="mt-3 text-xs text-text-muted">
                ✓ = You&apos;ve already bid on this trade
              </p>
            )}
          </div>

          {/* Message Customer */}
          <Link
            href={`/bidder/messages/${id}/${project.customer_id}`}
            className="flex items-center justify-center gap-2 rounded-xl border border-secondary bg-secondary/5 p-4 text-sm font-semibold text-secondary hover:bg-secondary/10 transition-colors"
          >
            <MessageSquare className="h-5 w-5" />
            Message Project Owner
          </Link>

          {/* Quick Scroll to Bid */}
          {availableTrades.length > 0 && (
            <a
              href="#bid-form"
              className="block rounded-xl bg-secondary p-6 text-center text-white shadow-sm hover:bg-secondary-dark transition-colors"
            >
              <p className="text-lg font-bold">Ready to Bid?</p>
              <p className="mt-1 text-sm text-white/80">
                Scroll down to submit your proposal ↓
              </p>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
