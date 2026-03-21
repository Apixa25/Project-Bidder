"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Award, XCircle, Loader2 } from "lucide-react";
import { updateProjectStatus } from "../actions";

interface ProjectStatusActionsProps {
  projectId: string;
  currentStatus: string;
}

export default function ProjectStatusActions({
  projectId,
  currentStatus,
}: ProjectStatusActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  if (currentStatus !== "open") return null;

  async function handleStatusChange(status: "awarded" | "closed") {
    const confirmed = window.confirm(
      status === "awarded"
        ? "Award this project? All bidders will be notified that the project has been awarded."
        : "Close this project? It will no longer accept bids."
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

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => handleStatusChange("awarded")}
        disabled={loading !== null}
        className="flex items-center gap-2 rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-secondary-dark transition-colors disabled:opacity-60"
      >
        {loading === "awarded" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Award className="h-4 w-4" />
        )}
        Award Project
      </button>
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
    </div>
  );
}
