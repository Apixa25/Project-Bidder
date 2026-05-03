"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import maplibregl, { type Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

type QuoteMapMarker = {
  addressId: string;
  displayAddress: string;
  latitude: number;
  longitude: number;
  quoteCount: number;
};

interface AddressQuoteDiscoveryMapProps {
  markers: QuoteMapMarker[];
}

const DEFAULT_CENTER: [number, number] = [-124.2026, 41.7558];
const MAPBOX_PUBLIC_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

export default function AddressQuoteDiscoveryMap({
  markers,
}: AddressQuoteDiscoveryMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);

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
            attribution: MAPBOX_PUBLIC_TOKEN ? "© Mapbox © OpenStreetMap" : "Tiles © Esri",
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
      center: markers[0]
        ? [markers[0].longitude, markers[0].latitude]
        : DEFAULT_CENTER,
      zoom: markers.length > 0 ? 15 : 12,
      maxZoom: 22,
      attributionControl: { compact: true },
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [markers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const mapMarkers = markers.map((marker) => {
      const element = document.createElement("a");
      element.href = `/address-quotes/${marker.addressId}`;
      element.className =
        "flex h-10 min-w-10 items-center justify-center rounded-full border-2 border-white bg-primary px-2 text-sm font-bold text-slate-950 shadow-lg transition-transform hover:scale-110";
      element.textContent = String(marker.quoteCount);
      element.title = `${marker.displayAddress} - ${marker.quoteCount} quote${
        marker.quoteCount === 1 ? "" : "s"
      }`;

      const popup = new maplibregl.Popup({ offset: 18 }).setHTML(
        `<div style="max-width:220px"><strong>${marker.displayAddress}</strong><br/><span>${marker.quoteCount} public quote${marker.quoteCount === 1 ? "" : "s"}</span><br/><a href="/address-quotes/${marker.addressId}">View quotes</a></div>`
      );

      return new maplibregl.Marker({ element })
        .setLngLat([marker.longitude, marker.latitude])
        .setPopup(popup)
        .addTo(map);
    });

    if (markers.length > 1) {
      const bounds = markers.reduce(
        (nextBounds, marker) =>
          nextBounds.extend([marker.longitude, marker.latitude]),
        new maplibregl.LngLatBounds(
          [markers[0].longitude, markers[0].latitude],
          [markers[0].longitude, markers[0].latitude]
        )
      );
      map.fitBounds(bounds, { padding: 70, maxZoom: 16, duration: 0 });
    }

    return () => {
      mapMarkers.forEach((marker) => marker.remove());
    };
  }, [markers]);

  return (
    <section className="mt-8 overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
      <div className="flex flex-col gap-2 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">
            Browse Quotes on the Map
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            Pan around and click a numbered marker to open quotes for that
            address.
          </p>
        </div>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          {markers.length} address{markers.length === 1 ? "" : "es"} with quotes
        </span>
      </div>
      <div
        ref={mapContainerRef}
        className="h-[420px] w-full bg-bg-warm"
        aria-label="Map of addresses with public quotes"
      />
      {markers.length === 0 && (
        <div className="border-t border-border bg-bg-warm px-5 py-4 text-sm text-text-secondary">
          No published quote addresses have map coordinates yet. Search an
          address or create a new address quote to start filling the map.
        </div>
      )}
      <div className="border-t border-border px-5 py-3 text-xs text-text-muted">
        Map pins may be approximate for older quotes. Prefer typing? Use the
        address search above, or open{" "}
        <Link href="/address-quotes" className="font-semibold text-primary">
          public address quotes
        </Link>
        .
      </div>
    </section>
  );
}
