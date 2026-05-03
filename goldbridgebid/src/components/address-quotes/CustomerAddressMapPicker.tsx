"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import maplibregl, { type Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

type ReverseGeocodePayload = {
  displayAddress: string;
  street: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
};

type GeocodePayload = {
  lat: number;
  lon: number;
  label: string;
};

interface CustomerAddressMapPickerProps {
  initialDisplayAddress: string;
  initialStreet: string;
  initialCity: string;
  initialState: string;
  initialZip: string;
  initialLatitude?: number | null;
  initialLongitude?: number | null;
  label?: string;
  helpText?: string;
}

const DEFAULT_CENTER: [number, number] = [-124.2026, 41.7558];
const MAPBOX_PUBLIC_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
const PIN_SOURCE_ID = "customer-exact-address-pin-source";
const PIN_LAYER_ID = "customer-exact-address-pin-layer";

export default function CustomerAddressMapPicker({
  initialDisplayAddress,
  initialStreet,
  initialCity,
  initialState,
  initialZip,
  initialLatitude = null,
  initialLongitude = null,
  label = "Save your customer address",
  helpText = "Search your address or click directly on your house. The red marker is what contractors will see for quick quote requests.",
}: CustomerAddressMapPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const mapSnapshotInputRef = useRef<HTMLInputElement | null>(null);
  const [displayAddress, setDisplayAddress] = useState(initialDisplayAddress);
  const [street, setStreet] = useState(initialStreet);
  const [city, setCity] = useState(initialCity);
  const [state, setState] = useState(initialState);
  const [zip, setZip] = useState(initialZip);
  const [latitude, setLatitude] = useState(
    typeof initialLatitude === "number" ? String(initialLatitude) : ""
  );
  const [longitude, setLongitude] = useState(
    typeof initialLongitude === "number" ? String(initialLongitude) : ""
  );
  const [status, setStatus] = useState<string | null>(
    typeof initialLatitude === "number" && typeof initialLongitude === "number"
      ? "Existing pin loaded. Move it if the exact location is wrong."
      : initialDisplayAddress
      ? "Use the saved profile address, search it on the map, or click your house."
      : "Search or click the map to set your customer address."
  );

  const syncCanvasPin = useCallback((lat: number, lon: number) => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const point = {
      type: "FeatureCollection" as const,
      features: [
        {
          type: "Feature" as const,
          geometry: {
            type: "Point" as const,
            coordinates: [lon, lat],
          },
          properties: {},
        },
      ],
    };
    const existingSource = map.getSource(PIN_SOURCE_ID) as
      | maplibregl.GeoJSONSource
      | undefined;

    if (existingSource) {
      existingSource.setData(point);
    } else {
      map.addSource(PIN_SOURCE_ID, {
        type: "geojson",
        data: point,
      });
      map.addLayer({
        id: PIN_LAYER_ID,
        type: "circle",
        source: PIN_SOURCE_ID,
        paint: {
          "circle-color": "#dc2626",
          "circle-radius": 9,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 3,
        },
      });
    }
  }, []);

  const placeMarker = useCallback((lat: number, lon: number) => {
    const point: [number, number] = [lon, lat];
    if (!markerRef.current) {
      markerRef.current = new maplibregl.Marker({ color: "#dc2626" })
        .setLngLat(point)
        .addTo(mapRef.current!);
    } else {
      markerRef.current.setLngLat(point);
    }
    syncCanvasPin(lat, lon);
    mapRef.current?.flyTo({ center: point, zoom: 18, duration: 600 });
    setLatitude(String(Math.round(lat * 10_000_000) / 10_000_000));
    setLongitude(String(Math.round(lon * 10_000_000) / 10_000_000));
  }, [syncCanvasPin]);

  const selectPoint = useCallback(
    async (lat: number, lon: number) => {
      placeMarker(lat, lon);
      setStatus("Looking up the clicked address...");

      try {
        const response = await fetch(
          `/api/address-quotes/reverse-geocode?lat=${encodeURIComponent(
            String(lat)
          )}&lon=${encodeURIComponent(String(lon))}`
        );
        if (!response.ok) {
          setStatus("Marker placed. Type or edit the address before saving.");
          return;
        }

        const payload = (await response.json()) as ReverseGeocodePayload;
        setDisplayAddress(payload.displayAddress);
        setStreet(payload.street || "");
        setCity(payload.city || "");
        setState(payload.state || "");
        setZip(payload.zip || "");
        setStatus("Marker placed and address found. Review it, then save.");
      } catch {
        setStatus("Marker placed. Type or edit the address before saving.");
      }
    },
    [placeMarker]
  );

  const captureMapSnapshot = useCallback(() => {
    if (!markerRef.current || !mapRef.current || !mapSnapshotInputRef.current) {
      return;
    }

    try {
      mapSnapshotInputRef.current.value = mapRef.current
        .getCanvas()
        .toDataURL("image/jpeg", 0.82);
    } catch (error) {
      console.error("Map snapshot capture failed:", error);
      mapSnapshotInputRef.current.value = "";
    }
  }, []);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {
          satellite: {
            type: "raster",
            tiles: MAPBOX_PUBLIC_TOKEN
              ? [
                  `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/256/{z}/{x}/{y}@2x?access_token=${MAPBOX_PUBLIC_TOKEN}`,
                ]
              : [
                  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
                ],
            tileSize: 256,
            attribution: MAPBOX_PUBLIC_TOKEN
              ? "© Mapbox © OpenStreetMap"
              : "Tiles © Esri",
          },
        },
        layers: [
          {
            id: "satellite",
            type: "raster",
            source: "satellite",
          },
        ],
      },
      center: DEFAULT_CENTER,
      zoom: 14,
      maxZoom: 22,
      canvasContextAttributes: { preserveDrawingBuffer: true },
      attributionControl: { compact: true },
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    if (typeof initialLatitude === "number" && typeof initialLongitude === "number") {
      map.on("load", () => {
        placeMarker(initialLatitude, initialLongitude);
      });
    }
    map.on("click", (event) => {
      void selectPoint(event.lngLat.lat, event.lngLat.lng);
    });
    mapRef.current = map;

    return () => {
      markerRef.current?.remove();
      markerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, [initialLatitude, initialLongitude, placeMarker, selectPoint]);

  useEffect(() => {
    const form = mapContainerRef.current?.closest("form");
    if (!form) return;

    form.addEventListener("submit", captureMapSnapshot);
    return () => {
      form.removeEventListener("submit", captureMapSnapshot);
    };
  }, [captureMapSnapshot]);

  async function searchAddressOnMap() {
    if (displayAddress.trim().length < 6) {
      setStatus("Enter a fuller address before searching.");
      return;
    }

    setStatus("Searching for this address...");
    try {
      const response = await fetch(
        `/api/address-quotes/geocode?address=${encodeURIComponent(
          displayAddress
        )}`
      );
      if (!response.ok) {
        setStatus("Address not found. Try a fuller address or click the map.");
        return;
      }

      const payload = (await response.json()) as GeocodePayload;
      setDisplayAddress(payload.label || displayAddress);
      await selectPoint(payload.lat, payload.lon);
    } catch {
      setStatus("Address lookup failed. Try clicking the map instead.");
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label
          htmlFor="displayAddress"
          className="block text-sm font-semibold text-text-primary"
        >
          {label}
        </label>
        <p className="mt-1 text-xs leading-5 text-text-secondary">
          {helpText}
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            id="displayAddress"
            name="displayAddress"
            type="text"
            required
            value={displayAddress}
            onChange={(event) => setDisplayAddress(event.target.value)}
            placeholder="Example: 123 Front St, Crescent City, CA 95531"
            className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <button
            type="button"
            onClick={searchAddressOnMap}
            className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-text-primary transition-colors hover:bg-white"
          >
            Search Map
          </button>
        </div>
      </div>

      <input type="hidden" name="street" value={street} />
      <input type="hidden" name="city" value={city} />
      <input type="hidden" name="state" value={state} />
      <input type="hidden" name="zip" value={zip} />
      <input type="hidden" name="mapLatitude" value={latitude} />
      <input type="hidden" name="mapLongitude" value={longitude} />
      <input
        ref={mapSnapshotInputRef}
        type="hidden"
        name="mapSnapshotDataUrl"
      />

      <div
        ref={mapContainerRef}
        className="h-72 overflow-hidden rounded-xl border border-border bg-bg-warm sm:h-96"
        aria-label="Map for selecting your customer address"
      />

      {status && (
        <p className="rounded-lg bg-surface px-3 py-2 text-xs font-medium leading-5 text-text-secondary">
          {status}
        </p>
      )}
    </div>
  );
}
