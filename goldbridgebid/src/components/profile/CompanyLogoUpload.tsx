"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Check,
  Loader2,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import {
  removeCompanyLogo,
  uploadCompanyLogo,
} from "@/app/(dashboard)/profile/avatar-actions";
import { compressImage, PRESETS } from "@/lib/compress-image";

interface CompanyLogoUploadProps {
  currentUrl: string | null;
  businessName: string | null;
}

function createPositionedLogo(imageSrc: string, pixelCrop: Area): Promise<File> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 1000;
      canvas.height = 1000;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas context unavailable"));

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        canvas.width,
        canvas.height
      );

      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error("Canvas blob failed"));
          resolve(
            new File([blob], "company-logo-square.jpg", { type: "image/jpeg" })
          );
        },
        "image/jpeg",
        0.92
      );
    };
    image.onerror = () => reject(new Error("Image load failed"));
    image.src = imageSrc;
  });
}

export default function CompanyLogoUpload({
  currentUrl,
  businessName,
}: CompanyLogoUploadProps) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [logoUrl, setLogoUrl] = useState(currentUrl);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      setImageSrc(reader.result as string);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    };
    reader.readAsDataURL(file);
    if (fileRef.current) fileRef.current.value = "";
  }

  function cancelPositioning() {
    setImageSrc(null);
    setCroppedAreaPixels(null);
  }

  async function savePositionedLogo() {
    if (!imageSrc || !croppedAreaPixels) return;

    setUploading(true);
    setError(null);

    try {
      const positionedFile = await createPositionedLogo(
        imageSrc,
        croppedAreaPixels
      );
      const { file: compressed } = await compressImage(
        positionedFile,
        PRESETS.general
      );
      const formData = new FormData();
      formData.set("companyLogo", compressed);

      const result = await uploadCompanyLogo(formData);
      if (result.error) {
        setError(result.error);
      } else if (result.success && result.url) {
        setLogoUrl(result.url);
        router.refresh();
      }
    } catch {
      setError("Failed to upload logo. Please try again.");
    }

    setUploading(false);
    setImageSrc(null);
    setCroppedAreaPixels(null);
  }

  async function handleRemove() {
    setRemoving(true);
    setError(null);
    const result = await removeCompanyLogo();
    if (result.success) {
      setLogoUrl(null);
      router.refresh();
    } else if (result.error) {
      setError(result.error);
    }
    setRemoving(false);
  }

  return (
    <>
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-bg-warm p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={`${businessName || "Company"} logo`}
              className="h-20 w-20 rounded-xl border border-border bg-white object-cover shadow-sm"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-xl border border-border bg-surface text-secondary shadow-sm">
              <Building2 className="h-8 w-8" />
            </div>
          )}
          <div>
            <h3 className="text-sm font-semibold text-text-primary">
              Company Logo
            </h3>
            <p className="mt-1 max-w-xl text-xs leading-5 text-text-muted">
              This logo appears on public address quotes and future official bid
              documents. Use the positioning tool to zoom and pan the logo until
              it fills the square logo box.
            </p>
            {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-slate-950 transition-colors hover:bg-primary-dark disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {uploading
              ? "Uploading..."
              : logoUrl
                ? "Change Logo"
                : "Upload Logo"}
          </button>
          {logoUrl && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={removing}
              className="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-500 transition-colors hover:bg-red-50 disabled:opacity-50"
            >
              {removing ? "Removing..." : "Remove"}
            </button>
          )}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>

      {imageSrc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-surface shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h3 className="text-base font-bold text-text-primary">
                Position Square Company Logo
              </h3>
              <button
                type="button"
                onClick={cancelPositioning}
                className="rounded-full p-1 text-text-muted transition-colors hover:bg-surface-hover"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="relative mx-auto h-80 w-full max-w-md bg-gray-900">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="rect"
                objectFit="cover"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>

            <div className="flex items-center gap-3 border-t border-border px-5 py-4">
              <ZoomOut className="h-4 w-4 shrink-0 text-text-muted" />
              <input
                type="range"
                min={1}
                max={3}
                step={0.05}
                value={zoom}
                onChange={(event) => setZoom(Number(event.target.value))}
                className="h-1.5 flex-1 cursor-pointer accent-primary"
              />
              <ZoomIn className="h-4 w-4 shrink-0 text-text-muted" />
              <span className="w-10 text-right text-xs text-text-muted">
                {Math.round(zoom * 100)}%
              </span>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-border px-5 py-4">
              <button
                type="button"
                onClick={cancelPositioning}
                className="rounded-lg border border-border px-5 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-hover"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={savePositionedLogo}
                disabled={uploading}
                className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-primary-dark disabled:opacity-50"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Save Company Logo
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
