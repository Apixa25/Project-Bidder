"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { XCircle, Loader2, Trash2, Pencil, CheckCircle2 } from "lucide-react";
import { updateProjectStatus, deleteProject, markProjectCompleted } from "../actions";
import Link from "next/link";

interface ProjectStatusActionsProps {
  projectId: string;
  currentStatus: string;
}

export default function ProjectStatusActions({ projectId, currentStatus }: ProjectStatusActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function handleStatusChange(status: "closed") {
    const confirmed = window.confirm(
      "Close this project? It will no longer accept bids."
    );

    if (!confirmed) return;

    setLoading(status);
    const result = await updateProjectStatus(projectId, status);
    if (result?.error) {
      alert(result.error);
    }
    setLoading(null);
    router.refresh();
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      "Are you sure you want to permanently delete this project? This will remove all bids, messages, and files. This action cannot be undone."
    );

    if (!confirmed) return;

    const doubleConfirm = window.confirm(
      "This is your final warning. All data for this project will be permanently deleted. Continue?"
    );

    if (!doubleConfirm) return;

    setLoading("delete");
    const result = await deleteProject(projectId);
    if (result?.error) {
      alert(result.error);
      setLoading(null);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href={`/customer/projects/${projectId}/edit`}
        className="flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-text-secondary shadow-sm hover:bg-primary/5 hover:text-primary hover:border-primary/30 transition-colors"
      >
        <Pencil className="h-4 w-4" />
        Edit
      </Link>

      {currentStatus === "open" && (
        <button
          onClick={() => handleStatusChange("closed")}
          disabled={loading !== null}
          className="flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-text-secondary shadow-sm hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors disabled:opacity-60"
        >
          {loading === "closed" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <XCircle className="h-4 w-4" />
          )}
          Close Project
        </button>
      )}

      {currentStatus === "awarded" && (
        <button
          onClick={async () => {
            const confirmed = window.confirm(
              "Mark this project as complete? This will prompt both you and the contractor to leave reviews."
            );
            if (!confirmed) return;
            setLoading("completed");
            const result = await markProjectCompleted(projectId);
            if (result?.error) {
              alert(result.error);
            }
            setLoading(null);
            router.refresh();
          }}
          disabled={loading !== null}
          className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm font-medium text-green-700 shadow-sm hover:bg-green-100 hover:border-green-300 transition-colors disabled:opacity-60"
        >
          {loading === "completed" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          Mark Complete
        </button>
      )}

      <button
        onClick={handleDelete}
        disabled={loading !== null}
        className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 shadow-sm hover:bg-red-100 hover:border-red-300 transition-colors disabled:opacity-60"
      >
        {loading === "delete" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Trash2 className="h-4 w-4" />
        )}
        Delete
      </button>
    </div>
  );
}
