"use client";

import { useState, useRef } from "react";
import {
  addPortfolioItem,
  removePortfolioItem,
} from "@/app/(dashboard)/profile/portfolio-actions";
import {
  Plus,
  Loader2,
  X,
  Image as ImageIcon,
  Video,
  Trash2,
  Play,
} from "lucide-react";

interface PortfolioItemData {
  id: string;
  media_url: string;
  media_type: string;
  title: string;
  description: string | null;
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
  const [error, setError] = useState<string | null>(null);
  const [uploadType, setUploadType] = useState<"image" | "video">("image");
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleAdd(formData: FormData) {
    setUploading(true);
    setError(null);

    const result = await addPortfolioItem(formData);
    if (result.error) {
      setError(result.error);
      setUploading(false);
      return;
    }

    setShowForm(false);
    setUploading(false);
    window.location.reload();
  }

  async function handleRemove(id: string) {
    setRemovingId(id);
    const result = await removePortfolioItem(id);
    if (!result.error) {
      setItems((prev) => prev.filter((item) => item.id !== id));
    }
    setRemovingId(null);
  }

  const label =
    ownerRole === "bidder" ? "Past Work" : "Project Showcase";

  function isYouTube(url: string) {
    return url.includes("youtube.com") || url.includes("youtu.be");
  }

  function getYouTubeEmbedUrl(url: string) {
    const match = url.match(
      /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
    );
    return match ? `https://www.youtube.com/embed/${match[1]}` : url;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-text-primary">
          📸 {label}
        </h2>
        {isOwner && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-1.5 text-xs font-semibold text-white hover:bg-secondary-dark transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Item
          </button>
        )}
      </div>

      {/* Add Form */}
      {isOwner && showForm && (
        <form
          action={handleAdd}
          className="mb-6 rounded-xl border border-secondary/20 bg-secondary/5 p-5 space-y-4"
        >
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <div>
            <label className="block text-sm font-semibold text-text-primary mb-1.5">
              Title *
            </label>
            <input
              type="text"
              name="title"
              required
              placeholder={
                ownerRole === "bidder"
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
              placeholder="Tell the story behind this work — what was done, materials used, challenges overcome..."
              className="block w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Upload Type Toggle */}
          <div>
            <label className="block text-sm font-semibold text-text-primary mb-2">
              Media Type
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setUploadType("image")}
                className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-medium transition-colors ${
                  uploadType === "image"
                    ? "bg-primary text-white"
                    : "bg-surface border border-border text-text-secondary hover:bg-surface-hover"
                }`}
              >
                <ImageIcon className="h-3.5 w-3.5" />
                Photo
              </button>
              <button
                type="button"
                onClick={() => setUploadType("video")}
                className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-medium transition-colors ${
                  uploadType === "video"
                    ? "bg-primary text-white"
                    : "bg-surface border border-border text-text-secondary hover:bg-surface-hover"
                }`}
              >
                <Video className="h-3.5 w-3.5" />
                Video
              </button>
            </div>
          </div>

          {uploadType === "image" ? (
            <div>
              <label className="block text-sm font-semibold text-text-primary mb-1.5">
                Upload Photo (up to 12MB)
              </label>
              <input
                type="file"
                name="media"
                accept="image/*"
                className="block w-full text-sm text-text-secondary file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-primary hover:file:bg-primary/20"
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1.5">
                  Upload Video File (up to 300MB)
                </label>
                <input
                  type="file"
                  name="media"
                  accept="video/*"
                  className="block w-full text-sm text-text-secondary file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-primary hover:file:bg-primary/20"
                />
              </div>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-secondary/5 px-3 text-text-muted">
                    or paste a link
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1.5">
                  YouTube / Video URL
                </label>
                <input
                  type="url"
                  name="videoUrl"
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="block w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={uploading}
              className="flex items-center gap-2 rounded-lg bg-secondary px-5 py-2 text-sm font-semibold text-white hover:bg-secondary-dark transition-colors disabled:opacity-50"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add to Portfolio"
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setError(null);
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
            const isExpanded = expandedId === item.id;
            return (
              <div
                key={item.id}
                className="group relative rounded-xl border border-border bg-surface shadow-sm overflow-hidden"
              >
                {/* Media */}
                <div className="relative aspect-video bg-bg-warm">
                  {item.media_type === "video" ? (
                    isYouTube(item.media_url) ? (
                      <iframe
                        src={getYouTubeEmbedUrl(item.media_url)}
                        className="h-full w-full"
                        allowFullScreen
                        title={item.title}
                      />
                    ) : (
                      <video
                        src={item.media_url}
                        controls
                        className="h-full w-full object-cover"
                      />
                    )
                  ) : (
                    <a
                      href={item.media_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <img
                        src={item.media_url}
                        alt={item.title}
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      />
                    </a>
                  )}

                  {item.media_type === "video" && !isYouTube(item.media_url) && (
                    <div className="absolute top-2 left-2 rounded-full bg-black/60 p-1">
                      <Play className="h-3 w-3 text-white" />
                    </div>
                  )}

                  {isOwner && (
                    <button
                      onClick={() => handleRemove(item.id)}
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

                {/* Info */}
                <div className="p-4">
                  <h3 className="font-semibold text-sm text-text-primary">
                    {item.title}
                  </h3>
                  {item.description && (
                    <div>
                      <p
                        className={`mt-1 text-xs text-text-secondary ${
                          isExpanded ? "" : "line-clamp-2"
                        }`}
                      >
                        {item.description}
                      </p>
                      {item.description.length > 100 && (
                        <button
                          onClick={() =>
                            setExpandedId(isExpanded ? null : item.id)
                          }
                          className="mt-1 text-xs font-medium text-primary hover:text-primary-dark transition-colors"
                        >
                          {isExpanded ? "Show less" : "Read more"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
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
    </div>
  );
}
