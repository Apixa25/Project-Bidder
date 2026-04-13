"use client";

import { useState } from "react";
import { History, ChevronDown, ChevronUp } from "lucide-react";

interface ProjectEdit {
  id: string;
  field_name: string;
  old_value: string;
  new_value: string;
  edited_at: string;
}

const FIELD_DISPLAY_NAMES: Record<string, string> = {
  title: "Title",
  description: "Description",
  completion_criteria: "Completion Criteria",
  trades: "Trades Required",
  expertise_level: "Expertise Level",
  location_address: "Street Address",
  location_city: "City",
  location_state: "State",
  location_zip: "ZIP Code",
  budget_min: "Budget Min",
  budget_max: "Budget Max",
  desired_start_date: "Desired Start Date",
  timeline: "Expected Duration",
};

export default function ProjectEditHistoryCollapsible({
  edits,
}: {
  edits: ProjectEdit[];
}) {
  const [expanded, setExpanded] = useState(false);

  if (edits.length === 0) return null;

  return (
    <section className="rounded-xl border border-amber-300 bg-amber-50/50 p-4 shadow-sm">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-amber-700" />
          <h2 className="text-base font-semibold text-amber-900">
            Edit History
          </h2>
          <span className="rounded-full bg-amber-200 px-2.5 py-0.5 text-xs font-medium text-amber-800">
            {edits.length} change{edits.length !== 1 ? "s" : ""}
          </span>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-100">
          {expanded ? (
            <>
              Collapse
              <ChevronUp className="h-3.5 w-3.5" />
            </>
          ) : (
            <>
              Expand
              <ChevronDown className="h-3.5 w-3.5" />
            </>
          )}
        </span>
      </button>

      <p className="mt-2 text-xs text-amber-700">
        This project has been edited after the original posting. All existing
        bids are date-stamped to their original submission time.
      </p>

      {expanded && (
        <div className="mt-4 space-y-3">
          {edits.map((edit) => (
            <div
              key={edit.id}
              className="rounded-lg border border-amber-200 bg-white p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-amber-900">
                  {FIELD_DISPLAY_NAMES[edit.field_name] || edit.field_name}
                </span>
                <span className="text-xs text-amber-600">
                  {new Date(edit.edited_at).toLocaleString()}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-text-muted mb-1">Before</p>
                  <p className="text-sm text-red-700 bg-red-50 rounded-md px-3 py-2 line-through break-words">
                    {edit.old_value || "(empty)"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-text-muted mb-1">After</p>
                  <p className="text-sm text-green-700 bg-green-50 rounded-md px-3 py-2 break-words">
                    {edit.new_value || "(empty)"}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
