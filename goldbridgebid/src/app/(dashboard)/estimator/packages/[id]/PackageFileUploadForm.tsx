"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Trash2 } from "lucide-react";
import {
  deleteEstimatePackageFile,
  uploadEstimatePackageFiles,
} from "../actions";
import { ESTIMATE_PACKAGE_FILE_ACCEPT } from "@/lib/file-uploads";

interface PackageFileUploadFormProps {
  packageId: string;
  canEditFiles: boolean;
}

export default function PackageFileUploadForm({
  packageId,
  canEditFiles,
}: PackageFileUploadFormProps) {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function removeSelectedFile(index: number) {
    setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  function handleSubmit(formData: FormData) {
    setMessage(null);
    setError(null);
    formData.set("packageId", packageId);
    files.forEach((file) => formData.append("files", file));

    startTransition(async () => {
      const result = await uploadEstimatePackageFiles(formData);

      if (result?.error) {
        setError(result.error);
        return;
      }

      setFiles([]);
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
    <form action={handleSubmit} className="rounded-xl border border-border bg-surface p-6 shadow-sm">
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
          multiple
          accept={ESTIMATE_PACKAGE_FILE_ACCEPT}
          onChange={(event) => {
            setFiles(Array.from(event.target.files || []));
            event.target.value = "";
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

