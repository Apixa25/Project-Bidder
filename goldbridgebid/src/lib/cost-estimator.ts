import { createClient } from "@/lib/supabase/server";
import { TRADE_LABELS, type TradeCategory } from "@/types/database";

export interface TradeEstimate {
  trade: TradeCategory;
  tradeLabel: string;
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  bidCount: number;
}

export async function getTradeEstimates(): Promise<TradeEstimate[]> {
  const supabase = await createClient();

  const { data: bids } = await supabase
    .from("bids")
    .select("trade, price");

  if (!bids || bids.length === 0) return [];

  const tradeGroups = new Map<
    string,
    { prices: number[] }
  >();

  for (const bid of bids) {
    const group = tradeGroups.get(bid.trade) || { prices: [] };
    if (bid.price > 0) {
      group.prices.push(bid.price);
    }
    tradeGroups.set(bid.trade, group);
  }

  const estimates: TradeEstimate[] = [];

  for (const [trade, group] of tradeGroups.entries()) {
    if (group.prices.length < 2) continue;

    const sorted = group.prices.sort((a, b) => a - b);
    const avg = sorted.reduce((sum, p) => sum + p, 0) / sorted.length;

    estimates.push({
      trade: trade as TradeCategory,
      tradeLabel: TRADE_LABELS[trade as TradeCategory] || trade,
      avgPrice: Math.round(avg),
      minPrice: sorted[0],
      maxPrice: sorted[sorted.length - 1],
      bidCount: sorted.length,
    });
  }

  return estimates.sort((a, b) => b.bidCount - a.bidCount);
}
