"use client";

import { useEffect, useCallback } from "react";
import { X, ArrowLeft } from "lucide-react";

interface ImageLightboxProps {
  imageUrl: string;
  fileName: string;
  onClose: () => void;
}

export default function ImageLightbox({
  imageUrl,
  fileName,
  onClose,
}: ImageLightboxProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
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
      {/* Top bar */}
      <div className="absolute top-0 inset-x-0 flex items-center justify-between p-4 z-10">
        <button
          onClick={onClose}
          className="flex items-center gap-2 rounded-lg bg-white/10 border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20 transition-colors backdrop-blur-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          Go Back
        </button>
        <p className="text-sm text-white/70 truncate max-w-[50%] hidden sm:block">
          {fileName}
        </p>
        <button
          onClick={onClose}
          className="rounded-lg bg-white/10 border border-white/20 p-2 text-white hover:bg-white/20 transition-colors backdrop-blur-sm"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Image */}
      <img
        src={imageUrl}
        alt={fileName}
        className="max-h-[85vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />

      {/* Bottom file name (mobile) */}
      <div className="absolute bottom-0 inset-x-0 p-4 text-center sm:hidden">
        <p className="text-xs text-white/60 truncate">{fileName}</p>
      </div>
    </div>
  );
}
