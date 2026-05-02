"use client";

import { useRef, useState, useTransition } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Trash2 } from "lucide-react";
import { deleteEstimatePackageFile } from "../actions";
import { createClient } from "@/lib/supabase/client";
import { ESTIMATE_PACKAGE_FILE_ACCEPT } from "@/lib/file-uploads";
import { validateEstimatePackageFiles } from "@/lib/upload-validation";

interface PackageFileUploadFormProps {
  packageId: string;
  packageVersionId: string;
  canEditFiles: boolean;
}

export default function PackageFileUploadForm({
  packageId,
  packageVersionId,
  canEditFiles,
}: PackageFileUploadFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function syncFileInput(nextFiles: File[]) {
    if (!fileInputRef.current) return;

    const dataTransfer = new DataTransfer();
    nextFiles.forEach((file) => dataTransfer.items.add(file));
    fileInputRef.current.files = dataTransfer.files;
  }

  function removeSelectedFile(index: number) {
    setFiles((current) => {
      const nextFiles = current.filter((_, itemIndex) => itemIndex !== index);
      syncFileInput(nextFiles);
      return nextFiles;
    });
  }

  function getStoragePath(file: File) {
    const fileExt = file.name.split(".").pop()?.toLowerCase() || "bin";
    const uniqueFileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

    return `estimators/__current_user__/packages/${packageId}/versions/${packageVersionId}/${uniqueFileName}`;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);

    if (files.length === 0) {
      setError("Choose at least one file to upload.");
      return;
    }

    const validationError = validateEstimatePackageFiles(files);
    if (validationError) {
      setError(validationError);
      return;
    }

    startTransition(async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("Not authenticated.");
        return;
      }

      const uploadedFiles: Array<{
        storagePath: string;
        fileName: string;
        fileType: string;
        fileSizeBytes: number;
      }> = [];

      for (const file of files) {
        const storagePath = getStoragePath(file).replace("__current_user__", user.id);
        const { error: uploadError } = await supabase.storage
          .from("estimate-package-files")
          .upload(storagePath, file, { contentType: file.type || undefined });

        if (uploadError) {
          if (uploadedFiles.length > 0) {
            await supabase.storage
              .from("estimate-package-files")
              .remove(uploadedFiles.map((uploadedFile) => uploadedFile.storagePath));
          }

          setError(`Unable to upload "${file.name}".`);
          return;
        }

        uploadedFiles.push({
          storagePath,
          fileName: file.name,
          fileType: file.type || "application/octet-stream",
          fileSizeBytes: file.size,
        });
      }

      const response = await fetch("/api/estimate-package-files/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          packageId,
          packageVersionId,
          files: uploadedFiles,
        }),
      });
      const result = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (result?.error) {
        await supabase.storage
          .from("estimate-package-files")
          .remove(uploadedFiles.map((uploadedFile) => uploadedFile.storagePath));
        setError(result.error);
        return;
      }

      setFiles([]);
      syncFileInput([]);
      setMessage("Package files uploaded.");
      router.refresh();
    });
  }

  if (!canEditFiles) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-text-primary">Package Files</h2>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          This package is published, so its version files are locked. Future
          edits should create a new package version.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-text-primary">Upload Package Files</h2>
      <p className="mt-2 text-sm leading-relaxed text-text-secondary">
        Upload PDFs, spreadsheets, CSVs, documents, text files, or images for
        this draft package version.
      </p>

      <label className="mt-5 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-bg-warm px-4 py-8 text-center transition-colors hover:border-primary/60 hover:bg-primary/5">
        <FileUp className="mb-3 h-8 w-8 text-text-muted" />
        <span className="text-sm font-semibold text-text-primary">
          Choose files
        </span>
        <span className="mt-1 text-xs text-text-muted">
          Images up to 12MB; documents/spreadsheets up to 50MB
        </span>
        <input
          type="file"
          name="files"
          multiple
          accept={ESTIMATE_PACKAGE_FILE_ACCEPT}
          ref={fileInputRef}
          onChange={(event) => {
            setFiles(Array.from(event.target.files || []));
          }}
          className="hidden"
        />
      </label>

      {files.length > 0 && (
        <div className="mt-4 space-y-2">
          {files.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-bg-warm px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-text-primary">
                  {file.name}
                </p>
                <p className="text-xs text-text-muted">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              <button
                type="button"
                onClick={() => removeSelectedFile(index)}
                className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-red-50 hover:text-red-600"
                aria-label={`Remove ${file.name}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {error && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {message && (
        <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending || files.length === 0}
        className="mt-5 inline-flex items-center gap-2 rounded-lg bg-accent-light px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <FileUp className="h-4 w-4" />
        {isPending ? "Uploading..." : "Upload Files"}
      </button>
    </form>
  );
}

export function DeletePackageFileButton({ fileId }: { fileId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteEstimatePackageFile(fileId);

      if (result?.error) {
        setError(result.error);
        return;
      }

      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleDelete}
        disabled={isPending}
        className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60"
        aria-label="Delete package file"
      >
        <Trash2 className="h-4 w-4" />
      </button>
      {error && <p className="max-w-48 text-right text-xs text-red-600">{error}</p>}
    </div>
  );
}

