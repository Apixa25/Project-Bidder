"use client";

import { useState, useRef } from "react";
import { uploadAvatar, removeAvatar } from "@/app/(dashboard)/profile/avatar-actions";
import { Camera, Loader2, Trash2, User } from "lucide-react";
import { compressImage, PRESETS } from "@/lib/compress-image";

interface AvatarUploadProps {
  currentUrl: string | null;
  userName: string;
}

export default function AvatarUpload({ currentUrl, userName }: AvatarUploadProps) {
  const [avatarUrl, setAvatarUrl] = useState(currentUrl);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    const { file: compressed } = await compressImage(file, PRESETS.avatar);

    const formData = new FormData();
    formData.set("avatar", compressed);

    const result = await uploadAvatar(formData);
    if (result.error) {
      setError(result.error);
    } else if (result.success && result.url) {
      setAvatarUrl(result.url + "?t=" + Date.now());
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleRemove() {
    setRemoving(true);
    const result = await removeAvatar();
    if (result.success) {
      setAvatarUrl(null);
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
    <div className="flex items-center gap-5">
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

      <div>
        <h3 className="text-sm font-semibold text-text-primary">
          Profile Picture
        </h3>
        <p className="text-xs text-text-muted mb-2">
          JPG, PNG or GIF. Max 12MB.
        </p>
        {error && (
          <p className="text-xs text-red-600 mb-2">{error}</p>
        )}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-dark transition-colors disabled:opacity-50"
          >
            {uploading ? "Uploading..." : avatarUrl ? "Change Photo" : "Upload Photo"}
          </button>
          {avatarUrl && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={removing}
              className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
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
        onChange={handleUpload}
      />
    </div>
  );
}
