"use client";

import { useState } from "react";
import {
  Image as ImageIcon,
  Eye,
  EyeOff,
  FileText,
  PlayCircle,
  Video,
  Download,
  Printer,
  ExternalLink,
} from "lucide-react";
import ImageLightbox from "@/components/ImageLightbox";
import VideoLightbox from "@/components/VideoLightbox";
import VideoDurationBadge from "@/components/media/VideoDurationBadge";
import { getProjectOrderedFiles } from "@/lib/project-media";

interface ProjectFileData {
  id: string;
  file_url: string;
  file_name: string;
  file_type: string;
  display_order: number;
  thumbnail_url: string | null;
  annotated_url: string | null;
  uploaded_at?: string;
}

interface ProjectPhotosBidderProps {
  files: ProjectFileData[];
  /**
   * Project id is used to deep-link into the print-friendly photo sheet so
   * contractors can take all the project pictures with them on paper.
   */
  projectId?: string;
}

export default function ProjectPhotosBidder({
  files,
  projectId,
}: ProjectPhotosBidderProps) {
  const [showOriginals, setShowOriginals] = useState(false);
  const [viewingImage, setViewingImage] = useState<ProjectFileData | null>(null);
  const [viewingVideo, setViewingVideo] = useState<ProjectFileData | null>(null);

  const orderedFiles = getProjectOrderedFiles(files) as ProjectFileData[];
  const imageFiles = orderedFiles.filter((file) => file.file_type.startsWith("image/"));
  const videoFiles = orderedFiles.filter((file) => file.file_type.startsWith("video/"));
  const docFiles = orderedFiles.filter(
    (file) =>
      !file.file_type.startsWith("image/") && !file.file_type.startsWith("video/")
  );
  const hasAnnotations = imageFiles.some((file) => file.annotated_url);

  return (
    <>
      {imageFiles.length > 0 && (
        <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-text-primary">
                Project Photos
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {projectId && (
                <button
                  type="button"
                  onClick={() =>
                    window.open(
                      `/print/projects/${projectId}/photos${
                        showOriginals ? "?originals=1" : ""
                      }`,
                      "_blank",
                      "noopener"
                    )
                  }
                  className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-hover"
                  title="Open a printable photo contact sheet"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Print Photos
                </button>
              )}
              {hasAnnotations && (
                <button
                  onClick={() => setShowOriginals(!showOriginals)}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-hover"
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
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {imageFiles.map((file) => {
              const showAnnotated = !showOriginals && file.annotated_url;
              const displayUrl = showAnnotated
                ? file.annotated_url!
                : file.thumbnail_url || file.file_url;

              return (
                <div
                  key={file.id}
                  onClick={() => setViewingImage(file)}
                  className="group relative aspect-square cursor-pointer overflow-hidden rounded-lg border border-border"
                >
                  <img
                    src={displayUrl}
                    alt={file.file_name}
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  />
                  {file.annotated_url && !showOriginals && (
                    <div className="absolute left-2 top-2 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-slate-950 shadow">
                      ANNOTATED
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                    <p className="truncate text-xs text-white">
                      {file.file_name}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {videoFiles.length > 0 && (
        <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Video className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-text-primary">
              Project Videos
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {videoFiles.map((file) => (
              <button
                key={file.id}
                type="button"
                onClick={() => setViewingVideo(file)}
                className="group overflow-hidden rounded-xl border border-border text-left transition-colors hover:border-primary/40"
              >
                <div className="relative aspect-video bg-slate-950">
                  {file.thumbnail_url ? (
                    <img
                      src={file.thumbnail_url}
                      alt={file.file_name}
                      className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-slate-900 text-white/70">
                      <Video className="h-10 w-10" />
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                    <span className="rounded-full bg-white/90 p-3 text-slate-900 shadow-lg">
                      <PlayCircle className="h-7 w-7" />
                    </span>
                  </div>
                  <div className="absolute left-2 top-2 flex items-center gap-2">
                    <div className="rounded-full bg-slate-950/80 px-2 py-0.5 text-[10px] font-semibold text-white">
                      VIDEO
                    </div>
                    <VideoDurationBadge videoUrl={file.file_url} />
                  </div>
                </div>
                <div className="px-4 py-3">
                  <p className="truncate text-sm font-medium text-text-primary">
                    {file.file_name}
                  </p>
                  <p className="mt-1 text-xs text-text-muted">
                    Open the video to review the full site context.
                  </p>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {docFiles.length > 0 && (
        <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-text-primary">
                Documents &amp; Plans
              </h2>
            </div>
            <p className="text-xs text-text-muted">
              Open a doc to print it from your browser, or download to your
              computer.
            </p>
          </div>
          <div className="space-y-2">
            {docFiles.map((file) => (
              <div
                key={file.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-border px-4 py-3 transition-colors hover:bg-surface-hover"
              >
                <FileText className="h-5 w-5 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text-primary">
                    {file.file_name}
                  </p>
                  <p className="text-xs text-text-muted">{file.file_type}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <a
                    href={file.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-bg-warm"
                    title="Open document in a new tab. From there you can use your browser's Print button (Ctrl+P / Cmd+P)."
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open
                  </a>
                  <a
                    href={file.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(event) => {
                      // PDFs and images render natively in the browser, so the
                      // most reliable "print" path is: open the file -> wait
                      // for it to render -> trigger the browser print dialog.
                      const fileWindow = window.open(
                        file.file_url,
                        "_blank",
                        "noopener"
                      );
                      if (fileWindow) {
                        event.preventDefault();
                        // Try to auto-trigger print once the file finishes
                        // loading. Fallback: user can hit Ctrl+P themselves.
                        const tryPrint = () => {
                          try {
                            fileWindow.focus();
                            fileWindow.print();
                          } catch {
                            // Cross-origin browsers will block this; that's
                            // OK — the doc is already open for manual print.
                          }
                        };
                        fileWindow.addEventListener("load", tryPrint);
                        // Safety fallback if `load` never fires (e.g. PDFs
                        // served with content-disposition: attachment).
                        window.setTimeout(tryPrint, 1500);
                      }
                    }}
                    className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/15"
                    title="Open this document and trigger the print dialog"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    Print
                  </a>
                  <a
                    href={file.file_url}
                    download={file.file_name}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-bg-warm"
                    title="Download a copy to your device"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {viewingImage && (
        <ImageLightbox
          imageUrl={
            !showOriginals && viewingImage.annotated_url
              ? viewingImage.annotated_url
              : viewingImage.file_url
          }
          fileName={viewingImage.file_name}
          onClose={() => setViewingImage(null)}
        />
      )}

      {viewingVideo && (
        <VideoLightbox
          videoUrl={viewingVideo.file_url}
          posterUrl={viewingVideo.thumbnail_url}
          fileName={viewingVideo.file_name}
          onClose={() => setViewingVideo(null)}
        />
      )}
    </>
  );
}
