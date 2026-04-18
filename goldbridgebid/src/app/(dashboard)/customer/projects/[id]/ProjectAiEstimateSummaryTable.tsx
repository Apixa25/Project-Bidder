"use client";

import { useMemo, useState } from "react";
import { Plus, AlertTriangle, BookOpen, Sparkles } from "lucide-react";
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
  | "material_calc_mode"
  | "labor_calc_mode"
>;

export type CalcMode = "multiply" | "add";

export interface CostOverride {
  material: number | null;
  labor: number | null;
}

export interface QuantityOverride {
  qty: number;
  unit: string | null;
}

export interface ModeOverride {
  material: CalcMode | null;
  labor: CalcMode | null;
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
  quantityOverrides: Record<string, QuantityOverride>;
  modeOverrides: Record<string, ModeOverride>;
  customLineItems: CustomLineItem[];
  onCostOverride: (
    itemId: string,
    field: "material" | "labor",
    value: number | null
  ) => void;
  onQuantityOverride: (
    itemId: string,
    qty: number,
    unit: string | null
  ) => void;
  onModeOverride: (
    itemId: string,
    field: "material" | "labor",
    mode: CalcMode
  ) => void;
  onAddCustomItem: (item: CustomLineItem) => void;
  onRemoveCustomItem: (id: string) => void;
}

function fmt(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return "$0.00";
  return `$${val.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getInitialQty(item: ScopeItemRow): { qty: number; unit: string } {
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

function getMidpoint(low: number | null, high: number | null): number | null {
  if (low !== null && high !== null) return (low + high) / 2;
  if (low !== null) return low;
  if (high !== null) return high;
  return null;
}

/**
 * Compute the contribution of a line value to the row total based on its
 * calc mode. "multiply" treats the value as per-unit and multiplies by qty.
 * "add" treats it as a flat fee and uses it as-is.
 */
function applyMode(
  value: number | null,
  mode: CalcMode,
  qty: number
): number {
  if (value === null || isNaN(value)) return 0;
  if (mode === "multiply") return value * (qty || 0);
  return value;
}

export default function ProjectAiEstimateSummaryTable({
  items,
  costOverrides,
  quantityOverrides,
  modeOverrides,
  customLineItems,
  onCostOverride,
  onQuantityOverride,
  onModeOverride,
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
      const qtyOverride = quantityOverrides[item.id];
      const modeOverride = modeOverrides[item.id];
      const initial = getInitialQty(item);

      const qty = qtyOverride?.qty ?? initial.qty;
      const unit = qtyOverride?.unit ?? initial.unit;

      const aiMaterial = getMidpoint(item.material_low, item.material_high);
      const aiLabor = getMidpoint(item.labor_low, item.labor_high);

      const materialVal =
        override?.material !== undefined && override?.material !== null
          ? override.material
          : aiMaterial;

      const laborVal =
        override?.labor !== undefined && override?.labor !== null
          ? override.labor
          : aiLabor;

      const materialMode: CalcMode =
        modeOverride?.material ??
        (item.material_calc_mode as CalcMode) ??
        "multiply";

      const laborMode: CalcMode =
        modeOverride?.labor ??
        (item.labor_calc_mode as CalcMode) ??
        "multiply";

      const materialContribution = applyMode(materialVal, materialMode, qty);
      const laborContribution = applyMode(laborVal, laborMode, qty);
      const total = materialContribution + laborContribution;

      const aiPriced = aiMaterial !== null || aiLabor !== null;
      const isCraftsmanBacked = item.source_method === "ai_assembly";
      const userTouched =
        override?.material !== undefined ||
        override?.labor !== undefined ||
        qtyOverride !== undefined ||
        modeOverride !== undefined;

      return {
        ...item,
        qty,
        unit,
        materialVal,
        laborVal,
        materialMode,
        laborMode,
        materialContribution,
        laborContribution,
        total,
        aiPriced,
        isCraftsmanBacked,
        userTouched,
      };
    });
  }, [items, costOverrides, quantityOverrides, modeOverrides]);

  const grandTotal = useMemo(() => {
    const itemTotal = rows.reduce((sum, r) => sum + (r.total || 0), 0);
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

  if (items.length === 0 && customLineItems.length === 0) {
    return null;
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-text-primary">
            Line-Item Estimate Worksheet
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-text-secondary">
            Every cell is editable. Use the dropdown next to each price to
            specify whether it&apos;s a <strong>per-unit cost</strong> (× Qty)
            or a <strong>flat fee</strong> (+ added once). Example: gravel at
            $47/ton × 10 tons + $200 flat labor = $670 total.
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
              <th className="pb-2 px-3 font-semibold text-text-primary text-center w-20">
                Qty
              </th>
              <th className="pb-2 px-3 font-semibold text-text-primary text-center w-16">
                Unit
              </th>
              <th className="pb-2 px-3 font-semibold text-text-primary text-right w-44">
                Material
              </th>
              <th className="pb-2 px-3 font-semibold text-text-primary text-right w-44">
                Labor
              </th>
              <th className="pb-2 pl-3 font-semibold text-text-primary text-right w-28">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const overrideMaterial = costOverrides[row.id]?.material;
              const overrideLabor = costOverrides[row.id]?.labor;
              const overrideQty = quantityOverrides[row.id];

              const materialInputValue =
                overrideMaterial !== undefined && overrideMaterial !== null
                  ? String(overrideMaterial)
                  : row.materialVal !== null
                    ? String(row.materialVal)
                    : "";

              const laborInputValue =
                overrideLabor !== undefined && overrideLabor !== null
                  ? String(overrideLabor)
                  : row.laborVal !== null
                    ? String(row.laborVal)
                    : "";

              const qtyInputValue =
                overrideQty !== undefined ? String(overrideQty.qty) : String(row.qty);

              return (
                <tr
                  key={row.id}
                  className="border-b border-border/50 hover:bg-bg-warm/30 transition-colors"
                >
                  <td className="py-3 pr-3 align-top">
                    <p className="font-medium text-text-primary">
                      {row.item_label}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                      {!row.aiPriced && !row.userTouched && (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                          <AlertTriangle className="h-3 w-3" />
                          Need more info — please enter values
                        </span>
                      )}
                      {row.isCraftsmanBacked && row.aiPriced && !row.userTouched && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-sky-600">
                          <BookOpen className="h-3 w-3" />
                          Auto-filled from Craftsman 2023 NCE
                        </span>
                      )}
                      {row.userTouched && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                          <Sparkles className="h-3 w-3" />
                          Customized by you
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3 align-top">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={qtyInputValue}
                      onChange={(e) => {
                        const raw = e.target.value;
                        const parsed = raw === "" ? 0 : parseFloat(raw);
                        onQuantityOverride(
                          row.id,
                          isNaN(parsed) ? 0 : parsed,
                          row.unit || null
                        );
                      }}
                      className="w-full rounded-md border border-border bg-surface px-2 py-1 text-center text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
                    />
                  </td>
                  <td className="px-3 py-3 align-top text-center text-text-secondary">
                    {row.unit}
                  </td>
                  <td className="px-3 py-3 align-top">
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={materialInputValue}
                        placeholder="0.00"
                        onChange={(e) => {
                          const raw = e.target.value;
                          const val = raw === "" ? null : parseFloat(raw);
                          onCostOverride(
                            row.id,
                            "material",
                            isNaN(val as number) ? null : val
                          );
                        }}
                        className="w-full rounded-md border border-border bg-surface px-2 py-1 text-right text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
                      />
                      <select
                        value={row.materialMode}
                        onChange={(e) =>
                          onModeOverride(
                            row.id,
                            "material",
                            e.target.value as CalcMode
                          )
                        }
                        title={
                          row.materialMode === "multiply"
                            ? "Per-unit cost — multiplies by Qty"
                            : "Flat fee — added once"
                        }
                        className="rounded-md border border-border bg-bg-warm/60 px-1.5 py-1 text-xs font-semibold text-text-secondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
                      >
                        <option value="multiply">× qty</option>
                        <option value="add">+ flat</option>
                      </select>
                    </div>
                    <p className="mt-1 text-right text-[11px] text-text-muted">
                      = {fmt(row.materialContribution)}
                    </p>
                  </td>
                  <td className="px-3 py-3 align-top">
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={laborInputValue}
                        placeholder="0.00"
                        onChange={(e) => {
                          const raw = e.target.value;
                          const val = raw === "" ? null : parseFloat(raw);
                          onCostOverride(
                            row.id,
                            "labor",
                            isNaN(val as number) ? null : val
                          );
                        }}
                        className="w-full rounded-md border border-border bg-surface px-2 py-1 text-right text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
                      />
                      <select
                        value={row.laborMode}
                        onChange={(e) =>
                          onModeOverride(
                            row.id,
                            "labor",
                            e.target.value as CalcMode
                          )
                        }
                        title={
                          row.laborMode === "multiply"
                            ? "Per-unit cost — multiplies by Qty"
                            : "Flat fee — added once"
                        }
                        className="rounded-md border border-border bg-bg-warm/60 px-1.5 py-1 text-xs font-semibold text-text-secondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
                      >
                        <option value="multiply">× qty</option>
                        <option value="add">+ flat</option>
                      </select>
                    </div>
                    <p className="mt-1 text-right text-[11px] text-text-muted">
                      = {fmt(row.laborContribution)}
                    </p>
                  </td>
                  <td className="pl-3 py-3 align-top text-right">
                    <span
                      className={`font-semibold ${
                        row.total > 0 ? "text-text-primary" : "text-amber-500"
                      }`}
                    >
                      {fmt(row.total)}
                    </span>
                  </td>
                </tr>
              );
            })}

            {customLineItems.map((custom) => (
              <tr
                key={custom.id}
                className="border-b border-border/50 bg-primary/5 hover:bg-primary/10 transition-colors"
              >
                <td className="py-3 pr-3 align-top">
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
                <td className="px-3 py-3 align-top text-center text-text-secondary">
                  {custom.qty}
                </td>
                <td className="px-3 py-3 align-top text-center text-text-secondary">
                  {custom.unit}
                </td>
                <td className="px-3 py-3 align-top text-right font-medium text-text-primary">
                  {fmt(custom.material * custom.qty)}
                </td>
                <td className="px-3 py-3 align-top text-right font-medium text-text-primary">
                  {fmt(custom.labor * custom.qty)}
                </td>
                <td className="pl-3 py-3 align-top text-right font-semibold text-text-primary">
                  {fmt((custom.material + custom.labor) * custom.qty)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border">
              <td
                colSpan={5}
                className="py-3 pr-3 text-right font-bold text-text-primary"
              >
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
