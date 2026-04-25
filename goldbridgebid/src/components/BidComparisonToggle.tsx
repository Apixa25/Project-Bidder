"use client";

import { useState } from "react";
import { Columns3, List } from "lucide-react";
import BidComparison from "./BidComparison";
import type { BadgeLevel, TradeCategory } from "@/types/database";

interface ComparisonBid {
  id: string;
  bidder_user_id: string;
  bidder_name: string;
  business_name: string | null;
  badge_level: BadgeLevel;
  trade: TradeCategory;
  price: number;
  estimated_timeline: string;
  estimated_start_date: string;
  notes: string | null;
  created_at: string;
  review_avg: number | null;
  review_count: number;
}

interface BidComparisonToggleProps {
  bids: ComparisonBid[];
  children: React.ReactNode;
}

export default function BidComparisonToggle({
  bids,
  children,
}: BidComparisonToggleProps) {
  const [view, setView] = useState<"list" | "compare">("list");

  return (
    <div>
      {bids.length >= 2 && (
        <div className="mb-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setView("list")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              view === "list"
                ? "bg-secondary text-white"
                : "bg-surface border border-border text-text-secondary hover:bg-bg-warm"
            }`}
          >
            <List className="h-3.5 w-3.5" />
            List View
          </button>
          <button
            type="button"
            onClick={() => setView("compare")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              view === "compare"
                ? "bg-secondary text-white"
                : "bg-surface border border-border text-text-secondary hover:bg-bg-warm"
            }`}
          >
            <Columns3 className="h-3.5 w-3.5" />
            Compare Side-by-Side
          </button>
        </div>
      )}

      {view === "compare" && bids.length >= 2 ? (
        <BidComparison bids={bids} />
      ) : (
        children
      )}
    </div>
  );
}
