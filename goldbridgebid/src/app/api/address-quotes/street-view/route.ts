import { NextResponse } from "next/server";

function getLocationParam(url: URL) {
  const lat = url.searchParams.get("lat");
  const lng = url.searchParams.get("lng");
  const location = url.searchParams.get("location")?.trim();

  if (lat && lng) return `${lat},${lng}`;
  return location || "";
}

function getNumberParam(url: URL, key: string, fallback: number) {
  const value = Number.parseFloat(url.searchParams.get(key) || "");
  return Number.isFinite(value) ? value : fallback;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
  const location = getLocationParam(url);

  if (!apiKey) {
    return NextResponse.json(
      { error: "Google Maps API key is not configured." },
      { status: 500 }
    );
  }

  if (location.length < 3) {
    return NextResponse.json(
      { error: "Enter an address or pick a map point first." },
      { status: 400 }
    );
  }

  const heading = getNumberParam(url, "heading", 0);
  const pitch = getNumberParam(url, "pitch", 0);
  const fov = Math.min(120, Math.max(30, getNumberParam(url, "fov", 80)));
  const metadataUrl = new URL("https://maps.googleapis.com/maps/api/streetview/metadata");
  metadataUrl.searchParams.set("location", location);
  metadataUrl.searchParams.set("key", apiKey);

  const metadataResponse = await fetch(metadataUrl);
  const metadata = (await metadataResponse.json()) as {
    status?: string;
    location?: { lat: number; lng: number };
  };

  if (metadata.status !== "OK") {
    return NextResponse.json(
      { error: "No Google Street View image was found for that location." },
      { status: 404 }
    );
  }

  const imageUrl = new URL("https://maps.googleapis.com/maps/api/streetview");
  imageUrl.searchParams.set("size", "960x540");
  imageUrl.searchParams.set(
    "location",
    metadata.location
      ? `${metadata.location.lat},${metadata.location.lng}`
      : location
  );
  imageUrl.searchParams.set("heading", String(heading));
  imageUrl.searchParams.set("pitch", String(pitch));
  imageUrl.searchParams.set("fov", String(fov));
  imageUrl.searchParams.set("key", apiKey);

  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    return NextResponse.json(
      { error: "Google Street View image request failed." },
      { status: 502 }
    );
  }

  const buffer = Buffer.from(await imageResponse.arrayBuffer());
  return NextResponse.json({
    imageDataUrl: `data:image/jpeg;base64,${buffer.toString("base64")}`,
    location: metadata.location || null,
    heading,
    pitch,
    fov,
  });
}
