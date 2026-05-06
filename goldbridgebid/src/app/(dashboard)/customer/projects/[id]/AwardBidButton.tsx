"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trophy, Loader2 } from "lucide-react";
import { awardBid } from "../actions";

interface AwardBidButtonProps {
  projectId: string;
  bidId: string;
  bidderName: string;
}

export default function AwardBidButton({
  projectId,
  bidId,
  bidderName,
}: AwardBidButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleAward() {
    const confirmed = window.confirm(
      `Award this project to ${bidderName}? This will mark their bid as the winning bid and notify all bidders.`
    );

    if (!confirmed) return;

    setLoading(true);
    const result = await awardBid(projectId, bidId);

    if (result?.error) {
      window.alert(result.error);
      setLoading(false);
      return;
    }

    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleAward}
      disabled={loading}
      className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-5 py-2.5 text-sm font-bold text-slate-950 shadow ring-2 ring-amber-300/50 transition-all hover:bg-amber-300 hover:-translate-y-px hover:shadow-md active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Trophy className="h-4 w-4" />
      )}
      {loading ? "Awarding…" : "Award This Bid"}
    </button>
  );
}
