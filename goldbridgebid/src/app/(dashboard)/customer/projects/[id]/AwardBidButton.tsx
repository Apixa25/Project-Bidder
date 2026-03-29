"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Award, Loader2 } from "lucide-react";
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
      className="inline-flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-secondary-dark disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Award className="h-4 w-4" />
      )}
      Award This Bid
    </button>
  );
}
