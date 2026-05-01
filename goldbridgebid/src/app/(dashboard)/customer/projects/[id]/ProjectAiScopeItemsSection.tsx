import type { ProjectAiScopeItem } from "@/lib/ai-scope-items";

interface ProjectAiScopeItemsSectionProps {
  items: Array<
    Pick<
      ProjectAiScopeItem,
      | "id"
      | "item_key"
      | "item_label"
      | "item_category"
      | "required_status"
      | "confidence_level"
      | "description"
      | "why_it_may_apply"
      | "confidence_reason"
      | "estimated_low"
      | "estimated_high"
      | "labor_low"
      | "labor_high"
      | "material_low"
      | "material_high"
      | "equipment_low"
      | "equipment_high"
      | "quantity_drivers_json"
      | "evidence_signals_json"
      | "assumptions_json"
      | "exclusions_json"
      | "source_method"
      | "needs_clarification"
      | "customer_inclusion"
    >
  >;
  itemClarifications: unknown[];
  answers: Record<string, string[]>;
  setSingleValue: (id: string, value: string) => void;
  toggleMultiValue: (id: string, optionId: string) => void;
  onToggleRequired?: (itemId: string, newStatus: "required" | "not_required") => void;
  excludedItemIds?: Set<string>;
  confirmedItemIds?: Set<string>;
  onConfirmItem?: (itemId: string) => void;
}

export default function ProjectAiScopeItemsSection({
  items,
  onToggleRequired,
  excludedItemIds = new Set(),
  confirmedItemIds = new Set(),
  onConfirmItem,
}: ProjectAiScopeItemsSectionProps) {
  if (items.length === 0) {
    return null;
  }

  const excludedItems = items.filter((item) => excludedItemIds.has(item.id));
  const activeItems = items.filter((item) => !excludedItemIds.has(item.id));

  return (
    <section className="rounded-xl border border-border bg-bg-warm/60 p-5">
      <div>
        <h3 className="text-base font-semibold text-text-primary">
          Review Scope Checklist
        </h3>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-text-secondary">
          Decide which AI-suggested items belong in the project. Included items
          become the scope checklist contractors use as their bid starting point;
          skipped items stay out of the bidder view.
        </p>
      </div>

      <div className="mt-4 space-y-2">
        {activeItems.map((item) => {
          const isIncluded =
            item.item_key === "unified_project_package" ||
            item.customer_inclusion === "yes" ||
            confirmedItemIds.has(item.id);

          if (isIncluded) {
            return (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <svg className="h-4 w-4 shrink-0 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm font-medium text-emerald-800">
                    {item.item_label}
                  </span>
                  {item.required_status === "required" && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                      AI recommended
                    </span>
                  )}
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                    Included
                  </span>
                </div>
                {onToggleRequired && item.item_key !== "unified_project_package" && (
                  <button
                    type="button"
                    onClick={() => onToggleRequired(item.id, "not_required")}
                    className="shrink-0 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-500 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-600"
                  >
                    Remove
                  </button>
                )}
              </div>
            );
          }

          return (
            <div
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3"
            >
              <span className="text-sm text-text-primary">
                {item.item_label}
              </span>
              <div className="flex shrink-0 gap-2">
                {item.required_status === "required" && (
                  <span className="hidden rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary sm:inline-flex">
                    AI recommended
                  </span>
                )}
                <span className="hidden rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 sm:inline-flex">
                  Needs decision
                </span>
                {onConfirmItem && (
                  <button
                    type="button"
                    onClick={() => onConfirmItem(item.id)}
                    className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
                  >
                    Yes, include
                  </button>
                )}
                {onToggleRequired && (
                  <button
                    type="button"
                    onClick={() => onToggleRequired(item.id, "not_required")}
                    className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-500 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-600"
                  >
                    No, skip
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Excluded items — compact restore list */}
      {excludedItems.length > 0 && (
        <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50/50 p-3">
          <p className="text-xs font-semibold text-text-muted mb-2">
            Excluded ({excludedItems.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {excludedItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onToggleRequired?.(item.id, "required")}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-text-secondary line-through hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 hover:no-underline"
              >
                {item.item_label} — Restore
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
