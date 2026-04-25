"use client";

import { TRADE_LABELS, type TradeCategory, type BadgeLevel } from "@/types/database";
import { BADGE_CONFIG } from "@/lib/badges";

interface ComparisonBid {
  id: string;
  bidder_name: string;
  business_name: string | null;
  badge_level: BadgeLevel;
  trade: TradeCategory;
  price: number;
  estimated_timeline: string;
  estimated_start_date: string;
  notes: string | null;
  created_at: string;
}

interface BidComparisonProps {
  bids: ComparisonBid[];
}

export default function BidComparison({ bids }: BidComparisonProps) {
  if (bids.length < 2) return null;

  const sorted = [...bids].sort((a, b) => a.price - b.price);

  return (
    <div className="space-y-2">
      {/* Mobile-only hint: with multiple bids the comparison table scrolls
          horizontally (the first "Attribute" column is sticky). Without this
          hint, mobile users sometimes don't realize there's more to the right. */}
      {sorted.length > 1 && (
        <p className="text-xs text-text-muted sm:hidden">
          Swipe horizontally to compare all {sorted.length} bids →
        </p>
      )}
      <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-sm">
        <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-bg-warm">
            <th className="sticky left-0 z-10 bg-bg-warm px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">
              Attribute
            </th>
            {sorted.map((bid) => (
              <th
                key={bid.id}
                className="min-w-[180px] px-4 py-3 text-left text-xs font-semibold text-text-primary"
              >
                <div className="flex flex-col gap-1">
                  <span className="truncate">{bid.bidder_name}</span>
                  {bid.business_name && (
                    <span className="text-[10px] font-normal text-text-muted truncate">
                      {bid.business_name}
                    </span>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-border">
            <td className="sticky left-0 z-10 bg-surface px-4 py-3 font-medium text-text-muted">
              Badge
            </td>
            {sorted.map((bid) => {
              const badgeInfo = bid.badge_level
                ? BADGE_CONFIG[bid.badge_level]
                : null;
              return (
                <td key={bid.id} className="px-4 py-3">
                  {badgeInfo ? (
                    <span
                      className={`inline-flex items-center gap-1 rounded-full ${badgeInfo.bgColor} px-2 py-0.5 text-xs font-medium ${badgeInfo.color}`}
                    >
                      {badgeInfo.icon} {badgeInfo.label}
                    </span>
                  ) : (
                    <span className="text-text-muted text-xs">No badge</span>
                  )}
                </td>
              );
            })}
          </tr>
          <tr className="border-b border-border bg-green-50/50">
            <td className="sticky left-0 z-10 bg-green-50/50 px-4 py-3 font-medium text-text-muted">
              Price
            </td>
            {sorted.map((bid, index) => (
              <td key={bid.id} className="px-4 py-3">
                <span
                  className={`text-lg font-bold ${
                    index === 0 ? "text-green-700" : "text-secondary"
                  }`}
                >
                  ${bid.price.toLocaleString()}
                </span>
                {index === 0 && (
                  <span className="ml-2 text-[10px] font-medium text-green-700">
                    LOWEST
                  </span>
                )}
              </td>
            ))}
          </tr>
          <tr className="border-b border-border">
            <td className="sticky left-0 z-10 bg-surface px-4 py-3 font-medium text-text-muted">
              Trade
            </td>
            {sorted.map((bid) => (
              <td key={bid.id} className="px-4 py-3 text-text-primary">
                {TRADE_LABELS[bid.trade]}
              </td>
            ))}
          </tr>
          <tr className="border-b border-border">
            <td className="sticky left-0 z-10 bg-surface px-4 py-3 font-medium text-text-muted">
              Timeline
            </td>
            {sorted.map((bid) => (
              <td key={bid.id} className="px-4 py-3 text-text-primary">
                {bid.estimated_timeline}
              </td>
            ))}
          </tr>
          <tr className="border-b border-border">
            <td className="sticky left-0 z-10 bg-surface px-4 py-3 font-medium text-text-muted">
              Start Date
            </td>
            {sorted.map((bid) => (
              <td key={bid.id} className="px-4 py-3 text-text-primary">
                {new Date(bid.estimated_start_date).toLocaleDateString()}
              </td>
            ))}
          </tr>
          <tr className="border-b border-border">
            <td className="sticky left-0 z-10 bg-surface px-4 py-3 font-medium text-text-muted">
              Submitted
            </td>
            {sorted.map((bid) => (
              <td key={bid.id} className="px-4 py-3 text-text-muted text-xs">
                {new Date(bid.created_at).toLocaleDateString()}
              </td>
            ))}
          </tr>
          {sorted.some((bid) => bid.notes) && (
            <tr>
              <td className="sticky left-0 z-10 bg-surface px-4 py-3 font-medium text-text-muted align-top">
                Notes
              </td>
              {sorted.map((bid) => (
                <td
                  key={bid.id}
                  className="px-4 py-3 text-text-secondary text-xs leading-relaxed align-top"
                >
                  {bid.notes || "—"}
                </td>
              ))}
            </tr>
          )}
        </tbody>
        </table>
      </div>
    </div>
  );
}
