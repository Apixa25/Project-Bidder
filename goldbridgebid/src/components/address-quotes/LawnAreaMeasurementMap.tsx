"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { type GeoJSONSource, type Map as MapLibreMap } from "maplibre-gl";
import area from "@turf/area";
import {
  Camera,
  Check,
  LocateFixed,
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

export type InitialAddressQuoteMeasurement = {
  id: string;
  measurementType: "polygon_area" | "linear_length";
  label: string;
  areaSqft?: number;
  lengthFt?: number;
  geometryGeojson: Polygon | LineString;
};

interface LawnAreaMeasurementMapProps {
  initialMeasurements?: InitialAddressQuoteMeasurement[];
  initialMapSnapshotUrl?: string | null;
  initialMapSnapshotUrls?: string[];
  initialSearchAddress?: string | null;
  manageAddressFields?: boolean;
}

const DEFAULT_CENTER: LngLatPoint = [-124.2026, 41.7558];
// How far the user can interactively zoom the map
const MAX_MEASUREMENT_ZOOM = 22;
const MAPBOX_PUBLIC_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

// maxzoom values reflect the tile server's actual coverage ceiling.
// MapLibre will over-zoom (stretch) the highest available tile beyond this
// level instead of fetching a non-existent tile and showing "not yet available".
// Mapbox satellite-streets-v12 publishes tiles to z21 globally (z22 in major
// metros). ESRI World_Imagery reliably covers to z19 everywhere.
const SATELLITE_TILE_SOURCE = MAPBOX_PUBLIC_TOKEN
  ? {
      tiles: [
        `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/256/{z}/{x}/{y}@2x?access_token=${MAPBOX_PUBLIC_TOKEN}`,
      ],
      maxzoom: 21,
      attribution:
        '© <a href="https://www.mapbox.com/about/maps/">Mapbox</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }
  : {
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      maxzoom: 19,
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
      maxzoom: SATELLITE_TILE_SOURCE.maxzoom,
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

function getMeasurementCoordinates(measurements: SavedMeasurement[]) {
  return measurements.flatMap((measurement) => {
    if (measurement.geometryGeojson.type === "Polygon") {
      return measurement.geometryGeojson.coordinates[0] as LngLatPoint[];
    }

    return measurement.geometryGeojson.coordinates as LngLatPoint[];
  });
}

export default function LawnAreaMeasurementMap({
  initialMeasurements = [],
  initialMapSnapshotUrl = null,
  initialMapSnapshotUrls = [],
  initialSearchAddress = null,
  manageAddressFields = false,
}: LawnAreaMeasurementMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRefs = useRef<maplibregl.Marker[]>([]);
  const interactionModeRef = useRef<MapInteractionMode>("draw");
  const didFitInitialMeasurementsRef = useRef(false);
  const [points, setPoints] = useState<LngLatPoint[]>([]);
  const [savedAreas, setSavedAreas] = useState<SavedMeasurementArea[]>(() =>
    initialMeasurements
      .filter(
        (measurement): measurement is SavedMeasurementArea =>
          measurement.measurementType === "polygon_area" &&
          measurement.geometryGeojson.type === "Polygon" &&
          typeof measurement.areaSqft === "number"
      )
      .map((measurement) => ({
        id: measurement.id,
        measurementType: "polygon_area",
        label: measurement.label,
        areaSqft: measurement.areaSqft,
        geometryGeojson: measurement.geometryGeojson,
      }))
  );
  const [savedLines, setSavedLines] = useState<SavedMeasurementLine[]>(() =>
    initialMeasurements
      .filter(
        (measurement): measurement is SavedMeasurementLine =>
          measurement.measurementType === "linear_length" &&
          measurement.geometryGeojson.type === "LineString" &&
          typeof measurement.lengthFt === "number"
      )
      .map((measurement) => ({
        id: measurement.id,
        measurementType: "linear_length",
        label: measurement.label,
        lengthFt: measurement.lengthFt,
        geometryGeojson: measurement.geometryGeojson,
      }))
  );
  const [drawTool, setDrawTool] = useState<DrawTool>("area");
  const [measurementLabel, setMeasurementLabel] = useState("Area 1");
  const [mapSnapshotUrls, setMapSnapshotUrls] = useState<string[]>(() => {
    const urls = [
      ...initialMapSnapshotUrls,
      ...(initialMapSnapshotUrl ? [initialMapSnapshotUrl] : []),
    ];
    return Array.from(new Set(urls.filter(Boolean)));
  });
  const [snapshotStatus, setSnapshotStatus] = useState<string | null>(null);
  const [mapSearchAddress, setMapSearchAddress] = useState(initialSearchAddress || "");
  const [displayAddress, setDisplayAddress] = useState(initialSearchAddress || "");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [geocodeStatus, setGeocodeStatus] = useState<string | null>(null);
  const [isLocatingUser, setIsLocatingUser] = useState(false);
  const [pickedAddressPoint, setPickedAddressPoint] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [viewMode, setViewMode] = useState<MapViewMode>("default");
  const [interactionMode, setInteractionMode] = useState<MapInteractionMode>("draw");
  const [mapReady, setMapReady] = useState(false);

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
  const submittedAreaSqft = savedAreas.length > 0 ? savedAreaTotalSqft : measuredAreaSqft;
  const savedMeasurements: SavedMeasurement[] = useMemo(
    () => [...savedAreas, ...savedLines],
    [savedAreas, savedLines]
  );
  const measurementsJson = useMemo(
    () => JSON.stringify(savedMeasurements),
    [savedMeasurements]
  );

  useEffect(() => {
    interactionModeRef.current = interactionMode;
  }, [interactionMode]);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("address-quote-measurements-updated", {
        detail: savedMeasurements,
      })
    );
  }, [savedMeasurements]);

  const setAddressField = useCallback(
    (name: string, value: string | null | undefined) => {
      const nextValue = value || "";

      if (manageAddressFields) {
        if (name === "displayAddress") setDisplayAddress(nextValue);
        if (name === "street") setStreet(nextValue);
        if (name === "city") setCity(nextValue);
        if (name === "state") setState(nextValue);
        if (name === "zip") setZip(nextValue);
        return;
      }

      const field = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(
        `[name="${name}"]`
      );
      if (!field || !value) return;
      field.value = nextValue;
      field.dispatchEvent(new Event("input", { bubbles: true }));
      field.dispatchEvent(new Event("change", { bubbles: true }));
    },
    [manageAddressFields]
  );

  const reverseGeocodePoint = useCallback(
    async (
      lng: number,
      lat: number,
      copy: {
        lookupStatus: string;
        successStatus: string;
        failureStatus: string;
      } = {
        lookupStatus: "Looking up address from clicked map point...",
        successStatus:
          "Address fields filled from the clicked map point. Please confirm before publishing.",
        failureStatus:
          "Could not identify an address there. Try another point or enter it manually.",
      }
    ) => {
      setGeocodeStatus(copy.lookupStatus);
      setPickedAddressPoint({ lat, lng });

      try {
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
          setGeocodeStatus(copy.failureStatus);
          return;
        }

        setAddressField("displayAddress", data.displayAddress);
        setAddressField("street", data.street);
        setAddressField("city", data.city);
        setAddressField("state", data.state);
        setAddressField("zip", data.zip);
        setMapSearchAddress(data.displayAddress);
        setGeocodeStatus(copy.successStatus);
        setInteractionMode("draw");
      } catch {
        setGeocodeStatus(copy.failureStatus);
      }
    },
    [setAddressField]
  );

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
      setMapReady(true);
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
  }, [reverseGeocodePoint]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !map.isStyleLoaded()) return;

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
  }, [drawTool, mapReady, points, polygonFeature, savedAreas, savedLines]);

  useEffect(() => {
    const map = mapRef.current;
    const savedMeasurementsForBounds: SavedMeasurement[] = [...savedAreas, ...savedLines];
    if (
      !map ||
      !mapReady ||
      didFitInitialMeasurementsRef.current ||
      savedMeasurementsForBounds.length === 0
    ) {
      return;
    }

    const coordinates = getMeasurementCoordinates(savedMeasurementsForBounds);
    if (coordinates.length === 0) return;

    const bounds = coordinates.reduce(
      (nextBounds, coordinate) => nextBounds.extend(coordinate),
      new maplibregl.LngLatBounds(coordinates[0], coordinates[0])
    );

    map.fitBounds(bounds, {
      padding: 80,
      maxZoom: 20,
      duration: 0,
    });
    didFitInitialMeasurementsRef.current = true;
  }, [mapReady, savedAreas, savedLines]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !map.isStyleLoaded()) return;

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
  }, [mapReady, viewMode]);

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
    if (manageAddressFields) {
      const selectedAddress = data.label || address;
      setDisplayAddress(selectedAddress);
      setMapSearchAddress(selectedAddress);
      setPickedAddressPoint({ lat: data.lat, lng: data.lon });
    }
    setGeocodeStatus(data.label ? `Centered on ${data.label}` : "Map centered.");
  }

  function locateUserOnMap() {
    const map = mapRef.current;

    if (!map || !mapReady) {
      setGeocodeStatus("Map is still loading. Try Locate Me again in a moment.");
      return;
    }

    if (!navigator.geolocation) {
      setGeocodeStatus(
        "Location services are not available in this browser. You can still search or pick the address manually."
      );
      return;
    }

    setIsLocatingUser(true);
    setGeocodeStatus("Finding your current location...");
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude, accuracy } = position.coords;

        map.flyTo({
          center: [longitude, latitude],
          zoom: accuracy <= 75 ? 19 : 18,
          essential: true,
        });

        await reverseGeocodePoint(longitude, latitude, {
          lookupStatus: "Looking up the nearest address from your current location...",
          successStatus:
            "Address fields filled from your current location. Please confirm the exact property before publishing.",
          failureStatus:
            "Map centered on your current location, but the nearest address could not be identified. Try Pick Address on the house or enter it manually.",
        });
        setIsLocatingUser(false);
      },
      (error) => {
        setIsLocatingUser(false);
        if (error.code === error.PERMISSION_DENIED) {
          setGeocodeStatus(
            "Location permission was blocked. Allow location access in your browser, then try Locate Me again."
          );
          return;
        }

        if (error.code === error.TIMEOUT) {
          setGeocodeStatus(
            "Location lookup timed out. Check your signal and try Locate Me again."
          );
          return;
        }

        setGeocodeStatus(
          "Could not find your current location. You can still search or pick the address manually."
        );
      },
      {
        enableHighAccuracy: true,
        maximumAge: 30_000,
        timeout: 12_000,
      }
    );
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

    setMapSnapshotUrls((current) => [...current, snapshotUrl]);
    setSnapshotStatus("Map screenshot saved. It will be attached to this estimate.");
  }

  function undoPoint() {
    setPoints((current) => current.slice(0, -1));
  }

  function clearPoints() {
    setPoints([]);
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-3 shadow-sm sm:p-6">
      <input
        type="hidden"
        name="mapMeasuredAreaSqft"
        value={submittedAreaSqft > 0 ? String(submittedAreaSqft) : ""}
      />
      <input type="hidden" name="measurementsJson" value={measurementsJson} />
      <input type="hidden" name="mapSnapshotUrl" value={mapSnapshotUrls[0] || ""} />
      <input
        type="hidden"
        name="mapSnapshotUrlsJson"
        value={JSON.stringify(mapSnapshotUrls)}
      />
      <input
        type="hidden"
        name="measurementSource"
        value={savedMeasurements.length > 0 ? "map_drawn" : "manual"}
      />
      <input
        type="hidden"
        name="mapPickedLatitude"
        value={pickedAddressPoint ? String(pickedAddressPoint.lat) : ""}
      />
      <input
        type="hidden"
        name="mapPickedLongitude"
        value={pickedAddressPoint ? String(pickedAddressPoint.lng) : ""}
      />
      {manageAddressFields && (
        <>
          <input type="hidden" name="displayAddress" value={displayAddress} />
          <input type="hidden" name="street" value={street} />
          <input type="hidden" name="city" value={city} />
          <input type="hidden" name="state" value={state} />
          <input type="hidden" name="zip" value={zip} />
        </>
      )}

      <div>
        <h2 className="text-lg font-semibold text-text-primary">
          Map Measurement Tools
        </h2>
        <p className="mt-1 text-sm leading-6 text-text-secondary">
          Draw saved lawn areas, length lines for gutters or hedges, and a map
          screenshot so the customer can see exactly what was estimated.
        </p>
      </div>

      <div className="mt-4 space-y-2 sm:flex sm:flex-row sm:gap-3 sm:space-y-0">
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
        <div className="grid grid-cols-2 gap-2 sm:contents">
          <button
            type="button"
            onClick={geocodeAddress}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-secondary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-secondary-dark"
          >
            <Search className="h-4 w-4" />
            Center Map
          </button>
          <button
            type="button"
            onClick={locateUserOnMap}
            disabled={isLocatingUser}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-secondary/30 bg-surface px-4 py-2.5 text-sm font-semibold text-secondary transition-colors hover:bg-secondary/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LocateFixed className="h-4 w-4" />
            {isLocatingUser ? "Locating..." : "Locate Me"}
          </button>
        </div>
      </div>
      {geocodeStatus && (
        <p className="mt-2 text-xs font-medium text-text-secondary">{geocodeStatus}</p>
      )}

      {manageAddressFields && (
        <div className="mt-4 rounded-xl border border-border bg-bg-warm p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            Selected quote address
          </p>
          <p className="mt-1 text-sm font-semibold text-text-primary">
            {displayAddress || "No address selected yet"}
          </p>
          <p className="mt-1 text-xs leading-5 text-text-secondary">
            Search to center the map, use Pick Address or Locate Me to confirm
            the property, then draw measurements. The saved quote will attach to
            this selected address.
          </p>
          <details className="mt-3">
            <summary className="cursor-pointer text-xs font-semibold text-primary">
              Edit address details manually
            </summary>
            <div className="mt-3 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-text-primary">
                  Full address *
                </label>
                <input
                  type="text"
                  required
                  value={displayAddress}
                  onChange={(event) => setDisplayAddress(event.target.value)}
                  placeholder="123 Front St, Crescent City, CA 95531"
                  className="mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-6">
                <div className="sm:col-span-3">
                  <label className="block text-xs font-semibold text-text-primary">
                    Street
                  </label>
                  <input
                    type="text"
                    value={street}
                    onChange={(event) => setStreet(event.target.value)}
                    placeholder="123 Front St"
                    className="mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-xs font-semibold text-text-primary">
                    City
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(event) => setCity(event.target.value)}
                    placeholder="Crescent City"
                    className="mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-text-primary">
                    State
                  </label>
                  <input
                    type="text"
                    value={state}
                    onChange={(event) => setState(event.target.value.toUpperCase())}
                    placeholder="CA"
                    maxLength={2}
                    className="mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-text-primary">
                    ZIP
                  </label>
                  <input
                    type="text"
                    value={zip}
                    onChange={(event) => setZip(event.target.value)}
                    placeholder="95531"
                    className="mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
            </div>
          </details>
        </div>
      )}

      <div className="mt-3 grid gap-2 sm:flex sm:flex-wrap sm:gap-3">
        <div className="grid w-full grid-cols-2 gap-1 rounded-lg border border-border bg-bg-warm p-1 sm:inline-flex sm:w-auto sm:gap-0">
          <button
            type="button"
            onClick={() => setViewMode("default")}
            className={`rounded-md px-3 py-2 text-sm font-semibold transition-colors sm:py-1.5 ${
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
            className={`rounded-md px-3 py-2 text-sm font-semibold transition-colors sm:py-1.5 ${
              viewMode === "satellite"
                ? "bg-surface text-text-primary shadow-sm"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            Satellite View
          </button>
        </div>

        <div className="grid w-full grid-cols-3 gap-1 rounded-lg border border-border bg-bg-warm p-1 sm:inline-flex sm:w-auto sm:gap-0">
          <button
            type="button"
            onClick={() => selectDrawTool("area")}
            className={`rounded-md px-2 py-2 text-center text-xs font-semibold transition-colors sm:px-3 sm:py-1.5 sm:text-sm ${
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
            className={`inline-flex items-center justify-center gap-1 rounded-md px-2 py-2 text-xs font-semibold transition-colors sm:px-3 sm:py-1.5 sm:text-sm ${
              interactionMode === "draw" && drawTool === "line"
                ? "bg-surface text-text-primary shadow-sm"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            <Ruler className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            Draw Line
          </button>
          <button
            type="button"
            onClick={() => setInteractionMode("pick_address")}
            className={`inline-flex items-center justify-center gap-1 rounded-md px-2 py-2 text-xs font-semibold transition-colors sm:px-3 sm:py-1.5 sm:text-sm ${
              interactionMode === "pick_address"
                ? "bg-surface text-text-primary shadow-sm"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            <MousePointer2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            Pick Addr
          </button>
        </div>

        <button
          type="button"
          onClick={captureMapSnapshot}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-text-primary transition-colors hover:bg-white sm:w-auto"
        >
          <Camera className="h-4 w-4" />
          Screenshot
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
        className="mt-4 h-[320px] max-h-[55svh] overflow-hidden rounded-xl border border-border bg-bg-warm sm:h-[420px] sm:max-h-none"
      />

      <div className="mt-4 space-y-2 sm:flex sm:flex-wrap sm:gap-2 sm:space-y-0">
        <input
          type="text"
          value={measurementLabel}
          onChange={(event) => setMeasurementLabel(event.target.value)}
          placeholder={
            drawTool === "area"
              ? `Area ${savedAreas.length + 1}`
              : `Line ${savedLines.length + 1}`
          }
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:w-auto"
        />
        <button
          type="button"
          onClick={saveCurrentMeasurement}
          disabled={
            drawTool === "area"
              ? !polygonFeature || measuredAreaSqft <= 0
              : !lineFeature || measuredLengthFt <= 0
          }
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-secondary px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-secondary-dark disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          <Check className="h-4 w-4" />
          {drawTool === "area"
            ? `Save Area${measuredAreaSqft > 0 ? ` (${formatSqft(measuredAreaSqft)} sq ft)` : ""}`
            : `Save Line${measuredLengthFt > 0 ? ` (${formatFeet(measuredLengthFt)} ft)` : ""}`}
        </button>
        <div className="grid grid-cols-2 gap-2 sm:contents">
          <button
            type="button"
            onClick={undoPoint}
            disabled={points.length === 0}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-text-primary transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Undo2 className="h-4 w-4" />
            Undo
          </button>
          <button
            type="button"
            onClick={clearPoints}
            disabled={points.length === 0}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-text-primary transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RotateCcw className="h-4 w-4" />
            Clear
          </button>
        </div>
      </div>

      {mapSnapshotUrls.length > 0 && (
        <div className="mt-5 rounded-xl border border-border bg-bg-warm p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-text-primary">
                Saved Map Screenshots
              </h3>
              <p className="mt-1 text-xs text-text-muted">
                These proof images will be shown on the customer-facing estimate.
              </p>
            </div>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {mapSnapshotUrls.map((snapshotUrl, index) => (
              <div
                key={`${snapshotUrl}_${index}`}
                className="overflow-hidden rounded-lg border border-border bg-surface"
              >
                <img
                  src={snapshotUrl}
                  alt={`Saved map screenshot preview ${index + 1}`}
                  className="aspect-video w-full object-cover"
                />
                <div className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="text-xs font-semibold text-text-secondary">
                    Map screenshot {index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setMapSnapshotUrls((current) =>
                        current.filter((_, snapshotIndex) => snapshotIndex !== index)
                      );
                      setSnapshotStatus("Map screenshot removed.");
                    }}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
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
                <div className="min-w-0">
                  <p className="break-words font-semibold text-text-primary">
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
                <div className="min-w-0">
                  <p className="break-words font-semibold text-text-primary">
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
