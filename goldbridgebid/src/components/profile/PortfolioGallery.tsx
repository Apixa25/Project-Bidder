"use client";

import { useState, useEffect } from "react";
import {
  addPortfolioItem,
  removePortfolioItem,
  removePortfolioMedia,
} from "@/app/(dashboard)/profile/portfolio-actions";
import {
  Plus,
  Loader2,
  X,
  Image as ImageIcon,
  Video,
  Trash2,
  Play,
  ChevronLeft,
  ChevronRight,
  Layers,
  ArrowLeftRight,
} from "lucide-react";
import { compressFiles } from "@/lib/compress-image";
import BeforeAfterSlider from "./BeforeAfterSlider";

interface MediaData {
  id: string;
  media_url: string;
  media_type: string;
  thumbnail_url: string | null;
}

interface PortfolioItemData {
  id: string;
  media_url: string;
  media_type: string;
  thumbnail_url: string | null;
  title: string;
  description: string | null;
  item_type?: string;
  media?: MediaData[];
}

interface PortfolioGalleryProps {
  items: PortfolioItemData[];
  isOwner: boolean;
  ownerRole: string;
}

export default function PortfolioGallery({
  items: initial,
  isOwner,
  ownerRole,
}: PortfolioGalleryProps) {
  const [items, setItems] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  // Form state for multi-file upload
  const [itemType, setItemType] = useState<"showcase" | "before_after">("showcase");
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [videoFiles, setVideoFiles] = useState<File[]>([]);
  const [videoUrls, setVideoUrls] = useState<string[]>([""]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [beforeFile, setBeforeFile] = useState<File | null>(null);
  const [afterFile, setAfterFile] = useState<File | null>(null);
  const [beforePreview, setBeforePreview] = useState<string | null>(null);
  const [afterPreview, setAfterPreview] = useState<string | null>(null);

  useEffect(() => {
    const urls = photoFiles.map((f) => URL.createObjectURL(f));
    setPhotoPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [photoFiles]);

  useEffect(() => {
    if (beforeFile) {
      const url = URL.createObjectURL(beforeFile);
      setBeforePreview(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setBeforePreview(null);
    }
  }, [beforeFile]);

  useEffect(() => {
    if (afterFile) {
      const url = URL.createObjectURL(afterFile);
      setAfterPreview(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setAfterPreview(null);
    }
  }, [afterFile]);

  function resetForm() {
    setItemType("showcase");
    setPhotoFiles([]);
    setVideoFiles([]);
    setVideoUrls([""]);
    setBeforeFile(null);
    setAfterFile(null);
    setError(null);
  }

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      const added = Array.from(e.target.files);
      setPhotoFiles((prev) => {
        const combined = [...prev, ...added];
        return combined.slice(0, 15);
      });
    }
    e.target.value = "";
  }

  function handleVideoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      const added = Array.from(e.target.files);
      setVideoFiles((prev) => {
        const combined = [...prev, ...added];
        return combined.slice(0, 3);
      });
    }
    e.target.value = "";
  }

  function removePhoto(idx: number) {
    setPhotoFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  function removeVideoFile(idx: number) {
    setVideoFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleAdd(formData: FormData) {
    setUploading(true);
    setError(null);

    formData.append("itemType", itemType);

    if (itemType === "before_after") {
      if (!beforeFile || !afterFile) {
        setError("Please select both a Before photo and an After photo.");
        setUploading(false);
        return;
      }

      setCompressing(true);
      const { files: compressedPair } = await compressFiles([beforeFile, afterFile]);
      setCompressing(false);

      // Order matters: before = index 0, after = index 1
      compressedPair.forEach((f) => formData.append("photos", f));
    } else {
      const validVideoUrls = videoUrls.filter((u) => u.trim().length > 0);

      if (photoFiles.length === 0 && videoFiles.length === 0 && validVideoUrls.length === 0) {
        setError("Please add at least one photo or video.");
        setUploading(false);
        return;
      }

      setCompressing(true);
      const { files: compressedPhotos } = await compressFiles(photoFiles);
      setCompressing(false);

      compressedPhotos.forEach((f) => formData.append("photos", f));
      videoFiles.forEach((f) => formData.append("videos", f));
      validVideoUrls.forEach((u) => formData.append("videoUrls", u));
    }

    const result = await addPortfolioItem(formData);
    if (result.error) {
      setError(result.error);
      setUploading(false);
      return;
    }

    setShowForm(false);
    setUploading(false);
    resetForm();
    window.location.reload();
  }

  async function handleRemoveItem(id: string) {
    setRemovingId(id);
    const result = await removePortfolioItem(id);
    if (!result.error) {
      setItems((prev) => prev.filter((item) => item.id !== id));
      if (expandedItem === id) setExpandedItem(null);
    }
    setRemovingId(null);
  }

  async function handleRemoveMedia(mediaId: string, itemId: string) {
    const result = await removePortfolioMedia(mediaId);
    if (!result.error) {
      setItems((prev) =>
        prev.map((item) =>
          item.id === itemId
            ? {
                ...item,
                media: (item.media || []).filter((m) => m.id !== mediaId),
              }
            : item
        )
      );
    }
  }

  const label = ownerRole === "bidder" ? "Past Work" : "Project Showcase";

  function isYouTube(url: string) {
    return url.includes("youtube.com") || url.includes("youtu.be");
  }

  function getYouTubeEmbedUrl(url: string) {
    const match = url.match(
      /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
    );
    return match ? `https://www.youtube.com/embed/${match[1]}` : url;
  }

  function formatSize(bytes: number) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(1) + " MB";
  }

  // Get the expanded item's media for the lightbox
  const expandedData = items.find((i) => i.id === expandedItem);
  const expandedMedia = expandedData?.media || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-text-primary">
          📸 {label}
        </h2>
        {isOwner && (
          <button
            onClick={() => {
              setShowForm(!showForm);
              if (showForm) resetForm();
            }}
            className="flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-1.5 text-xs font-semibold text-white hover:bg-secondary-dark transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Project
          </button>
        )}
      </div>

      {/* Multi-file Add Form */}
      {isOwner && showForm && (
        <form
          action={handleAdd}
          className="mb-6 rounded-xl border border-border bg-surface p-5 space-y-5 ring-1 ring-secondary/20"
        >
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          {/* Item Type Toggle */}
          <div>
            <label className="block text-sm font-semibold text-text-primary mb-2">
              Type
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setItemType("showcase")}
                className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium border transition-colors ${
                  itemType === "showcase"
                    ? "border-primary bg-amber-50 text-primary"
                    : "border-border bg-surface text-text-secondary hover:bg-surface-hover"
                }`}
              >
                <ImageIcon className="h-4 w-4" />
                Project Showcase
              </button>
              <button
                type="button"
                onClick={() => setItemType("before_after")}
                className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium border transition-colors ${
                  itemType === "before_after"
                    ? "border-primary bg-amber-50 text-primary"
                    : "border-border bg-surface text-text-secondary hover:bg-surface-hover"
                }`}
              >
                <ArrowLeftRight className="h-4 w-4" />
                Before &amp; After
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-text-primary mb-1.5">
              Project Title *
            </label>
            <input
              type="text"
              name="title"
              required
              placeholder={
                itemType === "before_after"
                  ? "e.g. Bathroom Renovation — Before & After"
                  : ownerRole === "bidder"
                    ? "e.g. Kitchen Remodel — Crescent City"
                    : "e.g. Our Dream Deck Project"
              }
              className="block w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-text-primary mb-1.5">
              Description
            </label>
            <textarea
              name="description"
              rows={3}
              placeholder={
                itemType === "before_after"
                  ? "Describe the transformation — what was the problem and how was it resolved..."
                  : "Tell the story — what was done, materials used, challenges overcome..."
              }
              className="block w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Before & After Mode */}
          {itemType === "before_after" ? (
            <div className="grid grid-cols-2 gap-4">
              {/* Before Photo */}
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-2">
                  📷 Before Photo *
                </label>
                <label
                  className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-red-300 bg-red-50 px-4 py-5 transition-colors hover:border-red-400 hover:bg-red-100"
                >
                  {beforePreview ? (
                    <img
                      src={beforePreview}
                      alt="Before"
                      className="h-28 w-full rounded object-cover"
                    />
                  ) : (
                    <>
                      <ImageIcon className="h-7 w-7 text-red-400" />
                      <p className="mt-2 text-sm font-semibold text-red-600">
                        Select &quot;Before&quot; photo
                      </p>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      if (e.target.files?.[0]) setBeforeFile(e.target.files[0]);
                      e.target.value = "";
                    }}
                    className="hidden"
                  />
                </label>
                {beforeFile && (
                  <div className="mt-1.5 flex items-center justify-between text-xs text-text-muted">
                    <span className="truncate">{beforeFile.name}</span>
                    <button
                      type="button"
                      onClick={() => setBeforeFile(null)}
                      className="text-red-500 hover:text-red-700 ml-2"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* After Photo */}
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-2">
                  📷 After Photo *
                </label>
                <label
                  className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-green-300 bg-green-50 px-4 py-5 transition-colors hover:border-green-400 hover:bg-green-100"
                >
                  {afterPreview ? (
                    <img
                      src={afterPreview}
                      alt="After"
                      className="h-28 w-full rounded object-cover"
                    />
                  ) : (
                    <>
                      <ImageIcon className="h-7 w-7 text-green-400" />
                      <p className="mt-2 text-sm font-semibold text-green-600">
                        Select &quot;After&quot; photo
                      </p>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      if (e.target.files?.[0]) setAfterFile(e.target.files[0]);
                      e.target.value = "";
                    }}
                    className="hidden"
                  />
                </label>
                {afterFile && (
                  <div className="mt-1.5 flex items-center justify-between text-xs text-text-muted">
                    <span className="truncate">{afterFile.name}</span>
                    <button
                      type="button"
                      onClick={() => setAfterFile(null)}
                      className="text-red-500 hover:text-red-700 ml-2"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Photos Upload */}
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-2">
                  📷 Photos (up to 15)
                </label>
                <label
                  className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-amber-300 bg-bg-warm px-4 py-5 transition-colors hover:border-primary hover:bg-amber-50"
                >
                  <ImageIcon className="h-7 w-7 text-primary" />
                  <p className="mt-2 text-sm font-semibold text-primary">
                    Click to select photos
                  </p>
                  <p className="mt-0.5 text-xs text-text-muted">
                    {photoFiles.length > 0
                      ? `${photoFiles.length}/15 photos selected`
                      : "JPG, PNG, GIF, WEBP — select multiple"}
                  </p>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handlePhotoSelect}
                    className="hidden"
                  />
                </label>

                {/* Photo Previews */}
                {photoFiles.length > 0 && (
                  <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-5 lg:grid-cols-6">
                    {photoFiles.map((file, idx) => (
                      <div
                        key={`photo-${idx}`}
                        className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-gray-100"
                      >
                        {photoPreviews[idx] && (
                          <img
                            src={photoPreviews[idx]}
                            alt={file.name}
                            className="h-full w-full object-cover"
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => removePhoto(idx)}
                          className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-3 w-3" />
                        </button>
                        <div className="absolute inset-x-0 bottom-0 bg-black/50 px-1 py-0.5">
                          <p className="text-[10px] text-white truncate">
                            {formatSize(file.size)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Videos Upload */}
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-2">
                  🎬 Videos (up to 3 — file upload or YouTube links)
                </label>

                {/* Video file uploads */}
                <label
                  className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border px-4 py-4 transition-colors hover:border-amber-300 hover:bg-bg-warm"
                >
                  <Video className="h-6 w-6 text-text-muted" />
                  <p className="mt-1.5 text-sm font-medium text-text-primary">
                    Upload video files
                  </p>
                  <p className="mt-0.5 text-xs text-text-muted">
                    {videoFiles.length > 0
                      ? `${videoFiles.length} video(s) selected`
                      : "MP4, MOV, WebM — up to 300MB each"}
                  </p>
                  <input
                    type="file"
                    accept="video/*"
                    multiple
                    onChange={handleVideoSelect}
                    className="hidden"
                  />
                </label>

                {videoFiles.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {videoFiles.map((file, idx) => (
                      <div
                        key={`vid-${idx}`}
                        className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Play className="h-4 w-4 text-text-muted shrink-0" />
                          <span className="text-xs text-text-primary truncate">
                            {file.name}
                          </span>
                          <span className="text-xs text-text-muted shrink-0">
                            ({formatSize(file.size)})
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeVideoFile(idx)}
                          className="ml-2 text-text-muted hover:text-red-500 transition-colors"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* YouTube URLs */}
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-text-muted">
                    Or paste YouTube / video URLs:
                  </p>
                  {videoUrls.map((url, idx) => (
                    <div key={`url-${idx}`} className="flex items-center gap-2">
                      <input
                        type="url"
                        value={url}
                        onChange={(e) => {
                          const updated = [...videoUrls];
                          updated[idx] = e.target.value;
                          setVideoUrls(updated);
                        }}
                        placeholder="https://www.youtube.com/watch?v=..."
                        className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                      {videoUrls.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setVideoUrls((prev) => prev.filter((_, i) => i !== idx))
                          }
                          className="text-text-muted hover:text-red-500"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  {videoUrls.length < 3 && (
                    <button
                      type="button"
                      onClick={() => setVideoUrls((prev) => [...prev, ""])}
                      className="text-xs font-medium text-primary hover:text-primary-dark transition-colors"
                    >
                      + Add another video URL
                    </button>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Submit */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={uploading || compressing}
              className="flex items-center gap-2 rounded-lg bg-secondary px-5 py-2 text-sm font-semibold text-white hover:bg-secondary-dark transition-colors disabled:opacity-50"
            >
              {compressing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Compressing images...
                </>
              ) : uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {itemType === "before_after"
                    ? "Uploading before & after..."
                    : `Uploading (${photoFiles.length} photos, ${videoFiles.length + videoUrls.filter((u) => u.trim()).length} videos)...`}
                </>
              ) : (
                "Add to Portfolio"
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                resetForm();
              }}
              className="text-sm text-text-muted hover:text-text-primary transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Gallery Grid */}
      {items.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const mediaCount = item.media?.length || 0;
            const imageCount =
              item.media?.filter((m) => m.media_type === "image").length || 0;
            const videoCount =
              item.media?.filter((m) => m.media_type === "video").length || 0;
            const isExpanded = expandedItem === item.id;
            const isBeforeAfter = item.item_type === "before_after";

            // For before/after items, get sorted media (display_order 0=before, 1=after)
            const sortedMedia = [...(item.media || [])].sort(
              (a, b) => 0 // maintain insertion order which is display_order
            );
            const beforeMedia = sortedMedia[0];
            const afterMedia = sortedMedia[1];

            // Before/After Card
            if (isBeforeAfter && beforeMedia && afterMedia) {
              return (
                <div
                  key={item.id}
                  className="group relative rounded-xl border border-border bg-surface shadow-sm overflow-hidden col-span-full sm:col-span-2"
                >
                  <div className="relative">
                    <BeforeAfterSlider
                      beforeUrl={beforeMedia.thumbnail_url || beforeMedia.media_url}
                      afterUrl={afterMedia.thumbnail_url || afterMedia.media_url}
                    />
                    <div className="absolute top-2 left-1/2 -translate-x-1/2 rounded-full bg-primary/90 px-3 py-1 text-[10px] font-bold text-slate-950 shadow z-10">
                      <ArrowLeftRight className="inline h-3 w-3 mr-1 -mt-0.5" />
                      BEFORE &amp; AFTER
                    </div>
                    {isOwner && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveItem(item.id);
                        }}
                        disabled={removingId === item.id}
                        className="absolute top-2 right-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 hover:bg-red-600 transition-all"
                      >
                        {removingId === item.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-sm text-text-primary">
                      {item.title}
                    </h3>
                    {item.description && (
                      <p className="mt-1 text-xs text-text-secondary line-clamp-2">
                        {item.description}
                      </p>
                    )}
                  </div>
                </div>
              );
            }

            // Regular Showcase Card
            return (
              <div
                key={item.id}
                className={`group relative rounded-xl border bg-surface shadow-sm overflow-hidden transition-all ${
                  isExpanded
                    ? "border-primary col-span-full"
                    : "border-border"
                }`}
              >
                {/* Cover Image / Collapsed View */}
                {!isExpanded && (
                  <>
                    <div
                      className="relative aspect-video bg-bg-warm cursor-pointer"
                      onClick={() => setExpandedItem(item.id)}
                    >
                      {item.media_type === "video" ? (
                        isYouTube(item.media_url) ? (
                          <div className="flex h-full w-full items-center justify-center bg-gray-900">
                            <Play className="h-10 w-10 text-white/80" />
                          </div>
                        ) : (
                          <video
                            src={item.media_url}
                            className="h-full w-full object-cover"
                          />
                        )
                      ) : (
                        <img
                          src={item.thumbnail_url || item.media_url}
                          alt={item.title}
                          className="h-full w-full object-cover transition-transform group-hover:scale-105"
                        />
                      )}

                      {/* Media count badge */}
                      {mediaCount > 1 && (
                        <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/70 px-2 py-1 text-white">
                          <Layers className="h-3 w-3" />
                          <span className="text-[10px] font-medium">
                            {imageCount > 0 && `${imageCount} photo${imageCount !== 1 ? "s" : ""}`}
                            {imageCount > 0 && videoCount > 0 && ", "}
                            {videoCount > 0 && `${videoCount} video${videoCount !== 1 ? "s" : ""}`}
                          </span>
                        </div>
                      )}

                      {isOwner && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveItem(item.id);
                          }}
                          disabled={removingId === item.id}
                          className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 hover:bg-red-600 transition-all"
                        >
                          {removingId === item.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </button>
                      )}
                    </div>

                    <div className="p-4">
                      <h3 className="font-semibold text-sm text-text-primary">
                        {item.title}
                      </h3>
                      {item.description && (
                        <p className="mt-1 text-xs text-text-secondary line-clamp-2">
                          {item.description}
                        </p>
                      )}
                      {mediaCount > 1 && (
                        <button
                          onClick={() => setExpandedItem(item.id)}
                          className="mt-2 text-xs font-medium text-primary hover:text-primary-dark transition-colors"
                        >
                          View all {mediaCount} items →
                        </button>
                      )}
                    </div>
                  </>
                )}

                {/* Expanded View */}
                {isExpanded && (
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-text-primary">
                          {item.title}
                        </h3>
                        {item.description && (
                          <p className="mt-1 text-sm text-text-secondary">
                            {item.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {isOwner && (
                          <button
                            onClick={() => handleRemoveItem(item.id)}
                            disabled={removingId === item.id}
                            className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete Project
                          </button>
                        )}
                        <button
                          onClick={() => setExpandedItem(null)}
                          className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-hover transition-colors"
                        >
                          <X className="h-3.5 w-3.5" />
                          Close
                        </button>
                      </div>
                    </div>

                    {/* All Media Grid */}
                    {expandedMedia.length > 0 ? (
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                        {expandedMedia.map((media, idx) => (
                          <div
                            key={media.id}
                            className="group/media relative aspect-square overflow-hidden rounded-lg border border-border bg-bg-warm"
                          >
                            {media.media_type === "video" ? (
                              isYouTube(media.media_url) ? (
                                <iframe
                                  src={getYouTubeEmbedUrl(media.media_url)}
                                  className="h-full w-full"
                                  allowFullScreen
                                  title={`${item.title} video`}
                                />
                              ) : (
                                <video
                                  src={media.media_url}
                                  controls
                                  className="h-full w-full object-cover"
                                />
                              )
                            ) : (
                              <a
                                href={media.media_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => {
                                  e.preventDefault();
                                  setLightboxIdx(idx);
                                }}
                              >
                                <img
                                  src={media.thumbnail_url || media.media_url}
                                  alt={`${item.title} ${idx + 1}`}
                                  className="h-full w-full object-cover transition-transform group-hover/media:scale-105"
                                />
                              </a>
                            )}

                            {media.media_type === "video" &&
                              !isYouTube(media.media_url) && (
                                <div className="absolute top-1.5 left-1.5 rounded-full bg-black/60 p-1">
                                  <Play className="h-3 w-3 text-white" />
                                </div>
                              )}

                            {isOwner && (
                              <button
                                onClick={() =>
                                  handleRemoveMedia(media.id, item.id)
                                }
                                className="absolute top-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 group-hover/media:opacity-100 hover:bg-red-600 transition-all"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-border py-8 text-center">
                        <p className="text-sm text-text-muted">
                          No media files found for this item.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border py-12 text-center">
          <ImageIcon className="mx-auto h-10 w-10 text-text-muted/30" />
          <p className="mt-3 text-sm text-text-muted">
            {isOwner
              ? "No items yet — add photos and videos to showcase your work!"
              : "No portfolio items to show yet."}
          </p>
        </div>
      )}

      {/* Lightbox */}
      {lightboxIdx !== null && expandedMedia[lightboxIdx] && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightboxIdx(null)}
        >
          <button
            onClick={() => setLightboxIdx(null)}
            className="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>

          {lightboxIdx > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIdx(lightboxIdx - 1);
              }}
              className="absolute left-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-colors"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}

          <img
            src={expandedMedia[lightboxIdx].media_url}
            alt="Full size"
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />

          {lightboxIdx < expandedMedia.length - 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIdx(lightboxIdx + 1);
              }}
              className="absolute right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-colors"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          )}

          <div className="absolute bottom-4 text-center text-white text-sm">
            {lightboxIdx + 1} / {expandedMedia.length}
          </div>
        </div>
      )}
    </div>
  );
}
