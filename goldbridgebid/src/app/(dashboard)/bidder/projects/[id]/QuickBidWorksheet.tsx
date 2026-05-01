"use client";

import { Fragment, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import type { BidLineItemCalcMode } from "@/types/database";

type PublishedScopeItem = {
  id: string;
  item_label: string;
  description: string | null;
  item_category: string;
  quantity_drivers_json: unknown;
  source_method: string | null;
  display_order: number;
};

type WorksheetRow = {
  rowId: string;
  scopeItemId: string | null;
  itemLabel: string;
  description: string | null;
  unit: string;
  quantity: string;
  materialAmount: string;
  materialCalcMode: BidLineItemCalcMode;
  laborAmount: string;
  laborCalcMode: BidLineItemCalcMode;
  displayOrder: number;
  isCustom: boolean;
};

type SerializedBidLineItem = {
  scopeItemId: string | null;
  itemLabel: string;
  description: string | null;
  unit: string | null;
  quantity: number;
  materialAmount: number;
  materialCalcMode: BidLineItemCalcMode;
  materialTotal: number;
  laborAmount: number;
  laborCalcMode: BidLineItemCalcMode;
  laborTotal: number;
  lineTotal: number;
  displayOrder: number;
  isCustom: boolean;
};

interface QuickBidWorksheetProps {
  items: PublishedScopeItem[];
}

function formatCurrency(value: number): string {
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function parseAmount(value: string): number {
  const parsed = parseFloat(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.round(parsed * 100) / 100;
}

function applyMode(value: number, mode: BidLineItemCalcMode, quantity: number) {
  return mode === "multiply" ? value * quantity : value;
}

function getTemplateUnit(item: PublishedScopeItem): string {
  const drivers = Array.isArray(item.quantity_drivers_json)
    ? (item.quantity_drivers_json as Array<{ key: string; unit: string | null }>)
    : [];
  const craftsmanUnit = drivers.find((driver) => driver.key === "craftsman_unit");

  return craftsmanUnit?.unit || "ea";
}

function makeTemplateRows(items: PublishedScopeItem[]): WorksheetRow[] {
  return items.map((item, index) => ({
    rowId: item.id,
    scopeItemId: item.id,
    itemLabel: item.item_label,
    description: item.description,
    unit: getTemplateUnit(item),
    quantity: "",
    materialAmount: "",
    materialCalcMode: "multiply",
    laborAmount: "",
    laborCalcMode: "multiply",
    displayOrder: item.display_order ?? index,
    isCustom: false,
  }));
}

function isMoneyInput(raw: string) {
  return raw === "" || /^\d*\.?\d{0,2}$/.test(raw);
}

export default function QuickBidWorksheet({ items }: QuickBidWorksheetProps) {
  const [rows, setRows] = useState<WorksheetRow[]>(() => makeTemplateRows(items));
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newUnit, setNewUnit] = useState("ea");

  const calculatedRows = useMemo(() => {
    return rows.map((row) => {
      const quantity = parseAmount(row.quantity);
      const materialAmount = parseAmount(row.materialAmount);
      const laborAmount = parseAmount(row.laborAmount);
      const materialTotal = applyMode(
        materialAmount,
        row.materialCalcMode,
        quantity
      );
      const laborTotal = applyMode(laborAmount, row.laborCalcMode, quantity);
      const lineTotal = Math.round((materialTotal + laborTotal) * 100) / 100;

      return {
        ...row,
        quantity,
        materialAmount,
        materialTotal,
        laborAmount,
        laborTotal,
        lineTotal,
      };
    });
  }, [rows]);

  const bidLineItems = useMemo<SerializedBidLineItem[]>(() => {
    return calculatedRows
      .filter(
        (row) =>
          row.itemLabel.trim().length > 0 &&
          (row.lineTotal > 0 ||
            row.quantity > 0 ||
            row.materialAmount > 0 ||
            row.laborAmount > 0)
      )
      .map((row) => ({
        scopeItemId: row.scopeItemId,
        itemLabel: row.itemLabel.trim(),
        description: row.description,
        unit: row.unit.trim() || null,
        quantity: row.quantity,
        materialAmount: row.materialAmount,
        materialCalcMode: row.materialCalcMode,
        materialTotal: row.materialTotal,
        laborAmount: row.laborAmount,
        laborCalcMode: row.laborCalcMode,
        laborTotal: row.laborTotal,
        lineTotal: row.lineTotal,
        displayOrder: row.displayOrder,
        isCustom: row.isCustom,
      }));
  }, [calculatedRows]);

  const grandTotal = useMemo(
    () => calculatedRows.reduce((sum, row) => sum + row.lineTotal, 0),
    [calculatedRows]
  );
  const scopeItemById = useMemo(
    () => new Map(items.map((item) => [item.id, item])),
    [items]
  );
  const unpricedCustomerRows = calculatedRows.filter(
    (row) => !row.isCustom && row.lineTotal <= 0
  );
  const pricedCustomerRowCount = items.length - unpricedCustomerRows.length;

  function updateRow(rowId: string, patch: Partial<WorksheetRow>) {
    setRows((current) =>
      current.map((row) => (row.rowId === rowId ? { ...row, ...patch } : row))
    );
  }

  function addCustomRow() {
    const label = newLabel.trim();
    if (!label) return;

    setRows((current) => [
      ...current,
      {
        rowId: `custom_${Date.now()}`,
        scopeItemId: null,
        itemLabel: label,
        description: null,
        unit: newUnit.trim() || "ea",
        quantity: "",
        materialAmount: "",
        materialCalcMode: "multiply",
        laborAmount: "",
        laborCalcMode: "multiply",
        displayOrder: current.length,
        isCustom: true,
      },
    ]);
    setNewLabel("");
    setNewUnit("ea");
    setShowAddForm(false);
  }

  function removeRow(rowId: string) {
    setRows((current) => current.filter((row) => row.rowId !== rowId));
  }

  if (items.length === 0) return null;

  return (
    <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
      <input type="hidden" name="price" value={grandTotal.toFixed(2)} />
      <input type="hidden" name="bidLineItemsJson" value={JSON.stringify(bidLineItems)} />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-text-primary">
            Customer-Approved Scope Bid Worksheet
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-text-secondary">
            These are the scope items the customer chose to share with bidders.
            Use them as a bid template, but enter your own quantities, material
            pricing, labor pricing, and notes. Your submitted bid stays sealed.
          </p>
        </div>
        <div className="rounded-lg bg-gradient-to-r from-primary/10 to-secondary/10 px-4 py-2 text-right">
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
            Bid Total
          </p>
          <p className="text-xl font-bold text-text-primary">
            {formatCurrency(grandTotal)}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 rounded-lg border border-secondary/20 bg-secondary/5 p-4 text-sm md:grid-cols-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            Customer Scope Items
          </p>
          <p className="mt-1 text-lg font-bold text-text-primary">
            {items.length}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            Priced By You
          </p>
          <p className="mt-1 text-lg font-bold text-text-primary">
            {pricedCustomerRowCount}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            Still $0
          </p>
          <p className="mt-1 text-lg font-bold text-text-primary">
            {unpricedCustomerRows.length}
          </p>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm tabular-nums">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="pb-2 pr-3 font-semibold text-text-primary">
                Line Item
              </th>
              <th className="w-20 px-2 pb-2 text-center font-semibold text-text-primary">
                Qty
              </th>
              <th className="w-20 px-2 pb-2 text-center font-semibold text-text-primary">
                Unit
              </th>
              <th className="w-36 px-2 pb-2 text-right font-semibold text-text-primary">
                Material
              </th>
              <th className="w-36 px-2 pb-2 text-right font-semibold text-text-primary">
                Labor
              </th>
              <th className="w-28 pb-2 pl-2 pr-6 text-right font-semibold text-text-primary">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {calculatedRows.map((row) => (
              <Fragment key={row.rowId}>
                <tr
                  className={`hover:bg-bg-warm/30 transition-colors ${
                    row.description ? "" : "border-b border-border/50"
                  }`}
                >
                  <td className="py-3 pr-3 align-top">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-text-primary">
                          {row.itemLabel}
                        </p>
                        {row.isCustom && (
                          <span className="mt-1 inline-flex rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">
                            Bidder added
                          </span>
                        )}
                        {!row.isCustom &&
                          row.scopeItemId &&
                          scopeItemById.get(row.scopeItemId)?.source_method ===
                            "manual_review" && (
                            <span className="mt-1 inline-flex rounded-full bg-secondary/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-secondary">
                              Customer added
                            </span>
                          )}
                      </div>
                      {row.isCustom && (
                        <button
                          type="button"
                          onClick={() => removeRow(row.rowId)}
                          className="mt-0.5 rounded text-text-muted hover:text-red-600"
                          aria-label={`Remove ${row.itemLabel}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-3 align-top">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={row.quantity}
                      placeholder="0"
                      onChange={(event) => {
                        const value = event.target.value;
                        if (isMoneyInput(value)) updateRow(row.rowId, { quantity: value });
                      }}
                      className="mx-auto block w-14 rounded-md border border-border bg-surface px-1 py-1.5 text-center text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
                    />
                  </td>
                  <td className="px-2 py-3 align-top">
                    <input
                      type="text"
                      value={row.unit}
                      onChange={(event) =>
                        updateRow(row.rowId, { unit: event.target.value })
                      }
                      className="mx-auto block w-16 rounded-md border border-border bg-surface px-1 py-1.5 text-center text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
                    />
                  </td>
                  <td className="px-2 py-3 align-top">
                    <div className="flex items-center justify-end gap-1">
                      <select
                        value={row.materialCalcMode}
                        onChange={(event) =>
                          updateRow(row.rowId, {
                            materialCalcMode: event.target.value as BidLineItemCalcMode,
                          })
                        }
                        className="shrink-0 rounded-md border border-border bg-bg-warm/60 px-1 py-1.5 text-xs font-semibold text-text-secondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
                        title={
                          row.materialCalcMode === "multiply"
                            ? "Per-unit cost, multiplies by Qty"
                            : "Flat fee, added once"
                        }
                      >
                        <option value="multiply">×</option>
                        <option value="add">+</option>
                      </select>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={row.materialAmount}
                        placeholder="0"
                        onChange={(event) => {
                          const value = event.target.value;
                          if (isMoneyInput(value)) {
                            updateRow(row.rowId, { materialAmount: value });
                          }
                        }}
                        className="w-20 shrink-0 rounded-md border border-border bg-surface px-1.5 py-1.5 text-right text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
                      />
                    </div>
                    <p className="mt-1 text-right text-[11px] text-text-muted">
                      = {formatCurrency(row.materialTotal)}
                    </p>
                  </td>
                  <td className="px-2 py-3 align-top">
                    <div className="flex items-center justify-end gap-1">
                      <select
                        value={row.laborCalcMode}
                        onChange={(event) =>
                          updateRow(row.rowId, {
                            laborCalcMode: event.target.value as BidLineItemCalcMode,
                          })
                        }
                        className="shrink-0 rounded-md border border-border bg-bg-warm/60 px-1 py-1.5 text-xs font-semibold text-text-secondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
                        title={
                          row.laborCalcMode === "multiply"
                            ? "Per-unit cost, multiplies by Qty"
                            : "Flat fee, added once"
                        }
                      >
                        <option value="multiply">×</option>
                        <option value="add">+</option>
                      </select>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={row.laborAmount}
                        placeholder="0"
                        onChange={(event) => {
                          const value = event.target.value;
                          if (isMoneyInput(value)) updateRow(row.rowId, { laborAmount: value });
                        }}
                        className="w-20 shrink-0 rounded-md border border-border bg-surface px-1.5 py-1.5 text-right text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
                      />
                    </div>
                    <p className="mt-1 text-right text-[11px] text-text-muted">
                      = {formatCurrency(row.laborTotal)}
                    </p>
                  </td>
                  <td className="py-3 pl-2 pr-6 text-right align-top">
                    <span
                      className={`font-semibold ${
                        row.lineTotal > 0 ? "text-text-primary" : "text-amber-500"
                      }`}
                    >
                      {formatCurrency(row.lineTotal)}
                    </span>
                  </td>
                </tr>
                {row.description && (
                  <tr className="border-b border-border/50 hover:bg-bg-warm/30 transition-colors">
                    <td colSpan={6} className="px-0 pb-3 pt-0">
                      <p className="rounded-lg bg-bg-warm/60 px-3 py-2 text-xs leading-relaxed text-text-muted">
                        {row.description}
                      </p>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border">
              <td colSpan={5} className="py-3 pr-3 text-right font-bold text-text-primary">
                Bid Total
              </td>
              <td className="py-3 pl-2 pr-6 text-right">
                <span className="text-lg font-bold text-text-primary">
                  {formatCurrency(grandTotal)}
                </span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {unpricedCustomerRows.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900">
          {unpricedCustomerRows.length} customer-approved scope item
          {unpricedCustomerRows.length === 1 ? " is" : "s are"} still priced at
          $0.00. You can still submit, but if your bid covers all of the
          customer&apos;s scope, make sure each intended item has a quantity and
          price.
        </div>
      )}

      {showAddForm ? (
        <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
          <p className="mb-3 text-sm font-semibold text-text-primary">
            Add Bidder-Added Line Item
          </p>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem_auto]">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-muted">
                Item Name
              </label>
              <input
                type="text"
                value={newLabel}
                onChange={(event) => setNewLabel(event.target.value)}
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
                onChange={(event) => setNewUnit(event.target.value)}
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
            </div>
            <div className="flex items-end gap-2">
              <button
                type="button"
                onClick={addCustomRow}
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
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowAddForm(true)}
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-dashed border-primary/30 bg-primary/5 px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
        >
          <Plus className="h-4 w-4" />
          Add Bidder-Added Line Item
        </button>
      )}
    </section>
  );
}
