"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import type {
  AddressQuotePricingLineItem,
  BidLineItemCalcMode,
} from "@/types/database";

type MapMeasurement = {
  id: string;
  measurementType: "polygon_area" | "linear_length";
  label: string;
  areaSqft?: number;
  lengthFt?: number;
};

type PricingRow = {
  rowId: string;
  measurementId: string | null;
  measurementClientId: string | null;
  itemLabel: string;
  description: string | null;
  unit: string;
  quantity: string;
  amount: string;
  calcMode: BidLineItemCalcMode;
  displayOrder: number;
  isCustom: boolean;
};

type SerializedPricingLineItem = {
  measurementId: string | null;
  measurementClientId: string | null;
  itemLabel: string;
  description: string | null;
  unit: string | null;
  quantity: number;
  amount: number;
  calcMode: BidLineItemCalcMode;
  lineTotal: number;
  displayOrder: number;
  isCustom: boolean;
};

interface AddressQuoteBidSheetProps {
  initialLineItems?: AddressQuotePricingLineItem[];
  lockToInitialRows?: boolean;
  syncMeasurements?: boolean;
}

function formatCurrency(value: number): string {
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function parseAmount(value: string): number {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.round(parsed * 100) / 100;
}

function isMoneyInput(raw: string) {
  return raw === "" || /^\d*\.?\d{0,2}$/.test(raw);
}

function applyMode(value: number, mode: BidLineItemCalcMode, quantity: number) {
  return mode === "multiply" ? value * quantity : value;
}

function rowFromMeasurement(measurement: MapMeasurement, index: number): PricingRow {
  const isLine = measurement.measurementType === "linear_length";
  const quantity = isLine ? measurement.lengthFt || 0 : measurement.areaSqft || 0;

  return {
    rowId: `measurement_${measurement.id}`,
    measurementId: null,
    measurementClientId: measurement.id,
    itemLabel: measurement.label || (isLine ? `Line ${index + 1}` : `Area ${index + 1}`),
    description: isLine ? "Map-measured linear item." : "Map-measured area item.",
    unit: isLine ? "linear ft" : "sq ft",
    quantity: quantity > 0 ? String(quantity) : "",
    amount: "",
    calcMode: "multiply",
    displayOrder: index,
    isCustom: false,
  };
}

function rowFromSavedLineItem(
  item: AddressQuotePricingLineItem,
  index: number
): PricingRow {
  return {
    rowId: item.id,
    measurementId: item.measurement_id,
    measurementClientId: item.is_custom ? null : item.measurement_id,
    itemLabel: item.item_label,
    description: item.description,
    unit: item.unit || "ea",
    quantity: item.quantity ? String(item.quantity) : "",
    amount: item.amount ? String(item.amount) : "",
    calcMode: item.calc_mode,
    displayOrder: item.display_order ?? index,
    isCustom: item.is_custom,
  };
}

export default function AddressQuoteBidSheet({
  initialLineItems = [],
  lockToInitialRows = false,
  syncMeasurements = false,
}: AddressQuoteBidSheetProps) {
  const [rows, setRows] = useState<PricingRow[]>(() =>
    initialLineItems.map(rowFromSavedLineItem)
  );
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newUnit, setNewUnit] = useState("ea");

  useEffect(() => {
    if (lockToInitialRows || (!syncMeasurements && initialLineItems.length > 0)) {
      return;
    }

    function handleMeasurements(event: Event) {
      const measurements = (event as CustomEvent<MapMeasurement[]>).detail || [];

      setRows((current) => {
        const customRows = current.filter((row) => row.isCustom);
        const pricedRowsByMeasurement = new Map(
          current
            .filter((row) => !row.isCustom && row.measurementClientId)
            .map((row) => [row.measurementClientId, row])
        );
        const measurementRows = measurements.map((measurement, index) => {
          const existing = pricedRowsByMeasurement.get(measurement.id);
          const template = rowFromMeasurement(measurement, index);

          return existing
            ? {
                ...template,
                amount: existing.amount,
                calcMode: existing.calcMode,
                description: existing.description,
              }
            : template;
        });

        return [...measurementRows, ...customRows].map((row, index) => ({
          ...row,
          displayOrder: index,
        }));
      });
    }

    window.addEventListener("address-quote-measurements-updated", handleMeasurements);

    return () => {
      window.removeEventListener(
        "address-quote-measurements-updated",
        handleMeasurements
      );
    };
  }, [initialLineItems.length, lockToInitialRows, syncMeasurements]);

  const calculatedRows = useMemo(() => {
    return rows.map((row) => {
      const quantity = parseAmount(row.quantity);
      const amount = parseAmount(row.amount);
      const lineTotal = Math.round(applyMode(amount, row.calcMode, quantity) * 100) / 100;

      return {
        ...row,
        parsedQuantity: quantity,
        parsedAmount: amount,
        lineTotal,
      };
    });
  }, [rows]);

  const serializedRows = useMemo<SerializedPricingLineItem[]>(() => {
    return calculatedRows
      .filter(
        (row) =>
          row.itemLabel.trim().length > 0 &&
          (row.lineTotal > 0 || row.parsedQuantity > 0 || row.parsedAmount > 0)
      )
      .map((row) => ({
        measurementId: row.measurementClientId ? null : row.measurementId,
        measurementClientId: row.measurementClientId,
        itemLabel: row.itemLabel.trim(),
        description: row.description,
        unit: row.unit.trim() || null,
        quantity: row.parsedQuantity,
        amount: row.parsedAmount,
        calcMode: row.calcMode,
        lineTotal: row.lineTotal,
        displayOrder: row.displayOrder,
        isCustom: row.isCustom,
      }));
  }, [calculatedRows]);

  const grandTotal = useMemo(
    () => calculatedRows.reduce((sum, row) => sum + row.lineTotal, 0),
    [calculatedRows]
  );
  const unpricedRows = calculatedRows.filter(
    (row) => !row.isCustom && row.lineTotal <= 0
  );

  function updateRow(rowId: string, patch: Partial<PricingRow>) {
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
        measurementId: null,
        measurementClientId: null,
        itemLabel: label,
        description: null,
        unit: newUnit.trim() || "ea",
        quantity: "1",
        amount: "",
        calcMode: "add",
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

  return (
    <section className="overflow-x-hidden rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-6">
      <input type="hidden" name="quoteTotal" value={grandTotal.toFixed(2)} />
      <input
        type="hidden"
        name="pricingLineItemsJson"
        value={JSON.stringify(serializedRows)}
      />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">
            Address Quote Bid Sheet
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-text-secondary">
            Price each measured item as a per-unit cost with ×, or as a lump sum
            with +. Add any hand-entered line items needed to finish the quote.
          </p>
        </div>
        <div className="w-full rounded-lg bg-gradient-to-r from-primary/10 to-secondary/10 px-4 py-2 text-left sm:w-auto sm:text-right">
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
            Quote Total
          </p>
          <p className="text-xl font-bold text-text-primary">
            {formatCurrency(grandTotal)}
          </p>
        </div>
      </div>

      {/* Mobile card layout (< sm) */}
      <div className="mt-5 space-y-3 sm:hidden">
        {calculatedRows.map((row) => (
          <div
            key={row.rowId}
            className="rounded-xl border border-border bg-bg-warm p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-text-primary">{row.itemLabel}</p>
                <span
                  className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                    row.isCustom
                      ? "bg-primary/15 text-primary"
                      : "bg-secondary/15 text-secondary"
                  }`}
                >
                  {row.isCustom ? "Custom" : "Map measured"}
                </span>
                {row.description && (
                  <p className="mt-1 text-xs leading-relaxed text-text-muted">
                    {row.description}
                  </p>
                )}
              </div>
              {row.isCustom && (
                <button
                  type="button"
                  onClick={() => removeRow(row.rowId)}
                  className="shrink-0 rounded p-1 text-text-muted hover:text-red-600"
                  aria-label={`Remove ${row.itemLabel}`}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_minmax(0,1fr)] items-center gap-2 text-xs">
              <div>
                <p className="mb-1 font-semibold text-text-muted">Qty</p>
                <input
                  type="text"
                  inputMode="decimal"
                  value={row.quantity}
                  placeholder="0"
                  onChange={(event) => {
                    const value = event.target.value;
                    if (isMoneyInput(value)) updateRow(row.rowId, { quantity: value });
                  }}
                  className="w-full rounded-md border border-border bg-surface px-2 py-1.5 text-center text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
                />
              </div>
              <div>
                <p className="mb-1 font-semibold text-text-muted">Unit</p>
                <input
                  type="text"
                  value={row.unit}
                  onChange={(event) =>
                    updateRow(row.rowId, { unit: event.target.value })
                  }
                  className="w-16 rounded-md border border-border bg-surface px-2 py-1.5 text-center text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
                />
              </div>
              <div>
                <p className="mb-1 font-semibold text-text-muted">Price</p>
                <div className="flex items-center gap-1">
                  <select
                    value={row.calcMode}
                    onChange={(event) =>
                      updateRow(row.rowId, {
                        calcMode: event.target.value as BidLineItemCalcMode,
                      })
                    }
                    className="shrink-0 rounded-md border border-border bg-bg-warm/60 px-1 py-1.5 text-xs font-semibold text-text-secondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
                  >
                    <option value="multiply">×</option>
                    <option value="add">+</option>
                  </select>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={row.amount}
                    placeholder="0"
                    onChange={(event) => {
                      const value = event.target.value;
                      if (isMoneyInput(value)) updateRow(row.rowId, { amount: value });
                    }}
                    className="min-w-0 flex-1 rounded-md border border-border bg-surface px-1.5 py-1.5 text-right text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
                  />
                </div>
              </div>
              <div className="text-right">
                <p className="mb-1 font-semibold text-text-muted">Total</p>
                <span
                  className={`text-sm font-bold ${
                    row.lineTotal > 0 ? "text-text-primary" : "text-amber-500"
                  }`}
                >
                  {formatCurrency(row.lineTotal)}
                </span>
              </div>
            </div>
          </div>
        ))}
        {calculatedRows.length > 0 && (
          <div className="flex items-center justify-between rounded-xl border-2 border-border bg-surface px-4 py-3">
            <span className="font-bold text-text-primary">Quote Total</span>
            <span className="text-lg font-bold text-text-primary">
              {formatCurrency(grandTotal)}
            </span>
          </div>
        )}
      </div>

      {/* Desktop table layout (sm+) */}
      <div className="mt-5 hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[540px] text-sm tabular-nums">
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
                Price
              </th>
              <th className="w-24 pb-2 pl-2 pr-4 text-right font-semibold text-text-primary">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {calculatedRows.map((row) => (
              <Fragment key={row.rowId}>
                <tr
                  className={`transition-colors hover:bg-bg-warm/30 ${
                    row.description ? "" : "border-b border-border/50"
                  }`}
                >
                  <td className="py-3 pr-3 align-top">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-text-primary">
                          {row.itemLabel}
                        </p>
                        <span
                          className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                            row.isCustom
                              ? "bg-primary/15 text-primary"
                              : "bg-secondary/15 text-secondary"
                          }`}
                        >
                          {row.isCustom ? "Contractor added" : "Map measured"}
                        </span>
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
                      className="mx-auto block w-16 rounded-md border border-border bg-surface px-1 py-1.5 text-center text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
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
                        value={row.calcMode}
                        onChange={(event) =>
                          updateRow(row.rowId, {
                            calcMode: event.target.value as BidLineItemCalcMode,
                          })
                        }
                        className="shrink-0 rounded-md border border-border bg-bg-warm/60 px-1 py-1.5 text-xs font-semibold text-text-secondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
                        title={
                          row.calcMode === "multiply"
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
                        value={row.amount}
                        placeholder="0"
                        onChange={(event) => {
                          const value = event.target.value;
                          if (isMoneyInput(value)) updateRow(row.rowId, { amount: value });
                        }}
                        className="w-20 shrink-0 rounded-md border border-border bg-surface px-1.5 py-1.5 text-right text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
                      />
                    </div>
                  </td>
                  <td className="py-3 pl-2 pr-4 text-right align-top">
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
                  <tr className="border-b border-border/50 transition-colors hover:bg-bg-warm/30">
                    <td colSpan={5} className="px-0 pb-3 pt-0">
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
              <td colSpan={4} className="py-3 pr-3 text-right font-bold text-text-primary">
                Quote Total
              </td>
              <td className="py-3 pl-2 pr-4 text-right">
                <span className="text-lg font-bold text-text-primary">
                  {formatCurrency(grandTotal)}
                </span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {calculatedRows.length === 0 && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900">
          Save a map area, save a map line, or add a hand-entered item to start
          building the quote.
        </div>
      )}

      {unpricedRows.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900">
          {unpricedRows.length} map-measured line item
          {unpricedRows.length === 1 ? " is" : "s are"} still priced at $0.00.
        </div>
      )}

      {showAddForm ? (
        <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
          <p className="mb-3 text-sm font-semibold text-text-primary">
            Add Hand-Entered Line Item
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
                placeholder="e.g. Haul away debris"
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
          Add Hand-Entered Line Item
        </button>
      )}
    </section>
  );
}
