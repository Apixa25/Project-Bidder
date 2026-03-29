"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { giveHeart } from "@/app/(dashboard)/profile/reputation-actions";

interface ProfileHeartButtonProps {
  targetUserId: string;
  initialCount: number;
  viewerHasHearted: boolean;
  isOwnProfile: boolean;
}

export default function ProfileHeartButton({
  targetUserId,
  initialCount,
  viewerHasHearted,
  isOwnProfile,
}: ProfileHeartButtonProps) {
  const [count, setCount] = useState(initialCount);
  const [hasHearted, setHasHearted] = useState(viewerHasHearted);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleHeart() {
    if (hasHearted || isOwnProfile || saving) return;

    setSaving(true);
    setError(null);

    const result = await giveHeart(targetUserId);

    if (result?.error) {
      setError(result.error);
      setSaving(false);
      return;
    }

    setHasHearted(true);
    setCount((current) => current + 1);
    setSaving(false);
  }

  return (
    <div className="absolute -bottom-2 -right-2">
      <button
        type="button"
        onClick={handleHeart}
        disabled={hasHearted || isOwnProfile || saving}
        className={`flex min-w-[64px] items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-lg transition-transform ${
          hasHearted
            ? "border-rose-300 bg-rose-100 text-rose-700"
            : isOwnProfile
              ? "border-border bg-surface text-text-muted"
              : "border-rose-200 bg-white text-rose-600 hover:-translate-y-0.5 hover:bg-rose-50"
        }`}
        title={
          isOwnProfile
            ? "You cannot heart your own profile"
            : hasHearted
              ? "You already hearted this profile"
              : "Give this user a quick trust heart"
        }
      >
        <Heart className={`h-4 w-4 ${hasHearted ? "fill-current" : ""}`} />
        <span>{count}</span>
      </button>
      {error && (
        <p className="mt-2 max-w-44 text-right text-[11px] text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
