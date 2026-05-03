"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Loader2, RotateCcw, Trash2 } from "lucide-react";

type StreetViewImage = {
  id: string;
  imageDataUrl: string;
  caption: string;
};

type StreetViewPreview = {
  imageDataUrl: string;
  heading: number;
  pitch: number;
};

type LatLngLiteral = {
  lat: number;
  lng: number;
};

type MapsEventListener = {
  remove: () => void;
};

type GoogleLatLng = {
  lat: () => number;
  lng: () => number;
};

type GooglePov = {
  heading?: number;
  pitch?: number;
};

type GoogleStreetViewPanorama = {
  getPosition: () => GoogleLatLng | undefined;
  getPov: () => GooglePov;
  getZoom: () => number;
  setPosition: (position: GoogleLatLng | LatLngLiteral) => void;
  setPov: (pov: GooglePov) => void;
  setVisible: (visible: boolean) => void;
  addListener: (eventName: string, handler: () => void) => MapsEventListener;
};

type GoogleMapsNamespace = {
  maps: {
    StreetViewPanorama: new (
      element: HTMLElement,
      options: Record<string, unknown>
    ) => GoogleStreetViewPanorama;
    StreetViewService: new () => {
      getPanorama: (
        request: Record<string, unknown>,
        callback: (
          data: { location?: { latLng?: GoogleLatLng } } | null,
          status: string
        ) => void
      ) => void;
    };
    Geocoder: new () => {
      geocode: (
        request: { address: string },
        callback: (
          results: Array<{ geometry?: { location?: GoogleLatLng } }> | null,
          status: string
        ) => void
      ) => void;
    };
    StreetViewSource?: {
      OUTDOOR: string;
    };
  };
};

declare global {
  interface Window {
    google?: GoogleMapsNamespace;
  }
}

interface StreetViewEvidenceToolProps {
  initialImages?: Array<{
    id: string;
    url: string;
    caption: string | null;
  }>;
}

const GOOGLE_MAPS_SCRIPT_ID = "google-maps-street-view-picker";

let googleMapsLoadPromise: Promise<GoogleMapsNamespace> | null = null;

function readFormValue(name: string) {
  const field = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(
    `[name="${name}"]`
  );
  return field?.value?.trim() || "";
}

function parseCoordinate(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getStaticFovFromZoom(zoom: number) {
  if (!Number.isFinite(zoom)) return 80;
  return Math.max(30, Math.min(120, Math.round(100 - zoom * 15)));
}

async function getGoogleMapsBrowserKey() {
  const response = await fetch("/api/address-quotes/google-maps-key");
  const data = (await response.json()) as { apiKey?: string; error?: string };

  if (!response.ok || !data.apiKey) {
    throw new Error(data.error || "Google Maps browser key is not configured.");
  }

  return data.apiKey;
}

function loadGoogleMapsWithKey(apiKey: string) {
  if (window.google) {
    return Promise.resolve(window.google);
  }

  if (googleMapsLoadPromise) return googleMapsLoadPromise;

  googleMapsLoadPromise = new Promise((resolve, reject) => {
    const existingScript = document.getElementById(
      GOOGLE_MAPS_SCRIPT_ID
    ) as HTMLScriptElement | null;

    if (existingScript) {
      existingScript.addEventListener("load", () => {
        if (window.google) resolve(window.google);
        else reject(new Error("Google Maps did not load."));
      });
      existingScript.addEventListener("error", () =>
        reject(new Error("Google Maps could not be loaded."))
      );
      return;
    }

    const script = document.createElement("script");
    script.id = GOOGLE_MAPS_SCRIPT_ID;
    script.async = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      apiKey
    )}`;
    script.onload = () => {
      if (window.google) resolve(window.google);
      else reject(new Error("Google Maps did not load."));
    };
    script.onerror = () => reject(new Error("Google Maps could not be loaded."));
    document.head.appendChild(script);
  });

  return googleMapsLoadPromise;
}

async function loadGoogleMaps() {
  const apiKey = await getGoogleMapsBrowserKey();
  return loadGoogleMapsWithKey(apiKey);
}

export default function StreetViewEvidenceTool({
  initialImages = [],
}: StreetViewEvidenceToolProps) {
  const panoramaContainerRef = useRef<HTMLDivElement | null>(null);
  const panoramaRef = useRef<GoogleStreetViewPanorama | null>(null);
  const listenersRef = useRef<MapsEventListener[]>([]);
  const [images, setImages] = useState<StreetViewImage[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [heading, setHeading] = useState(0);
  const [pitch, setPitch] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [preview, setPreview] = useState<StreetViewPreview | null>(null);
  const [liveStreetViewReady, setLiveStreetViewReady] = useState(false);

  useEffect(() => {
    return () => {
      listenersRef.current.forEach((listener) => listener.remove());
      listenersRef.current = [];
    };
  }, []);

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

  function getFormTarget() {
    const pickedLat = parseCoordinate(readFormValue("mapPickedLatitude"));
    const pickedLng = parseCoordinate(readFormValue("mapPickedLongitude"));
    const displayAddress = readFormValue("displayAddress");

    if (pickedLat !== null && pickedLng !== null) {
      return { location: { lat: pickedLat, lng: pickedLng }, displayAddress };
    }

    if (displayAddress) {
      return { location: null, displayAddress };
    }

    return null;
  }

  async function geocodeAddress(
    google: GoogleMapsNamespace,
    address: string
  ): Promise<LatLngLiteral | null> {
    const geocoder = new google.maps.Geocoder();

    return new Promise((resolve) => {
      geocoder.geocode({ address }, (results, geocodeStatus) => {
        const location = results?.[0]?.geometry?.location;
        if (geocodeStatus !== "OK" || !location) {
          resolve(null);
          return;
        }

        resolve({ lat: location.lat(), lng: location.lng() });
      });
    });
  }

  async function findStreetViewLocation(
    google: GoogleMapsNamespace,
    location: LatLngLiteral
  ): Promise<GoogleLatLng | null> {
    const service = new google.maps.StreetViewService();

    return new Promise((resolve) => {
      service.getPanorama(
        {
          location,
          radius: 90,
          source: google.maps.StreetViewSource?.OUTDOOR,
        },
        (data, streetViewStatus) => {
          if (streetViewStatus !== "OK" || !data?.location?.latLng) {
            resolve(null);
            return;
          }

          resolve(data.location.latLng);
        }
      );
    });
  }

  function syncLiveViewState() {
    const panorama = panoramaRef.current;
    if (!panorama) return;

    const pov = panorama.getPov();
    setHeading(Math.round(pov.heading || 0));
    setPitch(Math.round(pov.pitch || 0));
    setZoom(panorama.getZoom());
    setPreview(null);
  }

  async function openLiveStreetView() {
    if (!panoramaContainerRef.current) return;

    const target = getFormTarget();
    if (!target) {
      setStatus("Pick an address on the map or enter the full address first.");
      return;
    }

    setLoading(true);
    setStatus("Opening live Google Street View...");

    try {
      const google = await loadGoogleMaps();
      const targetLocation =
        target.location || (await geocodeAddress(google, target.displayAddress));

      if (!targetLocation) {
        setStatus("Google could not locate that address for live Street View.");
        return;
      }

      const streetViewLocation = await findStreetViewLocation(google, targetLocation);
      if (!streetViewLocation) {
        setStatus("No live Google Street View image was found near that location.");
        return;
      }

      if (!panoramaRef.current) {
        panoramaRef.current = new google.maps.StreetViewPanorama(
          panoramaContainerRef.current,
          {
            position: streetViewLocation,
            pov: { heading, pitch },
            zoom,
            addressControl: true,
            fullscreenControl: false,
            linksControl: true,
            panControl: true,
            showRoadLabels: true,
            visible: true,
          }
        );
        listenersRef.current = [
          panoramaRef.current.addListener("pov_changed", syncLiveViewState),
          panoramaRef.current.addListener("zoom_changed", syncLiveViewState),
        ];
      } else {
        panoramaRef.current.setPosition(streetViewLocation);
        panoramaRef.current.setPov({ heading, pitch });
        panoramaRef.current.setVisible(true);
      }

      syncLiveViewState();
      setLiveStreetViewReady(true);
      setStatus(
        "Live Street View is ready. Drag the view until the right property is visible, then save this view."
      );
    } catch {
      setStatus("Live Google Street View could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  function buildStaticStreetViewQuery() {
    const query = new URLSearchParams();
    const panorama = panoramaRef.current;
    const position = panorama?.getPosition();

    if (panorama && position) {
      const pov = panorama.getPov();
      query.set("lat", String(position.lat()));
      query.set("lng", String(position.lng()));
      query.set("heading", String(Math.round(pov.heading || heading)));
      query.set("pitch", String(Math.round(pov.pitch || pitch)));
      query.set("fov", String(getStaticFovFromZoom(panorama.getZoom())));
      return query;
    }

    const target = getFormTarget();
    if (!target) {
      setStatus("Pick an address on the map or enter the full address first.");
      return null;
    }

    if (target.location) {
      query.set("lat", String(target.location.lat));
      query.set("lng", String(target.location.lng));
    } else {
      query.set("location", target.displayAddress);
    }
    query.set("heading", String(heading));
    query.set("pitch", String(pitch));
    query.set("fov", String(getStaticFovFromZoom(zoom)));
    return query;
  }

  async function fetchStaticStreetViewImage(statusMessage: string) {
    const query = buildStaticStreetViewQuery();
    if (!query) return null;

    setLoading(true);
    setStatus(statusMessage);

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
        return null;
      }

      return {
        imageDataUrl: data.imageDataUrl,
        heading,
        pitch,
      };
    } catch {
      setStatus("Street View could not be loaded. Please try again.");
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function fetchStreetViewPreview() {
    const nextPreview = await fetchStaticStreetViewImage(
      "Loading Google Street View preview..."
    );
    if (!nextPreview) return null;

    setPreview(nextPreview);
    setStatus("Preview loaded. If this shows the right property, save it.");
    return nextPreview;
  }

  async function captureStreetView() {
    const currentPreview =
      liveStreetViewReady || !preview
        ? await fetchStaticStreetViewImage("Saving this Street View...")
        : preview;

    if (!currentPreview) return;

    setImages((current) => [
      ...current,
      {
        id: `street_view_${Date.now()}`,
        imageDataUrl: currentPreview.imageDataUrl,
        caption: `Street View verification ${current.length + 1}`,
      },
    ]);
    setPreview(currentPreview);
    setStatus("Street View screenshot saved to this quote.");
  }

  function updateFallbackHeading(value: number) {
    setHeading(value);
    setPreview(null);
    setStatus("Preview the new direction before saving it.");
  }

  function rotateFallbackHeading() {
    updateFallbackHeading((heading + 90) % 360);
  }

  const actionIcon = loading ? (
    <Loader2 className="h-4 w-4 animate-spin" />
  ) : (
    <Camera className="h-4 w-4" />
  );

  return (
    <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
      <input type="hidden" name="streetViewImagesJson" value={serializedImages} />
      <h2 className="text-lg font-semibold text-text-primary">
        Street View Property Verification
      </h2>
      <p className="mt-1 text-sm leading-6 text-text-secondary">
        Open live Google Street View, drag the camera until the right property is
        visible, then save that view as quote evidence.
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

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={openLiveStreetView}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-secondary bg-white px-4 py-2.5 text-sm font-semibold text-secondary transition-colors hover:bg-secondary/10 disabled:opacity-50"
        >
          {actionIcon}
          Open Live Street View
        </button>
        <button
          type="button"
          onClick={captureStreetView}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-secondary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-secondary-dark disabled:opacity-50"
        >
          {actionIcon}
          Save This View
        </button>
      </div>

      {status && <p className="mt-3 text-sm font-medium text-text-secondary">{status}</p>}

      <div className="mt-4 overflow-hidden rounded-xl border border-border bg-bg-warm">
        <div
          ref={panoramaContainerRef}
          className="h-[360px] w-full bg-slate-200"
          aria-label="Live Google Street View property picker"
        />
        <div className="border-t border-border px-4 py-3 text-sm text-text-secondary">
          {liveStreetViewReady
            ? `Current view: heading ${heading} degrees, pitch ${pitch} degrees.`
            : "Click Open Live Street View to load the draggable property view."}
        </div>
      </div>

      {!liveStreetViewReady && (
        <div className="mt-4 rounded-xl border border-border bg-bg-warm p-4">
          <p className="text-sm font-semibold text-text-primary">
            Static fallback preview
          </p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="block min-w-0 flex-1 text-sm font-semibold text-text-primary">
              Camera direction
              <input
                type="range"
                min={0}
                max={359}
                step={15}
                value={heading}
                onChange={(event) => updateFallbackHeading(Number(event.target.value))}
                className="mt-3 w-full accent-primary"
              />
              <span className="mt-1 block text-xs font-medium text-text-muted">
                Heading: {heading} degrees
              </span>
            </label>
            <button
              type="button"
              onClick={fetchStreetViewPreview}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-secondary bg-white px-4 py-2.5 text-sm font-semibold text-secondary transition-colors hover:bg-secondary/10 disabled:opacity-50"
            >
              {actionIcon}
              Preview Direction
            </button>
            <button
              type="button"
              onClick={rotateFallbackHeading}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-text-primary transition-colors hover:bg-white"
            >
              <RotateCcw className="h-4 w-4" />
              Rotate
            </button>
          </div>
        </div>
      )}

      {preview ? (
        <figure className="mt-4 overflow-hidden rounded-xl border-2 border-secondary bg-bg-warm">
          <img
            src={preview.imageDataUrl}
            alt={`Street View preview at ${preview.heading} degrees`}
            className="aspect-video w-full object-cover"
          />
          <figcaption className="flex flex-col gap-1 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <span className="font-semibold text-text-primary">
              Saved-preview image
            </span>
            <span className="text-text-secondary">
              This is the static image that will be attached to the quote.
            </span>
          </figcaption>
        </figure>
      ) : (
        <div className="mt-4 rounded-xl border border-dashed border-border bg-bg-warm px-4 py-6 text-center text-sm text-text-secondary">
          Save the live view or preview a static direction to see the exact image
          that will be attached to the estimate.
        </div>
      )}

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
