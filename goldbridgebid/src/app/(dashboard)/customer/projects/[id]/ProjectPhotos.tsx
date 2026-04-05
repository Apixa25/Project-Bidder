"use client";

import { useState } from "react";
import {
  Image as ImageIcon,
  Pencil,
  FileText,
  Video,
  PlayCircle,
} from "lucide-react";
import PhotoAnnotator from "@/components/annotation/PhotoAnnotator";
import ImageLightbox from "@/components/ImageLightbox";
import VideoLightbox from "@/components/VideoLightbox";
import VideoDurationBadge from "@/components/media/VideoDurationBadge";
import { saveAnnotation } from "../actions";

interface ProjectFileData {
  id: string;
  file_url: string;
  file_name: string;
  file_type: string;
  thumbnail_url: string | null;
  annotated_url: string | null;
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

  const imageFiles = fileList.filter((f) => f.file_type.startsWith("image/"));
  const videoFiles = fileList.filter((f) => f.file_type.startsWith("video/"));
  const docFiles = fileList.filter(
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
                  <div className="absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/70 to-transparent p-2">
                    <p className="mr-2 truncate text-xs text-white">
                      {file.file_name}
                    </p>
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
                    Contractors will see this video when reviewing the project.
                  </p>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {docFiles.length > 0 && (
        <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-text-primary">
              Documents & Plans
            </h2>
          </div>
          <div className="space-y-2">
            {docFiles.map((file) => (
              <a
                key={file.id}
                href={file.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-lg border border-border px-4 py-3 transition-colors hover:bg-surface-hover"
              >
                <FileText className="h-5 w-5 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text-primary">
                    {file.file_name}
                  </p>
                  <p className="text-xs text-text-muted">{file.file_type}</p>
                </div>
              </a>
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
