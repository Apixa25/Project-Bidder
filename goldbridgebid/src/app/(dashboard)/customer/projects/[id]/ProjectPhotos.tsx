"use client";

import { useState } from "react";
import {
  Image as ImageIcon,
  Pencil,
  FileText,
  Video,
  PlayCircle,
  Star,
  Download,
  ExternalLink,
} from "lucide-react";
import PhotoAnnotator from "@/components/annotation/PhotoAnnotator";
import ImageLightbox from "@/components/ImageLightbox";
import VideoLightbox from "@/components/VideoLightbox";
import VideoDurationBadge from "@/components/media/VideoDurationBadge";
import { getProjectOrderedFiles, getProjectPreviewFile } from "@/lib/project-media";
import { saveAnnotation, setFeaturedProjectFile } from "../actions";

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

interface ProjectPhotosProps {
  files: ProjectFileData[];
}

export default function ProjectPhotos({ files }: ProjectPhotosProps) {
  const [annotatingFile, setAnnotatingFile] = useState<ProjectFileData | null>(
    null
  );
  const [viewingImage, setViewingImage] = useState<ProjectFileData | null>(null);
  const [viewingVideo, setViewingVideo] = useState<ProjectFileData | null>(null);
  const [fileList, setFileList] = useState(files);
  const [featuringFileId, setFeaturingFileId] = useState<string | null>(null);

  const orderedFiles = getProjectOrderedFiles(fileList) as ProjectFileData[];
  const featuredPreviewId = getProjectPreviewFile(orderedFiles)?.id ?? null;
  const imageFiles = orderedFiles.filter((f) => f.file_type.startsWith("image/"));
  const videoFiles = orderedFiles.filter((f) => f.file_type.startsWith("video/"));
  const docFiles = orderedFiles.filter(
    (f) => !f.file_type.startsWith("image/") && !f.file_type.startsWith("video/")
  );

  async function handleSaveAnnotation(fileId: string, blob: Blob) {
    const formData = new FormData();
    formData.append("annotatedImage", blob, "annotated.png");

    const result = await saveAnnotation(fileId, formData);

    if (result.error) {
      throw new Error(result.error);
    }

    if (result.annotatedUrl) {
      setFileList((prev) =>
        prev.map((f) =>
          f.id === fileId ? { ...f, annotated_url: result.annotatedUrl! } : f
        )
      );
    }
  }

  async function handleSetFeatured(fileId: string) {
    setFeaturingFileId(fileId);

    const result = await setFeaturedProjectFile(fileId);

    if (!result.success || !result.orderedIds) {
      setFeaturingFileId(null);
      return;
    }

    const orderMap = new Map(
      result.orderedIds.map((orderedId, index) => [orderedId, index])
    );

    setFileList((prev) =>
      [...prev].sort((left, right) => {
        const leftOrder = orderMap.get(left.id) ?? Number.MAX_SAFE_INTEGER;
        const rightOrder = orderMap.get(right.id) ?? Number.MAX_SAFE_INTEGER;
        return leftOrder - rightOrder;
      }).map((file) => ({
        ...file,
        display_order: orderMap.get(file.id) ?? file.display_order,
      }))
    );

    setFeaturingFileId(null);
  }

  return (
    <>
      {imageFiles.length > 0 && (
        <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-text-primary">
              Project Photos
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {imageFiles.map((file) => {
              const displayUrl =
                file.annotated_url || file.thumbnail_url || file.file_url;
              const isFeaturedPreview = featuredPreviewId === file.id;

              return (
                <div
                  key={file.id}
                  className="group relative aspect-square cursor-pointer overflow-hidden rounded-lg border border-border"
                  onClick={() => setViewingImage(file)}
                >
                  <img
                    src={displayUrl}
                    alt={file.file_name}
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  />
                  {file.annotated_url && (
                    <div className="absolute left-2 top-2 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-slate-950 shadow">
                      ANNOTATED
                    </div>
                  )}
                  {isFeaturedPreview && (
                    <div className="absolute right-2 top-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-slate-950 shadow">
                      FEATURED
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/70 to-transparent p-2">
                    <div className="mr-2 min-w-0">
                      <p className="truncate text-xs text-white">
                        {file.file_name}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          void handleSetFeatured(file.id);
                        }}
                        disabled={featuringFileId === file.id}
                        className="flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[10px] font-semibold text-slate-950 shadow transition-colors hover:bg-primary-light disabled:opacity-60"
                      >
                        <Star className="h-3 w-3" />
                        {isFeaturedPreview ? "Featured" : "Feature"}
                      </button>
                      <button
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          setAnnotatingFile(file);
                        }}
                        className="flex shrink-0 items-center gap-1 rounded-md bg-white/90 px-2 py-1 text-[10px] font-semibold text-gray-800 shadow transition-colors hover:bg-white"
                      >
                        <Pencil className="h-3 w-3" />
                        {file.annotated_url ? "Re-annotate" : "Annotate"}
                      </button>
                    </div>
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
            {videoFiles.map((file) => {
              const isFeaturedPreview = featuredPreviewId === file.id;

              return (
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
                  {isFeaturedPreview && (
                    <div className="absolute right-2 top-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-slate-950 shadow">
                      FEATURED
                    </div>
                  )}
                </div>
                <div className="px-4 py-3">
                  <p className="truncate text-sm font-medium text-text-primary">
                    {file.file_name}
                  </p>
                  <p className="mt-1 text-xs text-text-muted">
                    Contractors will see this video when reviewing the project.
                  </p>
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        void handleSetFeatured(file.id);
                      }}
                      disabled={featuringFileId === file.id}
                      className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-[11px] font-semibold text-slate-950 shadow transition-colors hover:bg-primary-light disabled:opacity-60"
                    >
                      <Star className="h-3.5 w-3.5" />
                      {isFeaturedPreview ? "Featured Preview" : "Set as Featured Preview"}
                    </button>
                  </div>
                </div>
              </button>
            );
            })}
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
              Open to view, or download a copy to your device.
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
                    title="Open document in a new tab"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open
                  </a>
                  <a
                    href={`/api/project-files/${file.id}/download`}
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
          imageUrl={viewingImage.annotated_url || viewingImage.file_url}
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

      {annotatingFile && (
        <PhotoAnnotator
          imageUrl={annotatingFile.file_url}
          fileId={annotatingFile.id}
          onSave={handleSaveAnnotation}
          onClose={() => setAnnotatingFile(null)}
        />
      )}
    </>
  );
}
