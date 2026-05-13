import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import dynamic from "next/dynamic";
import TimeRangeSelector, {
  type TimeRange,
  getRangeCutoff,
  getRangeDays,
  isValidRange,
} from "@/components/admin/TimeRangeSelector";

const RevenueDashboard = dynamic(() => import("./RevenueDashboard"), {
  loading: () => (
    <div className="flex items-center justify-center py-20">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  ),
});

interface Props {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

export default async function AdminRevenuePage({ searchParams }: Props) {
  const params = await searchParams;
  const supabase = await createClient();
  const admin = createAdminClient();
  const nowMs = Date.now();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();
  if (profile?.role !== "admin") redirect("/login");

  const range: TimeRange = isValidRange(params.range) ? params.range : "30d";
  const rangeDays = getRangeDays(range);
  const rangeCutoff = getRangeCutoff(range);

  const { data: pools } = await admin
    .from("project_paid_estimate_pools")
    .select("*")
    .order("created_at", { ascending: false });

  const { data: recentPools } = await admin
    .from("project_paid_estimate_pools")
    .select("funded_total_amount, platform_fee_amount, contractor_payout_amount, refunded_total_amount, created_at, funded_at")
    .not("funded_at", "is", null)
    .gte("funded_at", rangeCutoff)
    .order("funded_at", { ascending: true });

  const { data: claims } = await admin
    .from("paid_estimate_claims")
    .select("claim_status, reward_amount, created_at");

  const totalFunded = (pools || [])
    .filter((p) => p.funded_at)
    .reduce((sum, p) => sum + Number(p.funded_total_amount || 0), 0);
  const totalPlatformFees = (pools || [])
    .filter((p) => p.funded_at)
    .reduce((sum, p) => sum + Number(p.platform_fee_amount || 0), 0);
  const totalContractorPayouts = (pools || [])
    .filter((p) => p.funded_at)
    .reduce((sum, p) => sum + Number(p.contractor_payout_amount || 0), 0);
  const totalRefunded = (pools || [])
    .reduce((sum, p) => sum + Number(p.refunded_total_amount || 0), 0);

  const claimsByStatus: Record<string, { count: number; amount: number }> = {};
  for (const c of claims || []) {
    const status = c.claim_status;
    if (!claimsByStatus[status]) claimsByStatus[status] = { count: 0, amount: 0 };
    claimsByStatus[status].count++;
    claimsByStatus[status].amount += Number(c.reward_amount || 0);
  }

  // Revenue over time (daily)
  const dailyRevenue: Record<string, { funded: number; fees: number; payouts: number; refunds: number }> = {};
  for (let i = rangeDays - 1; i >= 0; i--) {
    const d = new Date(nowMs - i * 86400000).toISOString().slice(0, 10);
    dailyRevenue[d] = { funded: 0, fees: 0, payouts: 0, refunds: 0 };
  }
  for (const p of recentPools || []) {
    if (!p.funded_at) continue;
    const day = p.funded_at.slice(0, 10);
    if (dailyRevenue[day]) {
      dailyRevenue[day].funded += Number(p.funded_total_amount || 0);
      dailyRevenue[day].fees += Number(p.platform_fee_amount || 0);
      dailyRevenue[day].payouts += Number(p.contractor_payout_amount || 0);
      dailyRevenue[day].refunds += Number(p.refunded_total_amount || 0);
    }
  }

  const revenueOverTime = Object.entries(dailyRevenue).map(([date, values]) => ({
    date: new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    ...values,
  }));

  const fundedPoolCount = (pools || []).filter((p) => p.funded_at).length;

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            Revenue Dashboard 💰
          </h1>
          <p className="mt-1 text-text-secondary">
            Money flow across the paid estimate system.
          </p>
        </div>
        <TimeRangeSelector />
      </div>
      <RevenueDashboard
        rangeDays={rangeDays}
        totals={{
          funded: totalFunded,
          platformFees: totalPlatformFees,
          contractorPayouts: totalContractorPayouts,
          refunded: totalRefunded,
          fundedPools: fundedPoolCount,
        }}
        claimsByStatus={claimsByStatus}
        revenueOverTime={revenueOverTime}
      />
    </div>
  );
}
