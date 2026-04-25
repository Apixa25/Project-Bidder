"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { uploadAvatar, removeAvatar } from "@/app/(dashboard)/profile/avatar-actions";
import { Camera, Loader2, ZoomIn, ZoomOut, Check, X } from "lucide-react";
import { compressImage, PRESETS } from "@/lib/compress-image";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";

interface AvatarUploadProps {
  currentUrl: string | null;
  userName: string;
}

function createCroppedImage(
  imageSrc: string,
  pixelCrop: Area
): Promise<File> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      const canvas = document.createElement("canvas");
      const size = Math.min(pixelCrop.width, pixelCrop.height);
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas context unavailable"));

      ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        size,
        size
      );

      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error("Canvas blob failed"));
          resolve(new File([blob], "avatar.jpg", { type: "image/jpeg" }));
        },
        "image/jpeg",
        0.92
      );
    };
    image.onerror = () => reject(new Error("Image load failed"));
    image.src = imageSrc;
  });
}

export default function AvatarUpload({ currentUrl, userName }: AvatarUploadProps) {
  const router = useRouter();
  const [avatarUrl, setAvatarUrl] = useState(currentUrl);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Crop state
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
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

  function cancelCrop() {
    setImageSrc(null);
    setCroppedAreaPixels(null);
  }

  async function saveCrop() {
    if (!imageSrc || !croppedAreaPixels) return;

    setUploading(true);
    setError(null);

    try {
      const croppedFile = await createCroppedImage(imageSrc, croppedAreaPixels);
      const { file: compressed } = await compressImage(croppedFile, PRESETS.avatar);

      const formData = new FormData();
      formData.set("avatar", compressed);

      const result = await uploadAvatar(formData);
      if (result.error) {
        setError(result.error);
      } else if (result.success && result.url) {
        setAvatarUrl(result.url);
        router.refresh();
      }
    } catch {
      setError("Failed to crop image. Please try again.");
    }

    setUploading(false);
    setImageSrc(null);
    setCroppedAreaPixels(null);
  }

  async function handleRemove() {
    setRemoving(true);
    setError(null);
    const result = await removeAvatar();
    if (result.success) {
      setAvatarUrl(null);
      router.refresh();
    } else if (result.error) {
      setError(result.error);
    }
    setRemoving(false);
  }

  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <>
      <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
        <div className="relative group">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={userName}
              className="h-24 w-24 rounded-full object-cover border-4 border-white shadow-lg"
            />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-dark text-2xl font-bold text-white border-4 border-white shadow-lg">
              {initials}
            </div>
          )}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            {uploading ? (
              <Loader2 className="h-6 w-6 text-white animate-spin" />
            ) : (
              <Camera className="h-6 w-6 text-white" />
            )}
          </button>
        </div>

        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-text-primary">
            Profile Picture
          </h3>
          <p className="text-xs text-text-muted mb-2">
            JPG, PNG or GIF. You can zoom and crop after selecting.
          </p>
          {error && (
            <p className="text-xs text-red-600 mb-2">{error}</p>
          )}
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-slate-950 transition-colors hover:bg-primary-dark disabled:opacity-50 sm:py-1.5"
            >
              {uploading ? "Uploading..." : avatarUrl ? "Change Photo" : "Upload Photo"}
            </button>
            {avatarUrl && (
              <button
                type="button"
                onClick={handleRemove}
                disabled={removing}
                className="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-500 transition-colors hover:bg-red-50 disabled:opacity-50 sm:py-1.5"
              >
                {removing ? "Removing..." : "Remove"}
              </button>
            )}
          </div>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>

      {/* Crop Modal */}
      {imageSrc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-surface shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h3 className="text-base font-bold text-text-primary">
                Crop Profile Picture ✂️
              </h3>
              <button
                onClick={cancelCrop}
                className="rounded-full p-1 text-text-muted hover:bg-surface-hover transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Cropper Area */}
            <div className="relative h-80 bg-gray-900">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-3 px-5 py-4 border-t border-border">
              <ZoomOut className="h-4 w-4 text-text-muted shrink-0" />
              <input
                type="range"
                min={1}
                max={3}
                step={0.05}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="flex-1 accent-primary h-1.5 cursor-pointer"
              />
              <ZoomIn className="h-4 w-4 text-text-muted shrink-0" />
              <span className="text-xs text-text-muted w-10 text-right">
                {Math.round(zoom * 100)}%
              </span>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 border-t border-border px-5 py-4">
              <button
                onClick={cancelCrop}
                className="rounded-lg border border-border px-5 py-2 text-sm font-medium text-text-secondary hover:bg-surface-hover transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveCrop}
                disabled={uploading}
                className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-slate-950 hover:bg-primary-dark transition-colors disabled:opacity-50"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Save Profile Picture
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
