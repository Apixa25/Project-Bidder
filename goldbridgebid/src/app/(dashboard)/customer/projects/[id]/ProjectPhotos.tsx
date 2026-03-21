"use client";

import { useState } from "react";
import { Image as ImageIcon, Pencil, FileText } from "lucide-react";
import PhotoAnnotator from "@/components/annotation/PhotoAnnotator";
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
  const [fileList, setFileList] = useState(files);

  const imageFiles = fileList.filter((f) => f.file_type.startsWith("image/"));
  const docFiles = fileList.filter((f) => !f.file_type.startsWith("image/"));

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

    setAnnotatingFile(null);
  }

  return (
    <>
      {/* Project Photos */}
      {imageFiles.length > 0 && (
        <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
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
                  className="group relative aspect-square overflow-hidden rounded-lg border border-border"
                >
                  <a
                    href={file.annotated_url || file.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <img
                      src={displayUrl}
                      alt={file.file_name}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                  </a>

                  {/* Annotation badge */}
                  {file.annotated_url && (
                    <div className="absolute top-2 left-2 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white shadow">
                      ANNOTATED
                    </div>
                  )}

                  {/* Bottom overlay with name + annotate button */}
                  <div className="absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/70 to-transparent p-2">
                    <p className="text-xs text-white truncate mr-2">
                      {file.file_name}
                    </p>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setAnnotatingFile(file);
                      }}
                      className="flex items-center gap-1 shrink-0 rounded-md bg-white/90 px-2 py-1 text-[10px] font-semibold text-gray-800 hover:bg-white transition-colors shadow"
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

      {/* Documents */}
      {docFiles.length > 0 && (
        <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
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
                className="flex items-center gap-3 rounded-lg border border-border px-4 py-3 hover:bg-surface-hover transition-colors"
              >
                <FileText className="h-5 w-5 text-primary shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text-primary truncate">
                    {file.file_name}
                  </p>
                  <p className="text-xs text-text-muted">{file.file_type}</p>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Annotation Modal */}
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
