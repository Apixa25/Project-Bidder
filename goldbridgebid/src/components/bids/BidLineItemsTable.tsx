import type { BidLineItem } from "@/types/database";

interface BidLineItemsTableProps {
  lineItems: BidLineItem[];
  title?: string;
  compact?: boolean;
}

function money(value: number | string | null | undefined): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "$0.00";
  return `$${numeric.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function modeLabel(mode: BidLineItem["material_calc_mode"]) {
  return mode === "add" ? "+" : "x";
}

export default function BidLineItemsTable({
  lineItems,
  title = "Quick Bid Line Items",
  compact = false,
}: BidLineItemsTableProps) {
  if (lineItems.length === 0) return null;

  const grandTotal = lineItems.reduce(
    (sum, item) => sum + Number(item.line_total || 0),
    0
  );

  return (
    <div className="rounded-lg bg-bg-warm px-4 py-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
          {title}
        </p>
        <p className="text-sm font-bold text-text-primary">
          {money(grandTotal)}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm tabular-nums">
          <thead>
            <tr className="border-b border-border/70 text-left">
              <th className="py-2 pr-3 font-semibold text-text-primary">
                Line Item
              </th>
              <th className="px-2 py-2 text-center font-semibold text-text-primary">
                Qty
              </th>
              {!compact && (
                <>
                  <th className="px-2 py-2 text-right font-semibold text-text-primary">
                    Material
                  </th>
                  <th className="px-2 py-2 text-right font-semibold text-text-primary">
                    Labor
                  </th>
                </>
              )}
              <th className="py-2 pl-2 text-right font-semibold text-text-primary">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((item) => (
              <tr key={item.id} className="border-b border-border/40 last:border-0">
                <td className="py-2 pr-3 align-top">
                  <p className="font-medium text-text-primary">
                    {item.item_label}
                  </p>
                  {item.is_custom && (
                    <span className="mt-1 inline-flex rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">
                      Custom
                    </span>
                  )}
                </td>
                <td className="px-2 py-2 text-center align-top text-text-secondary">
                  {Number(item.quantity).toLocaleString()} {item.unit || ""}
                </td>
                {!compact && (
                  <>
                    <td className="px-2 py-2 text-right align-top text-text-secondary">
                      <span className="font-medium text-text-primary">
                        {money(item.material_total)}
                      </span>
                      <span className="block text-[11px] text-text-muted">
                        {modeLabel(item.material_calc_mode)} {money(item.material_amount)}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-right align-top text-text-secondary">
                      <span className="font-medium text-text-primary">
                        {money(item.labor_total)}
                      </span>
                      <span className="block text-[11px] text-text-muted">
                        {modeLabel(item.labor_calc_mode)} {money(item.labor_amount)}
                      </span>
                    </td>
                  </>
                )}
                <td className="py-2 pl-2 text-right align-top font-semibold text-text-primary">
                  {money(item.line_total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
