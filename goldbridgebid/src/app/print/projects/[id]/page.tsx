import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect, notFound } from "next/navigation";
import RichTextRenderer from "@/components/ui/RichTextRenderer";
import { TRADE_LABELS, EXPERTISE_LEVEL_LABELS } from "@/types/database";
import type {
  TradeCategory,
  ExpertiseLevel,
} from "@/types/database";
import { userHasRole } from "@/lib/auth/roles";
import AutoPrintTrigger from "../../AutoPrintTrigger";

/**
 * Print-friendly project summary.
 *
 * Anyone allowed to view the project (the customer who owns it, any bidder for
 * an open project, or an admin) can hit `/print/projects/[id]` to get a clean
 * one-page-style summary suitable for printing or saving as PDF.
 */
export default async function PrintProjectSummaryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const admin = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();

  if (!project) notFound();

  const isOwner = project.customer_id === user.id;
  const isAdmin = await userHasRole(user.id, "admin");
  const isBidder = await userHasRole(user.id, "bidder");

  // Visibility rules mirror the in-app project pages:
  //  - Customer who owns it -> always allowed
  //  - Admin -> always allowed
  //  - Bidder -> only when project is "open"
  const canView =
    isOwner || isAdmin || (isBidder && project.status === "open");
  if (!canView) notFound();

  const { data: projectFiles } = await supabase
    .from("project_files")
    .select("*")
    .eq("project_id", id)
    .order("display_order", { ascending: true })
    .order("uploaded_at", { ascending: false });

  // Customer profile for the "posted by" line
  const { data: customerProfile } = await supabase
    .from("profiles")
    .select("full_name, business_name, city, state")
    .eq("user_id", project.customer_id)
    .single();

  // Project Q&A (so contractors have the questions on paper too)
  const { data: projectQuestions } = await supabase
    .from("project_questions")
    .select("*")
    .eq("project_id", id)
    .order("created_at", { ascending: true });

  const askerIds = [
    ...new Set((projectQuestions || []).map((q) => q.asker_id)),
  ];
  const { data: askerProfiles } = askerIds.length
    ? await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", askerIds)
    : { data: [] };
  const askerNameMap = new Map(
    (askerProfiles || []).map((p) => [p.user_id, p.full_name])
  );

  // Published AI scope items (bidder-visible). Mirror the bidder page logic.
  const { data: aiEstimate } = await admin
    .from("project_ai_estimates")
    .select("published_to_bidders")
    .eq("project_id", id)
    .maybeSingle();

  let publishedScopeItems: Array<{
    id: string;
    item_label: string;
    description: string | null;
    quantity_drivers_json: unknown;
  }> = [];

  if (aiEstimate?.published_to_bidders || isOwner || isAdmin) {
    const { data: scopeRows } = await admin
      .from("project_ai_scope_items")
      .select("id, item_label, description, quantity_drivers_json, display_order")
      .eq("project_id", id)
      .or("customer_inclusion.eq.yes,required_status.eq.required")
      .order("display_order", { ascending: true });
    publishedScopeItems = scopeRows || [];
  }

  const projectTrades = (project.trades || []) as TradeCategory[];

  const imageFiles = (projectFiles || []).filter((f) =>
    f.file_type?.startsWith("image/")
  );
  const docFiles = (projectFiles || []).filter(
    (f) =>
      !f.file_type?.startsWith("image/") &&
      !f.file_type?.startsWith("video/")
  );
  const videoFiles = (projectFiles || []).filter((f) =>
    f.file_type?.startsWith("video/")
  );

  const customerName =
    customerProfile?.business_name ||
    customerProfile?.full_name ||
    "Project Owner";

  const printedAt = new Date().toLocaleString();

  return (
    <>
      <AutoPrintTrigger />

      <main className="print-sheet mx-auto max-w-4xl px-8 py-6 text-[12pt] leading-snug text-black">
        {/* Header */}
        <header className="border-b-2 border-slate-800 pb-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                ProjectXBidX — Project Summary
              </p>
              <h1 className="mt-1 text-2xl font-bold text-slate-900">
                {project.title}
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                Posted by <span className="font-medium">{customerName}</span> on{" "}
                {new Date(project.created_at).toLocaleDateString()} •{" "}
                Project ID: <span className="font-mono">{project.id.slice(0, 8)}</span>
              </p>
            </div>
            <div className="text-right text-xs text-slate-500">
              <p>Printed: {printedAt}</p>
              <p className="mt-1">Status: {project.status}</p>
              <p>{project.bid_count || 0} bid(s) received</p>
            </div>
          </div>
        </header>

        {/* Project Details grid */}
        <section className="mt-5 grid grid-cols-2 gap-x-8 gap-y-3 border-b border-slate-300 pb-4 text-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Location
            </p>
            <p className="mt-0.5 font-medium text-slate-900">
              {project.location_address}
            </p>
            <p className="text-slate-700">
              {project.location_city}, {project.location_state}{" "}
              {project.location_zip}
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Trades
            </p>
            <p className="mt-0.5 text-slate-900">
              {projectTrades.length > 0
                ? projectTrades.map((t) => TRADE_LABELS[t]).join(", ")
                : "Open to all trades"}
            </p>
          </div>

          {project.desired_start_date && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Desired Start
              </p>
              <p className="mt-0.5 text-slate-900">
                {new Date(project.desired_start_date).toLocaleDateString()}
              </p>
            </div>
          )}

          {project.timeline && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Expected Duration
              </p>
              <p className="mt-0.5 text-slate-900">{project.timeline}</p>
            </div>
          )}

          {(project.budget_min || project.budget_max) && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Budget Range
              </p>
              <p className="mt-0.5 text-slate-900">
                {project.budget_min && project.budget_max
                  ? `$${Number(project.budget_min).toLocaleString()} – $${Number(project.budget_max).toLocaleString()}`
                  : project.budget_max
                    ? `Up to $${Number(project.budget_max).toLocaleString()}`
                    : `From $${Number(project.budget_min).toLocaleString()}`}
              </p>
            </div>
          )}

          {project.expertise_level && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Level of Professional Needed
              </p>
              <p className="mt-0.5 text-slate-900">
                {EXPERTISE_LEVEL_LABELS[project.expertise_level as ExpertiseLevel]}
              </p>
            </div>
          )}
        </section>

        {/* Description */}
        <section className="page-break-avoid mt-5">
          <h2 className="mb-2 text-lg font-bold text-slate-900">
            Project Description
          </h2>
          <div className="text-[11pt] text-slate-800">
            <RichTextRenderer content={project.description} />
          </div>
        </section>

        {/* Scope items */}
        {publishedScopeItems.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-2 text-lg font-bold text-slate-900">
              Expected Items to Bid On
            </h2>
            <p className="mb-2 text-xs text-slate-600">
              Use this as a checklist when preparing your bid. Prices are not
              shown — provide your own pricing for each line item.
            </p>
            <table className="w-full border-collapse text-[10.5pt]">
              <thead>
                <tr className="border-b-2 border-slate-700 text-left">
                  <th className="py-1.5 pr-3 font-semibold text-slate-900">
                    Item
                  </th>
                  <th className="py-1.5 px-3 font-semibold text-slate-900">
                    Description
                  </th>
                  <th className="py-1.5 px-3 text-center font-semibold text-slate-900 w-16">
                    Unit
                  </th>
                  <th className="py-1.5 px-3 text-center font-semibold text-slate-900 w-12">
                    Qty
                  </th>
                  <th className="py-1.5 px-3 text-right font-semibold text-slate-900 w-24">
                    Your Price
                  </th>
                </tr>
              </thead>
              <tbody>
                {publishedScopeItems.map((item) => {
                  const drivers = Array.isArray(item.quantity_drivers_json)
                    ? (item.quantity_drivers_json as Array<{
                        key: string;
                        value: string;
                        unit: string | null;
                      }>)
                    : [];
                  const customerQty = drivers.find(
                    (d) => d.key === "customer_stated_quantity"
                  );
                  const craftsmanUnit = drivers.find(
                    (d) => d.key === "craftsman_unit"
                  );
                  const qty = customerQty ? customerQty.value : "1";
                  const unit =
                    customerQty?.unit || craftsmanUnit?.unit || "ea";

                  return (
                    <tr
                      key={item.id}
                      className="border-b border-slate-300 align-top"
                    >
                      <td className="py-2 pr-3 font-medium text-slate-900">
                        {item.item_label}
                      </td>
                      <td className="py-2 px-3 text-slate-700">
                        {item.description || "—"}
                      </td>
                      <td className="py-2 px-3 text-center text-slate-700">
                        {unit}
                      </td>
                      <td className="py-2 px-3 text-center text-slate-700">
                        {qty}
                      </td>
                      <td className="py-2 px-3 text-right text-slate-400">
                        $ ____________
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        )}

        {/* Q&A */}
        {projectQuestions && projectQuestions.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-2 text-lg font-bold text-slate-900">
              Questions &amp; Answers
            </h2>
            <ul className="space-y-3">
              {projectQuestions.map((q) => (
                <li
                  key={q.id}
                  className="page-break-avoid rounded border border-slate-300 p-3 text-[11pt]"
                >
                  <p className="text-xs text-slate-500">
                    Asked by{" "}
                    <span className="font-medium text-slate-700">
                      {askerNameMap.get(q.asker_id) || "A contractor"}
                    </span>
                    {" — "}
                    {new Date(q.created_at).toLocaleDateString()}
                  </p>
                  <p className="mt-1 font-medium text-slate-900">
                    Q: {q.question}
                  </p>
                  {q.answer ? (
                    <p className="mt-2 text-slate-800">A: {q.answer}</p>
                  ) : (
                    <p className="mt-2 italic text-slate-500">
                      Awaiting answer.
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Attachments listing */}
        {(imageFiles.length > 0 ||
          docFiles.length > 0 ||
          videoFiles.length > 0) && (
          <section className="mt-6 page-break-avoid">
            <h2 className="mb-2 text-lg font-bold text-slate-900">
              Attachments
            </h2>
            <p className="mb-2 text-xs text-slate-600">
              {imageFiles.length} photo(s), {docFiles.length} document(s),{" "}
              {videoFiles.length} video(s).
            </p>
            <ul className="list-disc pl-6 text-[10.5pt] text-slate-800">
              {imageFiles.map((f) => (
                <li key={f.id}>
                  <span className="font-medium">📷 {f.file_name}</span>{" "}
                  <span className="text-slate-500">— {f.file_type}</span>
                </li>
              ))}
              {docFiles.map((f) => (
                <li key={f.id}>
                  <span className="font-medium">📄 {f.file_name}</span>{" "}
                  <span className="text-slate-500">— {f.file_type}</span>
                </li>
              ))}
              {videoFiles.map((f) => (
                <li key={f.id}>
                  <span className="font-medium">🎬 {f.file_name}</span>{" "}
                  <span className="text-slate-500">— {f.file_type}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[10pt] italic text-slate-500">
              Photos and documents can be printed separately by going back to
              the project page online — videos are not printable.
            </p>
          </section>
        )}

        {/* Bid worksheet */}
        <section className="mt-8 page-break-before">
          <h2 className="mb-3 text-lg font-bold text-slate-900">
            My Bid Worksheet
          </h2>
          <p className="mb-3 text-xs text-slate-600">
            Use this space to draft your bid offline. You will still need to
            submit your final numbers through ProjectXBidX.
          </p>
          <div className="space-y-3 text-[11pt]">
            <div className="flex items-end gap-3">
              <span className="w-40 font-medium">Trade I am bidding:</span>
              <span className="flex-1 border-b border-slate-400">&nbsp;</span>
            </div>
            <div className="flex items-end gap-3">
              <span className="w-40 font-medium">Total bid price:</span>
              <span className="flex-1 border-b border-slate-400">&nbsp;</span>
            </div>
            <div className="flex items-end gap-3">
              <span className="w-40 font-medium">Estimated start date:</span>
              <span className="flex-1 border-b border-slate-400">&nbsp;</span>
            </div>
            <div className="flex items-end gap-3">
              <span className="w-40 font-medium">Estimated timeline:</span>
              <span className="flex-1 border-b border-slate-400">&nbsp;</span>
            </div>
            <div>
              <p className="mb-1 font-medium">Notes / scope clarifications:</p>
              <div className="h-32 rounded border border-slate-400" />
            </div>
          </div>
        </section>

        <footer className="mt-8 border-t border-slate-300 pt-3 text-center text-[10pt] text-slate-500">
          ProjectXBidX.com — Where qualified contractors compete for your project.
        </footer>
      </main>
    </>
  );
}
