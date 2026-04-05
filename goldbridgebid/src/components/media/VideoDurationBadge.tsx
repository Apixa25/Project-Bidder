"use client";

import { useEffect, useState } from "react";

function formatDuration(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${remainingSeconds
      .toString()
      .padStart(2, "0")}`;
  }

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

interface VideoDurationBadgeProps {
  videoUrl: string;
  className?: string;
}

export default function VideoDurationBadge({
  videoUrl,
  className = "",
}: VideoDurationBadgeProps) {
  const [duration, setDuration] = useState<number | null>(null);

  useEffect(() => {
    let isCancelled = false;
    const video = document.createElement("video");

    video.preload = "metadata";
    video.src = videoUrl;

    const handleLoadedMetadata = () => {
      if (isCancelled || !Number.isFinite(video.duration) || video.duration <= 0) {
        return;
      }

      setDuration(video.duration);
    };

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.load();

    return () => {
      isCancelled = true;
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.src = "";
    };
  }, [videoUrl]);

  if (!duration) {
    return null;
  }

  return (
    <span
      className={
        className ||
        "rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-white"
      }
    >
      {formatDuration(duration)}
    </span>
  );
}
