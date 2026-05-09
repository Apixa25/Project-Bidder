import { createAdminClient } from "@/lib/supabase/admin";
import { TRADE_LABELS } from "@/types/database";
import type { TradeCategory } from "@/types/database";

export async function getCostEstimates() {
  let supabase;
  try {
    supabase = createAdminClient();
  } catch {
    console.warn(
      "[getCostEstimates] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY; returning no bid benchmarks."
    );
    return [];
  }

  const { data: bids } = await supabase.from("bids").select("trade, price");

  if (!bids || bids.length === 0) return [];

  const tradeGroups = new Map<string, number[]>();
  for (const bid of bids) {
    if (bid.price > 0) {
      const prices = tradeGroups.get(bid.trade) || [];
      prices.push(bid.price);
      tradeGroups.set(bid.trade, prices);
    }
  }

  const estimates: Array<{
    trade: string;
    label: string;
    avg: number;
    min: number;
    max: number;
    count: number;
  }> = [];

  for (const [trade, prices] of tradeGroups.entries()) {
    if (prices.length < 2) continue;
    const sorted = prices.sort((a, b) => a - b);
    const avg = sorted.reduce((s, p) => s + p, 0) / sorted.length;
    estimates.push({
      trade,
      label: TRADE_LABELS[trade as TradeCategory] || trade,
      avg: Math.round(avg),
      min: sorted[0],
      max: sorted[sorted.length - 1],
      count: sorted.length,
    });
  }

  console.log("[getCostEstimates]", {
    rawBidRows: bids.length,
    benchmarkGroups: estimates.length,
  });

  return estimates.sort((a, b) => b.count - a.count);
}
