"use client";

import { useState, useRef } from "react";
import { uploadCredential, removeCredential } from "./actions";
import {
  Upload,
  CheckCircle2,
  XCircle,
  FileText,
  Loader2,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { compressImage } from "@/lib/compress-image";

interface CredentialCardProps {
  field: string;
  label: string;
  description: string;
  icon: string;
  required: boolean;
  currentUrl: string | null;
}

export default function CredentialCard({
  field,
  label,
  description,
  icon,
  required,
  currentUrl,
}: CredentialCardProps) {
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const isUploaded = currentUrl !== null;

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    const { file: compressed } = await compressImage(file);

    const formData = new FormData();
    formData.set("field", field);
    formData.set("file", compressed);

    const result = await uploadCredential(formData);
    if (result.error) {
      setError(result.error);
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleRemove() {
    setRemoving(true);
    setError(null);
    const result = await removeCredential(field);
    if (result.error) {
      setError(result.error);
    }
    setRemoving(false);
  }

  return (
    <div
      className={`rounded-xl border-2 p-4 shadow-sm transition-colors sm:p-5 ${
        isUploaded
          ? "border-green-200 bg-green-50/50"
          : "border-border bg-surface"
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-text-primary">{label}</h3>
            {required && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                Core
              </span>
            )}
            {isUploaded ? (
              <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
            ) : (
              <XCircle className="h-5 w-5 text-gray-300 shrink-0" />
            )}
          </div>
          <p className="mt-1 text-xs text-text-muted">{description}</p>

          {error && (
            <p className="mt-2 text-xs text-red-600">{error}</p>
          )}

          <div className="mt-3">
            {isUploaded ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <a
                  href={currentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-white px-3 py-2 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-hover sm:w-auto sm:justify-start sm:py-1.5"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  View Document
                </a>
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-white px-3 py-2 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-hover disabled:opacity-50 sm:w-auto sm:justify-start sm:py-1.5"
                >
                  {uploading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="h-3.5 w-3.5" />
                  )}
                  Replace
                </button>
                <button
                  onClick={handleRemove}
                  disabled={removing}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-medium text-red-500 transition-colors hover:bg-red-50 disabled:opacity-50 sm:w-auto sm:justify-start sm:py-1.5"
                >
                  {removing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  Remove
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-secondary px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-secondary-dark disabled:opacity-50 sm:w-auto sm:py-2"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-3.5 w-3.5" />
                    Upload {label}
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
        className="hidden"
        onChange={handleUpload}
      />
    </div>
  );
}
