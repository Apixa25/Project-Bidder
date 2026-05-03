"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { type GeoJSONSource, type Map as MapLibreMap } from "maplibre-gl";
import area from "@turf/area";
import {
  Camera,
  Check,
  MapPin,
  MousePointer2,
  RotateCcw,
  Ruler,
  Search,
  Trash2,
  Undo2,
} from "lucide-react";
import type { LineString, Polygon } from "geojson";

type LngLatPoint = [number, number];
type MapViewMode = "default" | "satellite";
type MapInteractionMode = "draw" | "pick_address";
type DrawTool = "area" | "line";

type SavedMeasurementArea = {
  id: string;
  measurementType: "polygon_area";
  label: string;
  areaSqft: number;
  geometryGeojson: Polygon;
};

type SavedMeasurementLine = {
  id: string;
  measurementType: "linear_length";
  label: string;
  lengthFt: number;
  geometryGeojson: LineString;
};

type SavedMeasurement = SavedMeasurementArea | SavedMeasurementLine;

const DEFAULT_CENTER: LngLatPoint = [-124.2026, 41.7558];
const MAX_MEASUREMENT_ZOOM = 22;
const MAPBOX_PUBLIC_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
const SATELLITE_TILE_SOURCE = MAPBOX_PUBLIC_TOKEN
  ? {
      tiles: [
        `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/256/{z}/{x}/{y}@2x?access_token=${MAPBOX_PUBLIC_TOKEN}`,
      ],
      attribution:
        '© <a href="https://www.mapbox.com/about/maps/">Mapbox</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }
  : {
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      attribution: "Tiles © Esri",
    };

const MAP_STYLE = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
    satellite: {
      type: "raster",
      tiles: SATELLITE_TILE_SOURCE.tiles,
      tileSize: 256,
      maxzoom: MAX_MEASUREMENT_ZOOM,
      attribution: SATELLITE_TILE_SOURCE.attribution,
    },
  },
  layers: [
    {
      id: "osm",
      type: "raster",
      source: "osm",
    },
    {
      id: "satellite",
      type: "raster",
      source: "satellite",
      layout: {
        visibility: "none",
      },
    },
  ],
} as const;

function buildFeature(points: LngLatPoint[]) {
  if (points.length < 3) {
    return null;
  }

  return {
    type: "Feature" as const,
    properties: {},
    geometry: {
      type: "Polygon" as const,
      coordinates: [[...points, points[0]]],
    },
  };
}

function buildLineFeature(points: LngLatPoint[]) {
  return {
    type: "Feature" as const,
    properties: {},
    geometry: {
      type: "LineString" as const,
      coordinates: points,
    },
  };
}

function calculateLineLengthFt(points: LngLatPoint[]) {
  if (points.length < 2) return 0;

  const earthRadiusFt = 20_925_524.9;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

  return points.slice(1).reduce((total, point, index) => {
    const previous = points[index];
    const lat1 = toRadians(previous[1]);
    const lat2 = toRadians(point[1]);
    const deltaLat = toRadians(point[1] - previous[1]);
    const deltaLng = toRadians(point[0] - previous[0]);
    const haversine =
      Math.sin(deltaLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
    const centralAngle =
      2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));

    return total + earthRadiusFt * centralAngle;
  }, 0);
}

function formatSqft(value: number) {
  return Math.round(value).toLocaleString("en-US");
}

function formatFeet(value: number) {
  return Math.round(value).toLocaleString("en-US");
}

function roundPoint(point: LngLatPoint): LngLatPoint {
  return [
    Math.round(point[0] * 1_000_000) / 1_000_000,
    Math.round(point[1] * 1_000_000) / 1_000_000,
  ];
}

export default function LawnAreaMeasurementMap() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRefs = useRef<maplibregl.Marker[]>([]);
  const interactionModeRef = useRef<MapInteractionMode>("draw");
  const [points, setPoints] = useState<LngLatPoint[]>([]);
  const [savedAreas, setSavedAreas] = useState<SavedMeasurementArea[]>([]);
  const [savedLines, setSavedLines] = useState<SavedMeasurementLine[]>([]);
  const [drawTool, setDrawTool] = useState<DrawTool>("area");
  const [measurementLabel, setMeasurementLabel] = useState("Area 1");
  const [mapSnapshotUrl, setMapSnapshotUrl] = useState("");
  const [snapshotStatus, setSnapshotStatus] = useState<string | null>(null);
  const [mapSearchAddress, setMapSearchAddress] = useState("");
  const [geocodeStatus, setGeocodeStatus] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<MapViewMode>("default");
  const [interactionMode, setInteractionMode] = useState<MapInteractionMode>("draw");

  const polygonFeature = useMemo(
    () => (drawTool === "area" ? buildFeature(points) : null),
    [drawTool, points]
  );
  const lineFeature = useMemo(
    () => (drawTool === "line" && points.length >= 2 ? buildLineFeature(points) : null),
    [drawTool, points]
  );
  const measuredAreaSqft = useMemo(() => {
    if (!polygonFeature) return 0;
    return Math.round(area(polygonFeature) * 10.7639);
  }, [polygonFeature]);
  const measuredLengthFt = useMemo(
    () => Math.round(calculateLineLengthFt(points) * 100) / 100,
    [points]
  );
  const savedAreaTotalSqft = useMemo(
    () => savedAreas.reduce((total, areaRow) => total + areaRow.areaSqft, 0),
    [savedAreas]
  );
  const savedLineTotalFt = useMemo(
    () => savedLines.reduce((total, lineRow) => total + lineRow.lengthFt, 0),
    [savedLines]
  );
  const submittedAreaSqft = savedAreas.length > 0 ? savedAreaTotalSqft : measuredAreaSqft;
  const submittedLengthFt = savedLines.length > 0 ? savedLineTotalFt : 0;
  const savedMeasurements: SavedMeasurement[] = [...savedAreas, ...savedLines];
  const measurementsJson = JSON.stringify(savedMeasurements);

  useEffect(() => {
    interactionModeRef.current = interactionMode;
  }, [interactionMode]);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("address-quote-measurements-updated", {
        detail: savedMeasurements,
      })
    );
  }, [measurementsJson]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const mapOptions = {
      container: mapContainerRef.current,
      style: MAP_STYLE,
      center: DEFAULT_CENTER,
      zoom: 17,
      maxZoom: MAX_MEASUREMENT_ZOOM,
      attributionControl: { compact: true },
      preserveDrawingBuffer: true,
    } as maplibregl.MapOptions & { preserveDrawingBuffer: boolean };

    const map = new maplibregl.Map(mapOptions);

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    map.on("load", () => {
      map.addSource("lawn-polygon", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [],
        },
      });

      map.addSource("saved-lawn-polygons", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [],
        },
      });

      map.addLayer({
        id: "saved-lawn-polygons-fill",
        type: "fill",
        source: "saved-lawn-polygons",
        paint: {
          "fill-color": "#65a30d",
          "fill-opacity": 0.22,
        },
      });

      map.addLayer({
        id: "saved-lawn-polygons-outline",
        type: "line",
        source: "saved-lawn-polygons",
        paint: {
          "line-color": "#3f6212",
          "line-width": 2,
        },
      });

      map.addSource("saved-measurement-lines", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [],
        },
      });

      map.addLayer({
        id: "saved-measurement-lines-outline",
        type: "line",
        source: "saved-measurement-lines",
        paint: {
          "line-color": "#d97706",
          "line-width": 4,
        },
      });

      map.addLayer({
        id: "lawn-polygon-fill",
        type: "fill",
        source: "lawn-polygon",
        paint: {
          "fill-color": "#15803d",
          "fill-opacity": 0.28,
        },
      });

      map.addLayer({
        id: "lawn-polygon-outline",
        type: "line",
        source: "lawn-polygon",
        paint: {
          "line-color": "#14532d",
          "line-width": 3,
        },
      });

      map.addSource("lawn-line", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [],
        },
      });

      map.addLayer({
        id: "lawn-line-outline",
        type: "line",
        source: "lawn-line",
        paint: {
          "line-color": "#dc2626",
          "line-width": 4,
          "line-dasharray": [2, 2],
        },
      });
    });

    map.on("click", (event) => {
      if (interactionModeRef.current === "pick_address") {
        reverseGeocodePoint(event.lngLat.lng, event.lngLat.lat);
        return;
      }

      setPoints((current) => [
        ...current,
        roundPoint([event.lngLat.lng, event.lngLat.lat]),
      ]);
    });

    mapRef.current = map;

    return () => {
      markerRefs.current.forEach((marker) => marker.remove());
      markerRefs.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const polygonSource = map.getSource("lawn-polygon") as GeoJSONSource | undefined;
    const lineSource = map.getSource("lawn-line") as GeoJSONSource | undefined;
    const savedPolygonSource = map.getSource("saved-lawn-polygons") as
      | GeoJSONSource
      | undefined;
    const savedLineSource = map.getSource("saved-measurement-lines") as
      | GeoJSONSource
      | undefined;

    polygonSource?.setData({
      type: "FeatureCollection",
      features: polygonFeature ? [polygonFeature] : [],
    });

    lineSource?.setData({
      type: "FeatureCollection",
      features:
        points.length >= 2 && (drawTool === "line" || !polygonFeature)
          ? [buildLineFeature(points)]
          : [],
    });

    savedPolygonSource?.setData({
      type: "FeatureCollection",
      features: savedAreas.map((areaRow) => ({
        type: "Feature",
        properties: {
          label: areaRow.label,
          areaSqft: areaRow.areaSqft,
        },
        geometry: areaRow.geometryGeojson,
      })),
    });

    savedLineSource?.setData({
      type: "FeatureCollection",
      features: savedLines.map((lineRow) => ({
        type: "Feature",
        properties: {
          label: lineRow.label,
          lengthFt: lineRow.lengthFt,
        },
        geometry: lineRow.geometryGeojson,
      })),
    });

    markerRefs.current.forEach((marker) => marker.remove());
    markerRefs.current = points.map((point, index) => {
      const element = document.createElement("div");
      element.className =
        "flex h-7 w-7 cursor-grab items-center justify-center rounded-full border-2 border-white bg-secondary text-[11px] font-bold text-white shadow active:cursor-grabbing";
      element.textContent = String(index + 1);
      element.title = "Drag to adjust this boundary point";
      element.addEventListener("click", (event) => event.stopPropagation());

      const marker = new maplibregl.Marker({
        element,
        draggable: true,
      })
        .setLngLat(point)
        .addTo(map);

      marker.on("dragstart", () => {
        map.dragPan.disable();
      });

      marker.on("dragend", () => {
        map.dragPan.enable();
        const lngLat = marker.getLngLat();
        setPoints((current) =>
          current.map((existingPoint, pointIndex) =>
            pointIndex === index
              ? roundPoint([lngLat.lng, lngLat.lat])
              : existingPoint
          )
        );
      });

      return marker;
    });
  }, [drawTool, points, polygonFeature, savedAreas, savedLines]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    map.setLayoutProperty(
      "osm",
      "visibility",
      viewMode === "default" ? "visible" : "none"
    );
    map.setLayoutProperty(
      "satellite",
      "visibility",
      viewMode === "satellite" ? "visible" : "none"
    );
  }, [viewMode]);

  async function geocodeAddress() {
    const address = mapSearchAddress.trim();
    if (address.length < 6) {
      setGeocodeStatus("Enter a fuller address to center the map.");
      return;
    }

    setGeocodeStatus("Searching map...");
    const response = await fetch(
      `/api/address-quotes/geocode?address=${encodeURIComponent(address)}`
    );
    const data = (await response.json()) as
      | { lat: number; lon: number; label?: string }
      | { error?: string };

    if (!response.ok || !("lat" in data)) {
      setGeocodeStatus("Could not find that address. You can still pan the map manually.");
      return;
    }

    mapRef.current?.flyTo({
      center: [data.lon, data.lat],
      zoom: 18,
      essential: true,
    });
    setGeocodeStatus(data.label ? `Centered on ${data.label}` : "Map centered.");
  }

  function setFormField(name: string, value: string | null | undefined) {
    const field = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(
      `[name="${name}"]`
    );
    if (!field || !value) return;
    field.value = value;
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.dispatchEvent(new Event("change", { bubbles: true }));
  }

  async function reverseGeocodePoint(lng: number, lat: number) {
    setGeocodeStatus("Looking up address from clicked map point...");
    const response = await fetch(
      `/api/address-quotes/reverse-geocode?lat=${encodeURIComponent(
        String(lat)
      )}&lon=${encodeURIComponent(String(lng))}`
    );
    const data = (await response.json()) as
      | {
          displayAddress: string;
          street?: string | null;
          city?: string | null;
          state?: string | null;
          zip?: string | null;
        }
      | { error?: string };

    if (!response.ok || !("displayAddress" in data)) {
      setGeocodeStatus(
        "Could not identify an address there. Try another point or enter it manually."
      );
      return;
    }

    setFormField("displayAddress", data.displayAddress);
    setFormField("street", data.street);
    setFormField("city", data.city);
    setFormField("state", data.state);
    setFormField("zip", data.zip);
    setMapSearchAddress(data.displayAddress);
    setGeocodeStatus("Address fields filled from the clicked map point. Please confirm before publishing.");
    setInteractionMode("draw");
  }

  function saveCurrentArea() {
    if (!polygonFeature || measuredAreaSqft <= 0) return;

    const label = measurementLabel.trim() || `Area ${savedAreas.length + 1}`;
    setSavedAreas((current) => [
      ...current,
      {
        id: `area_${Date.now()}`,
        measurementType: "polygon_area",
        label,
        areaSqft: measuredAreaSqft,
        geometryGeojson: polygonFeature.geometry,
      },
    ]);
    setPoints([]);
    setMeasurementLabel(`Area ${savedAreas.length + 2}`);
  }

  function saveCurrentLine() {
    if (!lineFeature || measuredLengthFt <= 0) return;

    const label = measurementLabel.trim() || `Line ${savedLines.length + 1}`;
    setSavedLines((current) => [
      ...current,
      {
        id: `line_${Date.now()}`,
        measurementType: "linear_length",
        label,
        lengthFt: measuredLengthFt,
        geometryGeojson: lineFeature.geometry,
      },
    ]);
    setPoints([]);
    setMeasurementLabel(`Line ${savedLines.length + 2}`);
  }

  function removeSavedArea(areaId: string) {
    setSavedAreas((current) => current.filter((areaRow) => areaRow.id !== areaId));
  }

  function removeSavedLine(lineId: string) {
    setSavedLines((current) => current.filter((lineRow) => lineRow.id !== lineId));
  }

  function selectDrawTool(nextTool: DrawTool) {
    setDrawTool(nextTool);
    setInteractionMode("draw");
    setPoints([]);
    setMeasurementLabel(
      nextTool === "area"
        ? `Area ${savedAreas.length + 1}`
        : `Line ${savedLines.length + 1}`
    );
  }

  function saveCurrentMeasurement() {
    if (drawTool === "area") {
      saveCurrentArea();
      return;
    }

    saveCurrentLine();
  }

  function buildStaticMapSnapshotUrl() {
    const map = mapRef.current;
    if (!map || !MAPBOX_PUBLIC_TOKEN) return null;

    const center = map.getCenter();
    const canvas = map.getCanvas();
    const width = Math.min(1280, Math.max(320, Math.round(canvas.clientWidth)));
    const height = Math.min(1280, Math.max(240, Math.round(canvas.clientHeight)));
    const zoom = Math.min(MAX_MEASUREMENT_ZOOM, map.getZoom()).toFixed(2);
    const bearing = Math.round(map.getBearing());
    const pitch = Math.round(map.getPitch());

    const savedAreaFeatures = savedAreas.map((areaRow) => ({
      type: "Feature" as const,
      properties: {
        fill: "#15803d",
        "fill-opacity": 0.28,
        stroke: "#14532d",
        "stroke-width": 3,
      },
      geometry: areaRow.geometryGeojson,
    }));
    const savedLineFeatures = savedLines.map((lineRow) => ({
      type: "Feature" as const,
      properties: {
        stroke: "#d97706",
        "stroke-width": 5,
      },
      geometry: lineRow.geometryGeojson,
    }));
    const activeFeatures = [
      polygonFeature
        ? {
            ...polygonFeature,
            properties: {
              fill: "#15803d",
              "fill-opacity": 0.28,
              stroke: "#14532d",
              "stroke-width": 3,
            },
          }
        : null,
      lineFeature
        ? {
            ...lineFeature,
            properties: {
              stroke: "#d97706",
              "stroke-width": 5,
            },
          }
        : null,
    ].filter(Boolean);
    const features = [...savedAreaFeatures, ...savedLineFeatures, ...activeFeatures];
    const overlay =
      features.length > 0
        ? `geojson(${encodeURIComponent(
            JSON.stringify({
              type: "FeatureCollection",
              features,
            })
          )})/`
        : "";

    return `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/${overlay}${center.lng},${center.lat},${zoom},${bearing},${pitch}/${width}x${height}@2x?access_token=${MAPBOX_PUBLIC_TOKEN}`;
  }

  function captureMapSnapshot() {
    const snapshotUrl = buildStaticMapSnapshotUrl();
    if (!snapshotUrl) {
      setSnapshotStatus(
        "Could not create a screenshot because the Mapbox public token is missing."
      );
      return;
    }

    setMapSnapshotUrl(snapshotUrl);
    setSnapshotStatus("Map screenshot saved. It will be attached to this estimate.");
  }

  function undoPoint() {
    setPoints((current) => current.slice(0, -1));
  }

  function clearPoints() {
    setPoints([]);
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
      <input
        type="hidden"
        name="mapMeasuredAreaSqft"
        value={submittedAreaSqft > 0 ? String(submittedAreaSqft) : ""}
      />
      <input type="hidden" name="measurementsJson" value={measurementsJson} />
      <input type="hidden" name="mapSnapshotUrl" value={mapSnapshotUrl} />
      <input
        type="hidden"
        name="measurementSource"
        value={savedMeasurements.length > 0 ? "map_drawn" : "manual"}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">
            Map Measurement Tools
          </h2>
          <p className="mt-1 text-sm leading-6 text-text-secondary">
            Draw saved lawn areas, length lines for gutters or hedges, and a
            map screenshot so the customer can see exactly what was estimated.
          </p>
        </div>
        <div className="rounded-xl bg-secondary/10 px-4 py-3 text-right">
          <p className="text-xs font-semibold uppercase tracking-wide text-secondary">
            Saved Measurements
          </p>
          <p className="text-xl font-bold text-text-primary">
            {savedMeasurements.length > 0
              ? `${savedMeasurements.length} item${savedMeasurements.length === 1 ? "" : "s"}`
              : "Not drawn"}
          </p>
          {(submittedAreaSqft > 0 || submittedLengthFt > 0) && (
            <p className="mt-1 text-xs font-medium text-text-muted">
              {submittedAreaSqft > 0 ? `${formatSqft(submittedAreaSqft)} sq ft` : ""}
              {submittedAreaSqft > 0 && submittedLengthFt > 0 ? " + " : ""}
              {submittedLengthFt > 0 ? `${formatFeet(submittedLengthFt)} ft` : ""}
            </p>
          )}
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={mapSearchAddress}
            onChange={(event) => setMapSearchAddress(event.target.value)}
            placeholder="Search map address"
            className="w-full rounded-lg border border-border bg-surface py-2.5 pl-9 pr-4 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <button
          type="button"
          onClick={geocodeAddress}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-secondary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-secondary-dark"
        >
          <Search className="h-4 w-4" />
          Center Map
        </button>
      </div>
      {geocodeStatus && (
        <p className="mt-2 text-xs font-medium text-text-secondary">{geocodeStatus}</p>
      )}

      <div className="mt-4 flex flex-wrap gap-3">
        <div className="inline-flex rounded-lg border border-border bg-bg-warm p-1">
          <button
            type="button"
            onClick={() => setViewMode("default")}
            className={`rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
              viewMode === "default"
                ? "bg-surface text-text-primary shadow-sm"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            Default Map
          </button>
          <button
            type="button"
            onClick={() => setViewMode("satellite")}
            className={`rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
              viewMode === "satellite"
                ? "bg-surface text-text-primary shadow-sm"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            Satellite View
          </button>
        </div>

        <div className="inline-flex rounded-lg border border-border bg-bg-warm p-1">
          <button
            type="button"
            onClick={() => selectDrawTool("area")}
            className={`rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
              interactionMode === "draw" && drawTool === "area"
                ? "bg-surface text-text-primary shadow-sm"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            Draw Area
          </button>
          <button
            type="button"
            onClick={() => selectDrawTool("line")}
            className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
              interactionMode === "draw" && drawTool === "line"
                ? "bg-surface text-text-primary shadow-sm"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            <Ruler className="h-3.5 w-3.5" />
            Draw Line
          </button>
          <button
            type="button"
            onClick={() => setInteractionMode("pick_address")}
            className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
              interactionMode === "pick_address"
                ? "bg-surface text-text-primary shadow-sm"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            <MousePointer2 className="h-3.5 w-3.5" />
            Pick Address
          </button>
        </div>

        <button
          type="button"
          onClick={captureMapSnapshot}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-text-primary transition-colors hover:bg-white"
        >
          <Camera className="h-4 w-4" />
          Save Map Screenshot
        </button>
      </div>

      {interactionMode === "pick_address" && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
          Pick Address mode is on. Click the house or building on the map to
          fill the address fields, then confirm the address before publishing.
        </div>
      )}
      {interactionMode === "draw" && drawTool === "line" && (
        <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm font-medium text-primary">
          Draw Line mode is on. Click each bend or endpoint for gutters,
          hedges, fences, edging, or any length-based item.
        </div>
      )}
      {snapshotStatus && (
        <p className="mt-2 text-xs font-medium text-text-secondary">
          {snapshotStatus}
        </p>
      )}

      <div
        ref={mapContainerRef}
        className="mt-4 h-[420px] overflow-hidden rounded-xl border border-border bg-bg-warm"
      />

      <div className="mt-4 flex flex-wrap gap-2">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={measurementLabel}
            onChange={(event) => setMeasurementLabel(event.target.value)}
            placeholder={
              drawTool === "area"
                ? `Area ${savedAreas.length + 1}`
                : `Line ${savedLines.length + 1}`
            }
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <button
            type="button"
            onClick={saveCurrentMeasurement}
            disabled={
              drawTool === "area"
                ? !polygonFeature || measuredAreaSqft <= 0
                : !lineFeature || measuredLengthFt <= 0
            }
            className="inline-flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-secondary-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Check className="h-4 w-4" />
            {drawTool === "area"
              ? `Save Area${measuredAreaSqft > 0 ? ` (${formatSqft(measuredAreaSqft)} sq ft)` : ""}`
              : `Save Line${measuredLengthFt > 0 ? ` (${formatFeet(measuredLengthFt)} ft)` : ""}`}
          </button>
        </div>
        <button
          type="button"
          onClick={undoPoint}
          disabled={points.length === 0}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-text-primary transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Undo2 className="h-4 w-4" />
          Undo Point
        </button>
        <button
          type="button"
          onClick={clearPoints}
          disabled={points.length === 0}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-text-primary transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RotateCcw className="h-4 w-4" />
          Clear Drawing
        </button>
      </div>

      {mapSnapshotUrl && (
        <div className="mt-5 rounded-xl border border-border bg-bg-warm p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-text-primary">
                Saved Map Screenshot
              </h3>
              <p className="mt-1 text-xs text-text-muted">
                This proof image will be shown on the customer-facing estimate.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setMapSnapshotUrl("");
                setSnapshotStatus("Map screenshot removed.");
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold text-text-primary transition-colors hover:bg-white"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remove Screenshot
            </button>
          </div>
          <img
            src={mapSnapshotUrl}
            alt="Saved map screenshot preview"
            className="mt-3 w-full rounded-lg border border-border"
          />
        </div>
      )}

      {savedMeasurements.length > 0 && (
        <div className="mt-5 rounded-xl border border-border bg-bg-warm p-4">
          <h3 className="text-sm font-semibold text-text-primary">
            Saved Measurement Line Items
          </h3>
          <div className="mt-3 space-y-2">
            {savedAreas.map((areaRow, index) => (
              <div
                key={areaRow.id}
                className="flex items-center justify-between gap-3 rounded-lg bg-surface px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-semibold text-text-primary">
                    {areaRow.label || `Area ${index + 1}`}
                  </p>
                  <p className="text-text-muted">
                    {formatSqft(areaRow.areaSqft)} sq ft
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeSavedArea(areaRow.id)}
                  className="rounded-lg p-2 text-text-muted transition-colors hover:bg-red-50 hover:text-red-600"
                  aria-label={`Remove ${areaRow.label}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            {savedLines.map((lineRow, index) => (
              <div
                key={lineRow.id}
                className="flex items-center justify-between gap-3 rounded-lg bg-surface px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-semibold text-text-primary">
                    {lineRow.label || `Line ${index + 1}`}
                  </p>
                  <p className="text-text-muted">
                    {formatFeet(lineRow.lengthFt)} linear ft
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeSavedLine(lineRow.id)}
                  className="rounded-lg p-2 text-text-muted transition-colors hover:bg-red-50 hover:text-red-600"
                  aria-label={`Remove ${lineRow.label}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="mt-3 text-xs leading-5 text-text-muted">
        Tip: use satellite view to trace visible lawn areas, then switch to
        Draw Line for length-based work like gutters, hedges, fence runs, or
        edging. Save a screenshot before publishing when you want the customer
        to see the exact measured scope.
      </p>
    </section>
  );
}
