import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect, notFound } from "next/navigation";
import { userHasRole } from "@/lib/auth/roles";
import type { BidLineItem } from "@/types/database";
import EditBidForm from "./EditBidForm";

interface Props {
  params: Promise<{ bidId: string }>;
}

const LOCKED_CLAIM_STATUSES = [
  "paid_reserved",
  "payout_pending",
  "paid_out",
  "disputed",
];

export default async function EditBidPage({ params }: Props) {
  const { bidId } = await params;
  const supabase = await createClient();
  const admin = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  if (!(await userHasRole(user.id, "bidder"))) redirect("/login");

  // Load the bid — must belong to this bidder.
  const { data: bid } = await supabase
    .from("bids")
    .select("*")
    .eq("id", bidId)
    .eq("bidder_id", user.id)
    .single();

  if (!bid) notFound();

  // Load the project — must still be open.
  const { data: project } = await supabase
    .from("projects")
    .select("id, title, status")
    .eq("id", bid.project_id)
    .single();

  if (!project) notFound();

  // Redirect away if the project is closed/awarded — can't edit then.
  if (project.status !== "open") {
    redirect("/bidder/bids");
  }

  // Redirect away if the bid has a locked paid-estimate claim.
  const { data: claim } = await admin
    .from("paid_estimate_claims")
    .select("claim_status")
    .eq("bid_id", bidId)
    .maybeSingle();

  if (claim && LOCKED_CLAIM_STATUSES.includes(claim.claim_status)) {
    redirect("/bidder/bids");
  }

  // Load any quick-bid line items so the form can show them read-only.
  const { data: lineItemRows } = await supabase
    .from("bid_line_items")
    .select("*")
    .eq("bid_id", bidId)
    .order("display_order", { ascending: true });

  const lineItems = (lineItemRows || []) as BidLineItem[];

  return (
    <EditBidForm
      bidId={bidId}
      projectId={project.id}
      projectTitle={project.title}
      currentPrice={Number(bid.price)}
      currentPriceBreakdown={bid.price_breakdown ?? null}
      currentEstimatedTimeline={bid.estimated_timeline}
      currentEstimatedStartDate={bid.estimated_start_date}
      currentNotes={bid.notes ?? null}
      currentScopeCoverage={bid.scope_coverage ?? "all"}
      currentScopeDescription={bid.scope_description ?? null}
      lineItems={lineItems}
      hasLineItems={lineItems.length > 0}
    />
  );
}
