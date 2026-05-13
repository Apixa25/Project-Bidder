"use client";

import { useState } from "react";
import { ShieldOff, X } from "lucide-react";
import { bulkBanUsers } from "@/app/(dashboard)/admin/actions";
import ConfirmDialog from "@/components/admin/ConfirmDialog";

interface BulkActionBarProps {
  selectedIds: string[];
  onClear: () => void;
  onComplete: () => void;
}

export default function BulkActionBar({
  selectedIds,
  onClear,
  onComplete,
}: BulkActionBarProps) {
  const [showBulkBan, setShowBulkBan] = useState(false);

  if (selectedIds.length === 0) return null;

  return (
    <>
      <div className="sticky bottom-4 z-30 mx-auto w-fit rounded-xl border border-primary/30 bg-surface px-5 py-3 shadow-xl">
        <div className="flex items-center gap-4">
          <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-primary px-2 text-xs font-bold text-white">
            {selectedIds.length}
          </span>
          <span className="text-sm font-medium text-text-primary">
            user{selectedIds.length !== 1 ? "s" : ""} selected
          </span>
          <div className="h-5 w-px bg-border" />
          <button
            onClick={() => setShowBulkBan(true)}
            className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 transition-colors"
          >
            <ShieldOff className="h-3.5 w-3.5" />
            Ban Selected
          </button>
          <button
            onClick={onClear}
            className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-hover transition-colors"
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={showBulkBan}
        onClose={() => setShowBulkBan(false)}
        onConfirm={async (reason) => {
          await bulkBanUsers(selectedIds, reason);
          setShowBulkBan(false);
          onComplete();
        }}
        title={`Ban ${selectedIds.length} user${selectedIds.length !== 1 ? "s" : ""}`}
        description={`This will immediately ban ${selectedIds.length} selected user${selectedIds.length !== 1 ? "s" : ""} from the platform.`}
        confirmLabel="Ban All Selected"
        confirmColor="amber"
        showReasonInput
        reasonRequired
      />
    </>
  );
}
