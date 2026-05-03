"use client";

import { useMemo, useState } from "react";
import { Camera, Loader2, RotateCcw, Trash2 } from "lucide-react";

type StreetViewImage = {
  id: string;
  imageDataUrl: string;
  caption: string;
};

interface StreetViewEvidenceToolProps {
  initialImages?: Array<{
    id: string;
    url: string;
    caption: string | null;
  }>;
}

function readFormValue(name: string) {
  const field = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(
    `[name="${name}"]`
  );
  return field?.value?.trim() || "";
}

export default function StreetViewEvidenceTool({
  initialImages = [],
}: StreetViewEvidenceToolProps) {
  const [images, setImages] = useState<StreetViewImage[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [heading, setHeading] = useState(0);

  const serializedImages = useMemo(
    () =>
      JSON.stringify(
        images.map((image, index) => ({
          imageDataUrl: image.imageDataUrl,
          caption: image.caption || `Street View verification ${index + 1}`,
        }))
      ),
    [images]
  );

  async function captureStreetView() {
    const pickedLat = readFormValue("mapPickedLatitude");
    const pickedLng = readFormValue("mapPickedLongitude");
    const displayAddress = readFormValue("displayAddress");
    const query = new URLSearchParams({
      heading: String(heading),
      pitch: "0",
      fov: "80",
    });

    if (pickedLat && pickedLng) {
      query.set("lat", pickedLat);
      query.set("lng", pickedLng);
    } else if (displayAddress) {
      query.set("location", displayAddress);
    } else {
      setStatus("Pick an address on the map or enter the full address first.");
      return;
    }

    setLoading(true);
    setStatus("Checking Google Street View...");

    try {
      const response = await fetch(`/api/address-quotes/street-view?${query}`);
      const data = (await response.json()) as
        | { imageDataUrl: string }
        | { error?: string };

      if (!response.ok || !("imageDataUrl" in data)) {
        setStatus(
          "error" in data && data.error
            ? data.error
            : "No Street View image was found there."
        );
        return;
      }

      setImages((current) => [
        ...current,
        {
          id: `street_view_${Date.now()}`,
          imageDataUrl: data.imageDataUrl,
          caption: `Street View verification ${current.length + 1}`,
        },
      ]);
      setStatus("Street View screenshot saved to this quote.");
    } catch {
      setStatus("Street View could not be loaded. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
      <input type="hidden" name="streetViewImagesJson" value={serializedImages} />
      <h2 className="text-lg font-semibold text-text-primary">
        Street View Property Verification
      </h2>
      <p className="mt-1 text-sm leading-6 text-text-secondary">
        Use Google Street View to save a front-of-property reference image so
        the customer can confirm exactly which property this quote references.
      </p>

      {initialImages.length > 0 && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {initialImages.map((image) => (
            <figure
              key={image.id}
              className="overflow-hidden rounded-lg border border-border bg-bg-warm"
            >
              <img
                src={image.url}
                alt={image.caption || "Saved Street View verification"}
                className="aspect-video w-full object-cover"
              />
              <figcaption className="px-3 py-2 text-xs font-semibold text-text-secondary">
                {image.caption || "Saved Street View verification"}
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="block min-w-0 flex-1 text-sm font-semibold text-text-primary">
          Camera direction
          <input
            type="range"
            min={0}
            max={359}
            step={15}
            value={heading}
            onChange={(event) => setHeading(Number(event.target.value))}
            className="mt-3 w-full accent-primary"
          />
          <span className="mt-1 block text-xs font-medium text-text-muted">
            Heading: {heading} degrees
          </span>
        </label>
        <button
          type="button"
          onClick={captureStreetView}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-secondary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-secondary-dark disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Camera className="h-4 w-4" />
          )}
          Save Street View
        </button>
        <button
          type="button"
          onClick={() => setHeading((current) => (current + 90) % 360)}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-text-primary transition-colors hover:bg-white"
        >
          <RotateCcw className="h-4 w-4" />
          Rotate
        </button>
      </div>

      {status && <p className="mt-3 text-sm font-medium text-text-secondary">{status}</p>}

      {images.length > 0 && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {images.map((image, index) => (
            <figure
              key={image.id}
              className="overflow-hidden rounded-lg border border-border bg-bg-warm"
            >
              <img
                src={image.imageDataUrl}
                alt={image.caption}
                className="aspect-video w-full object-cover"
              />
              <figcaption className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="text-xs font-semibold text-text-secondary">
                  {image.caption}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setImages((current) =>
                      current.filter((_, imageIndex) => imageIndex !== index)
                    )
                  }
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove
                </button>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </section>
  );
}
