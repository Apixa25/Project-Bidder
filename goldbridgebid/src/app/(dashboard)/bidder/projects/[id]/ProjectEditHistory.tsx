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
  location_address: "Street Address",
  location_city: "City",
  location_state: "State",
  location_zip: "Zip Code",
  budget_min: "Budget Minimum",
  budget_max: "Budget Maximum",
  desired_start_date: "Desired Start Date",
  timeline: "Expected Duration",
};

export default function ProjectEditHistory({
  edits,
}: {
  edits: ProjectEdit[];
}) {
  const [expanded, setExpanded] = useState(false);

  if (edits.length === 0) return null;

  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 shadow-sm">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-slate-500" />
          <span className="text-sm font-medium text-slate-700">
            Project edited after posting
          </span>
          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-600">
            {edits.length} change{edits.length !== 1 ? "s" : ""}
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-slate-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-400" />
        )}
      </button>

      {expanded && (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-slate-500">
            The project owner made changes since the original posting. Your
            existing bids remain date-stamped to their original submission time.
          </p>
          {edits.map((edit) => (
            <div
              key={edit.id}
              className="rounded-lg border border-slate-200 bg-white p-3"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-700">
                  {FIELD_DISPLAY_NAMES[edit.field_name] || edit.field_name}
                </span>
                <span className="text-[11px] text-slate-400">
                  {new Date(edit.edited_at).toLocaleString()}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[11px] text-slate-400 mb-1">Before</p>
                  <p className="text-xs text-red-700 bg-red-50 rounded px-2 py-1.5 line-through break-words">
                    {edit.old_value || "(empty)"}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-400 mb-1">After</p>
                  <p className="text-xs text-green-700 bg-green-50 rounded px-2 py-1.5 break-words">
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
