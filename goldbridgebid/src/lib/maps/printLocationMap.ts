import { unstable_cache } from "next/cache";

const NOMINATIM_UA =
  "ProjectXBidX-Print/1.0 (https://www.projectxbidx.com)";

/**
 * A single 256px OSM tile + marker position for a print-friendly (non-interactive) map.
 * Uses Nominatim (geocoding) + openstreetmap.org tiles — no Google Maps API key.
 */
export type PrintOsmMapData = {
  tileUrl: string;
  /** Pin position in tile space, 0–256 */
  markerX: number;
  markerY: number;
  zoom: number;
};

async function geocodeNominatim(
  fullAddress: string
): Promise<{ lat: number; lon: number } | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
    fullAddress
  )}&limit=1`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": NOMINATIM_UA,
      Accept: "application/json",
    },
  });
  if (!res.ok) return null;
  const rows = (await res.json()) as Array<{ lat: string; lon: string }>;
  const r = rows[0];
  if (!r) return null;
  const lat = parseFloat(r.lat);
  const lon = parseFloat(r.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon };
}

function buildMapData(
  lat: number,
  lon: number,
  z: number
): PrintOsmMapData | null {
  const n = 2 ** z;
  const x = ((lon + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const y =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) *
    n;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (x < 0 || x >= n || y < 0 || y >= n) {
    if (z > 4) return buildMapData(lat, lon, z - 1);
    return null;
  }
  const tileX = Math.floor(x);
  const tileY = Math.floor(y);
  const pixelX = 256 * (x - tileX);
  const pixelY = 256 * (y - tileY);
  return {
    tileUrl: `https://tile.openstreetmap.org/${z}/${tileX}/${tileY}.png`,
    markerX: pixelX,
    markerY: pixelY,
    zoom: z,
  };
}

/**
 * Resolves a small static map (tile + red pin) for the print summary, or `null` if
 * geocoding fails (caller should not render a map).
 */
export async function getPrintLocationMapData(
  fullAddress: string
): Promise<PrintOsmMapData | null> {
  const trimmed = fullAddress.trim();
  if (!trimmed) return null;

  try {
    return await unstable_cache(
      async () => {
        const geo = await geocodeNominatim(trimmed);
        if (!geo) return null;
        return buildMapData(geo.lat, geo.lon, 16);
      },
      ["print-loc-map", trimmed],
      { revalidate: 86400 }
    )();
  } catch {
    return null;
  }
}
