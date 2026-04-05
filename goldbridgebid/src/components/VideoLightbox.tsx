"use client";

import { useCallback, useEffect } from "react";
import { ArrowLeft, X } from "lucide-react";

interface VideoLightboxProps {
  videoUrl: string;
  fileName: string;
  posterUrl?: string | null;
  onClose: () => void;
}

export default function VideoLightbox({
  videoUrl,
  fileName,
  posterUrl,
  onClose,
}: VideoLightboxProps) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [handleKeyDown]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between p-4">
        <button
          onClick={onClose}
          className="flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/20"
        >
          <ArrowLeft className="h-4 w-4" />
          Go Back
        </button>
        <p className="hidden max-w-[50%] truncate text-sm text-white/70 sm:block">
          {fileName}
        </p>
        <button
          onClick={onClose}
          className="rounded-lg border border-white/20 bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <video
        src={videoUrl}
        poster={posterUrl || undefined}
        controls
        playsInline
        preload="metadata"
        className="max-h-[85vh] max-w-[92vw] rounded-lg shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      />

      <div className="absolute inset-x-0 bottom-0 p-4 text-center sm:hidden">
        <p className="truncate text-xs text-white/60">{fileName}</p>
      </div>
    </div>
  );
}
