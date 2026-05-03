import { NextResponse } from "next/server";

const NOMINATIM_UA =
  "ProjectXBidX-AddressQuotes/1.0 (https://www.projectxbidx.com)";

async function geocodeWithGoogle(address: string) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!apiKey) return null;

  const googleUrl = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  googleUrl.searchParams.set("address", address);
  googleUrl.searchParams.set("key", apiKey);

  const response = await fetch(googleUrl, { next: { revalidate: 86400 } });
  if (!response.ok) return null;

  const data = (await response.json()) as {
    status?: string;
    results?: Array<{
      formatted_address?: string;
      geometry?: { location?: { lat: number; lng: number } };
    }>;
  };
  const result = data.results?.[0];
  const location = result?.geometry?.location;
  if (data.status !== "OK" || !location) return null;

  return {
    lat: location.lat,
    lon: location.lng,
    label: result.formatted_address || address,
    provider: "google",
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const address = (url.searchParams.get("address") || "").trim();

  if (address.length < 6) {
    return NextResponse.json(
      { error: "Enter a fuller address." },
      { status: 400 }
    );
  }

  const googleResult = await geocodeWithGoogle(address);
  if (googleResult) {
    return NextResponse.json(googleResult);
  }

  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      address
    )}&limit=1`,
    {
      headers: {
        "User-Agent": NOMINATIM_UA,
        Accept: "application/json",
      },
      next: { revalidate: 86400 },
    }
  );

  if (!response.ok) {
    return NextResponse.json(
      { error: "Address lookup failed." },
      { status: 502 }
    );
  }

  const rows = (await response.json()) as Array<{
    lat: string;
    lon: string;
    display_name?: string;
  }>;
  const first = rows[0];
  if (!first) {
    return NextResponse.json(
      { error: "Address not found." },
      { status: 404 }
    );
  }

  const lat = Number.parseFloat(first.lat);
  const lon = Number.parseFloat(first.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json(
      { error: "Address lookup returned invalid coordinates." },
      { status: 502 }
    );
  }

  return NextResponse.json({
    lat,
    lon,
    label: first.display_name || address,
    provider: "nominatim",
  });
}
