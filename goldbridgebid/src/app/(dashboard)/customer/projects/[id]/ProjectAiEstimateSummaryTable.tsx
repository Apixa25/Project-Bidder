"use client";

import { useMemo, useState } from "react";
import { Plus, AlertTriangle, BookOpen } from "lucide-react";
import type { ProjectAiScopeItem } from "@/lib/ai-scope-items";

type ScopeItemRow = Pick<
  ProjectAiScopeItem,
  | "id"
  | "item_key"
  | "item_label"
  | "item_category"
  | "estimated_low"
  | "estimated_high"
  | "material_low"
  | "material_high"
  | "labor_low"
  | "labor_high"
  | "equipment_low"
  | "equipment_high"
  | "quantity_drivers_json"
  | "source_method"
  | "description"
>;

export interface CostOverride {
  material: number | null;
  labor: number | null;
}

export interface CustomLineItem {
  id: string;
  label: string;
  unit: string;
  qty: number;
  material: number;
  labor: number;
}

interface ProjectAiEstimateSummaryTableProps {
  items: ScopeItemRow[];
  costOverrides: Record<string, CostOverride>;
  customLineItems: CustomLineItem[];
  onCostOverride: (itemId: string, field: "material" | "labor", value: number | null) => void;
  onAddCustomItem: (item: CustomLineItem) => void;
  onRemoveCustomItem: (id: string) => void;
}

function fmt(val: number | null | undefined): string {
  if (val === null || val === undefined) return "$0.00";
  return `$${val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getQty(item: ScopeItemRow): { qty: number; unit: string } {
  const drivers = (item.quantity_drivers_json || []) as Array<{
    key: string;
    value: string;
    unit: string | null;
  }>;
  const customerQty = drivers.find((d) => d.key === "customer_stated_quantity");
  if (customerQty) {
    const parsed = parseFloat(customerQty.value);
    if (!isNaN(parsed) && parsed > 0) {
      return { qty: parsed, unit: customerQty.unit || "ea" };
    }
  }
  const craftsmanUnit = drivers.find((d) => d.key === "craftsman_unit");
  return { qty: 1, unit: craftsmanUnit?.unit || "ea" };
}

function getMidpoint(low: number | null, high: number | null): number {
  if (low !== null && high !== null) return (low + high) / 2;
  if (low !== null) return low;
  if (high !== null) return high;
  return 0;
}

export default function ProjectAiEstimateSummaryTable({
  items,
  costOverrides,
  customLineItems,
  onCostOverride,
  onAddCustomItem,
  onRemoveCustomItem,
}: ProjectAiEstimateSummaryTableProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newUnit, setNewUnit] = useState("ea");
  const [newQty, setNewQty] = useState("1");
  const [newMaterial, setNewMaterial] = useState("");
  const [newLabor, setNewLabor] = useState("");

  const rows = useMemo(() => {
    return items.map((item) => {
      const override = costOverrides[item.id];
      const { qty, unit } = getQty(item);

      const materialVal = override?.material ?? getMidpoint(item.material_low, item.material_high);
      const laborVal = override?.labor ?? getMidpoint(item.labor_low, item.labor_high);
      const total = materialVal + laborVal;
      const hasPricing = item.material_low !== null || item.labor_low !== null || override?.material !== null || override?.labor !== null;
      const isCraftsmanBacked = item.source_method === "ai_assembly";

      return {
        ...item,
        qty,
        unit,
        materialDisplay: materialVal,
        laborDisplay: laborVal,
        totalDisplay: total,
        hasPricing,
        isCraftsmanBacked,
        hasOverride: override?.material !== null || override?.labor !== null,
      };
    });
  }, [items, costOverrides]);

  const grandTotal = useMemo(() => {
    const itemTotal = rows.reduce((sum, r) => sum + r.totalDisplay, 0);
    const customTotal = customLineItems.reduce(
      (sum, c) => sum + (c.material + c.labor) * c.qty,
      0
    );
    return itemTotal + customTotal;
  }, [rows, customLineItems]);

  function handleAddItem() {
    if (!newLabel.trim()) return;
    onAddCustomItem({
      id: `custom_${Date.now()}`,
      label: newLabel.trim(),
      unit: newUnit || "ea",
      qty: parseFloat(newQty) || 1,
      material: parseFloat(newMaterial) || 0,
      labor: parseFloat(newLabor) || 0,
    });
    setNewLabel("");
    setNewUnit("ea");
    setNewQty("1");
    setNewMaterial("");
    setNewLabor("");
    setShowAddForm(false);
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-text-primary">
            Estimate Summary Table
          </h3>
          <p className="mt-1 text-sm text-text-secondary">
            AI-generated pricing from Craftsman 2023 National Construction
            Estimator. You can override any $0.00 values manually.
          </p>
        </div>
        <div className="rounded-lg bg-gradient-to-r from-primary/10 to-secondary/10 px-4 py-2 text-right">
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
            Grand Total
          </p>
          <p className="text-xl font-bold text-text-primary">
            {fmt(grandTotal)}
          </p>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="pb-2 pr-3 font-semibold text-text-primary">
                Line Item
              </th>
              <th className="pb-2 px-3 font-semibold text-text-primary text-center w-16">
                Unit
              </th>
              <th className="pb-2 px-3 font-semibold text-text-primary text-center w-16">
                Qty
              </th>
              <th className="pb-2 px-3 font-semibold text-text-primary text-right w-32">
                Material
              </th>
              <th className="pb-2 px-3 font-semibold text-text-primary text-right w-32">
                Labor
              </th>
              <th className="pb-2 pl-3 font-semibold text-text-primary text-right w-28">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-border/50 hover:bg-bg-warm/50 transition-colors"
              >
                <td className="py-3 pr-3">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-text-primary">
                        {row.item_label}
                      </p>
                      {!row.hasPricing && (
                        <div className="mt-1 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3 text-amber-500" />
                          <span className="text-xs text-amber-600">
                            Need more info to price this item
                          </span>
                        </div>
                      )}
                      {row.isCraftsmanBacked && row.hasPricing && (
                        <div className="mt-1 flex items-center gap-1">
                          <BookOpen className="h-3 w-3 text-sky-500" />
                          <span className="text-[11px] text-sky-600">
                            Ref: 2023 National Construction Estimator
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3 text-center text-text-secondary">
                  {row.unit}
                </td>
                <td className="px-3 py-3 text-center text-text-secondary">
                  {row.qty}
                </td>
                <td className="px-3 py-3 text-right">
                  {row.hasPricing && !costOverrides[row.id]?.material ? (
                    <span className="font-medium text-text-primary">
                      {fmt(row.materialDisplay)}
                    </span>
                  ) : (
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={
                        costOverrides[row.id]?.material !== null &&
                        costOverrides[row.id]?.material !== undefined
                          ? costOverrides[row.id].material!
                          : row.materialDisplay || ""
                      }
                      onChange={(e) => {
                        const val = e.target.value === "" ? null : parseFloat(e.target.value);
                        onCostOverride(row.id, "material", val);
                      }}
                      placeholder="0.00"
                      className="w-full rounded-md border border-border bg-surface px-2 py-1 text-right text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
                    />
                  )}
                </td>
                <td className="px-3 py-3 text-right">
                  {row.hasPricing && !costOverrides[row.id]?.labor ? (
                    <span className="font-medium text-text-primary">
                      {fmt(row.laborDisplay)}
                    </span>
                  ) : (
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={
                        costOverrides[row.id]?.labor !== null &&
                        costOverrides[row.id]?.labor !== undefined
                          ? costOverrides[row.id].labor!
                          : row.laborDisplay || ""
                      }
                      onChange={(e) => {
                        const val = e.target.value === "" ? null : parseFloat(e.target.value);
                        onCostOverride(row.id, "labor", val);
                      }}
                      placeholder="0.00"
                      className="w-full rounded-md border border-border bg-surface px-2 py-1 text-right text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
                    />
                  )}
                </td>
                <td className="pl-3 py-3 text-right">
                  <span
                    className={`font-semibold ${
                      row.totalDisplay > 0 ? "text-text-primary" : "text-amber-500"
                    }`}
                  >
                    {fmt(row.totalDisplay)}
                  </span>
                </td>
              </tr>
            ))}

            {customLineItems.map((custom) => (
              <tr
                key={custom.id}
                className="border-b border-border/50 bg-primary/5 hover:bg-primary/10 transition-colors"
              >
                <td className="py-3 pr-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-text-primary">
                      {custom.label}
                    </span>
                    <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary uppercase">
                      Custom
                    </span>
                    <button
                      type="button"
                      onClick={() => onRemoveCustomItem(custom.id)}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                </td>
                <td className="px-3 py-3 text-center text-text-secondary">
                  {custom.unit}
                </td>
                <td className="px-3 py-3 text-center text-text-secondary">
                  {custom.qty}
                </td>
                <td className="px-3 py-3 text-right font-medium text-text-primary">
                  {fmt(custom.material * custom.qty)}
                </td>
                <td className="px-3 py-3 text-right font-medium text-text-primary">
                  {fmt(custom.labor * custom.qty)}
                </td>
                <td className="pl-3 py-3 text-right font-semibold text-text-primary">
                  {fmt((custom.material + custom.labor) * custom.qty)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border">
              <td colSpan={5} className="py-3 pr-3 text-right font-bold text-text-primary">
                Grand Total
              </td>
              <td className="pl-3 py-3 text-right">
                <span className="text-lg font-bold text-text-primary">
                  {fmt(grandTotal)}
                </span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {showAddForm ? (
        <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
          <p className="mb-3 text-sm font-semibold text-text-primary">
            Add Custom Line Item
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div className="col-span-2 sm:col-span-1">
              <label className="mb-1 block text-xs font-medium text-text-muted">
                Item Name
              </label>
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="e.g. Dumpster rental"
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-muted">
                Unit
              </label>
              <input
                type="text"
                value={newUnit}
                onChange={(e) => setNewUnit(e.target.value)}
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-muted">
                Qty
              </label>
              <input
                type="number"
                value={newQty}
                onChange={(e) => setNewQty(e.target.value)}
                min="1"
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-muted">
                Material $
              </label>
              <input
                type="number"
                step="0.01"
                value={newMaterial}
                onChange={(e) => setNewMaterial(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-muted">
                Labor $
              </label>
              <input
                type="number"
                step="0.01"
                value={newLabor}
                onChange={(e) => setNewLabor(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handleAddItem}
              disabled={!newLabel.trim()}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-primary-dark disabled:opacity-50"
            >
              Add Item
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-bg-warm"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowAddForm(true)}
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-dashed border-primary/30 bg-primary/5 px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
        >
          <Plus className="h-4 w-4" />
          Add Custom Line Item
        </button>
      )}
    </section>
  );
}
