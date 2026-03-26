"use client";

import { useState } from "react";
import { Image as ImageIcon, Eye, EyeOff } from "lucide-react";
import ImageLightbox from "@/components/ImageLightbox";

interface ProjectFileData {
  id: string;
  file_url: string;
  file_name: string;
  file_type: string;
  thumbnail_url: string | null;
  annotated_url: string | null;
}

interface ProjectPhotosBidderProps {
  imageFiles: ProjectFileData[];
}

export default function ProjectPhotosBidder({
  imageFiles,
}: ProjectPhotosBidderProps) {
  const [showOriginals, setShowOriginals] = useState(false);
  const [viewingFile, setViewingFile] = useState<ProjectFileData | null>(null);

  const hasAnnotations = imageFiles.some((f) => f.annotated_url);

  return (
    <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-text-primary">
            Project Photos
          </h2>
        </div>
        {hasAnnotations && (
          <button
            onClick={() => setShowOriginals(!showOriginals)}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-hover transition-colors"
          >
            {showOriginals ? (
              <>
                <Eye className="h-3.5 w-3.5" />
                Show Annotated
              </>
            ) : (
              <>
                <EyeOff className="h-3.5 w-3.5" />
                Show Originals
              </>
            )}
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {imageFiles.map((file) => {
          const showAnnotated = !showOriginals && file.annotated_url;
          const displayUrl = showAnnotated
            ? file.annotated_url!
            : file.thumbnail_url || file.file_url;
          const linkUrl = showAnnotated
            ? file.annotated_url!
            : file.file_url;

          return (
            <div
              key={file.id}
              onClick={() => setViewingFile(file)}
              className="group relative aspect-square overflow-hidden rounded-lg border border-border cursor-pointer"
            >
              <img
                src={displayUrl}
                alt={file.file_name}
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
              />
              {file.annotated_url && !showOriginals && (
                <div className="absolute top-2 left-2 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-slate-950 shadow">
                  ANNOTATED
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                <p className="text-xs text-white truncate">
                  {file.file_name}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Image Lightbox */}
      {viewingFile && (
        <ImageLightbox
          imageUrl={
            !showOriginals && viewingFile.annotated_url
              ? viewingFile.annotated_url
              : viewingFile.file_url
          }
          fileName={viewingFile.file_name}
          onClose={() => setViewingFile(null)}
        />
      )}
    </section>
  );
}
