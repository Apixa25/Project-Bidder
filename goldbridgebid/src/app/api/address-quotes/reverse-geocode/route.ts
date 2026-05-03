import { NextResponse } from "next/server";

const NOMINATIM_UA =
  "ProjectXBidX-AddressQuotes/1.0 (https://www.projectxbidx.com)";

type ReverseGeocodeResult = {
  displayAddress: string;
  street: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  provider: "google" | "mapbox" | "nominatim";
};

function buildStreet(address: Record<string, string | undefined>) {
  return [address.house_number, address.road]
    .map((part) => (part || "").trim())
    .filter(Boolean)
    .join(" ");
}

function getGoogleAddressPart(
  components: Array<{ long_name: string; short_name: string; types: string[] }>,
  type: string,
  useShortName = false
) {
  const component = components.find((entry) => entry.types.includes(type));
  return component ? (useShortName ? component.short_name : component.long_name) : null;
}

async function reverseGeocodeWithGoogle(
  lat: number,
  lon: number
): Promise<ReverseGeocodeResult | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!apiKey) return null;

  const googleUrl = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  googleUrl.searchParams.set("latlng", `${lat},${lon}`);
  googleUrl.searchParams.set("result_type", "street_address|premise");
  googleUrl.searchParams.set("key", apiKey);

  const response = await fetch(googleUrl, { next: { revalidate: 86400 } });
  if (!response.ok) return null;

  const data = (await response.json()) as {
    status?: string;
    results?: Array<{
      formatted_address?: string;
      address_components?: Array<{
        long_name: string;
        short_name: string;
        types: string[];
      }>;
    }>;
  };
  const result = data.results?.[0];
  const components = result?.address_components || [];
  if (data.status !== "OK" || !result?.formatted_address) return null;

  const streetNumber = getGoogleAddressPart(components, "street_number");
  const route = getGoogleAddressPart(components, "route");
  const city =
    getGoogleAddressPart(components, "locality") ||
    getGoogleAddressPart(components, "postal_town") ||
    getGoogleAddressPart(components, "administrative_area_level_2");

  return {
    displayAddress: result.formatted_address,
    street: [streetNumber, route].filter(Boolean).join(" ") || null,
    city,
    state: getGoogleAddressPart(components, "administrative_area_level_1", true),
    zip: getGoogleAddressPart(components, "postal_code"),
    provider: "google",
  };
}

function getContextName(
  context: Record<string, { name?: string; region_code?: string } | undefined>,
  key: string
) {
  return context[key]?.name || null;
}

async function reverseGeocodeWithMapbox(
  lat: number,
  lon: number
): Promise<ReverseGeocodeResult | null> {
  const token = process.env.MAPBOX_ACCESS_TOKEN;
  if (!token) return null;

  const response = await fetch(
    `https://api.mapbox.com/search/geocode/v6/reverse?longitude=${encodeURIComponent(
      String(lon)
    )}&latitude=${encodeURIComponent(
      String(lat)
    )}&types=address&limit=1&access_token=${encodeURIComponent(token)}`,
    {
      headers: {
        Accept: "application/json",
      },
      next: { revalidate: 86400 },
    }
  );

  if (!response.ok) return null;

  const result = (await response.json()) as {
    features?: Array<{
      properties?: {
        name?: string;
        full_address?: string;
        place_formatted?: string;
        context?: Record<string, { name?: string; region_code?: string }>;
      };
    }>;
  };

  const feature = result.features?.[0];
  const properties = feature?.properties;
  if (!properties) return null;

  const context = properties.context || {};
  const street = properties.name || getContextName(context, "address");
  const city =
    getContextName(context, "place") ||
    getContextName(context, "locality") ||
    getContextName(context, "neighborhood");
  const state = context.region?.region_code || context.region?.name || null;
  const zip = getContextName(context, "postcode");
  const displayAddress =
    properties.full_address ||
    [street, properties.place_formatted].filter(Boolean).join(", ");

  if (!displayAddress) return null;

  return {
    displayAddress,
    street,
    city,
    state,
    zip,
    provider: "mapbox",
  };
}

async function reverseGeocodeWithNominatim(
  lat: number,
  lon: number
): Promise<ReverseGeocodeResult | null> {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
      String(lat)
    )}&lon=${encodeURIComponent(String(lon))}`,
    {
      headers: {
        "User-Agent": NOMINATIM_UA,
        Accept: "application/json",
      },
      next: { revalidate: 86400 },
    }
  );

  if (!response.ok) return null;

  const result = (await response.json()) as {
    display_name?: string;
    address?: Record<string, string | undefined>;
  };

  const address = result.address || {};
  const street = buildStreet(address);
  const city =
    address.city ||
    address.town ||
    address.village ||
    address.hamlet ||
    address.county ||
    null;
  const state = address.state || null;
  const zip = address.postcode || null;
  const displayAddress =
    [street, city, state, zip].filter(Boolean).join(", ") ||
    result.display_name ||
    "";

  if (!displayAddress) return null;

  return {
    displayAddress,
    street: street || null,
    city,
    state,
    zip,
    provider: "nominatim",
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const lat = Number.parseFloat(url.searchParams.get("lat") || "");
  const lon = Number.parseFloat(url.searchParams.get("lon") || "");

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json(
      { error: "Valid latitude and longitude are required." },
      { status: 400 }
    );
  }

  const address =
    (await reverseGeocodeWithGoogle(lat, lon)) ||
    (await reverseGeocodeWithMapbox(lat, lon)) ||
    (await reverseGeocodeWithNominatim(lat, lon));

  if (!address) {
    return NextResponse.json(
      { error: "No address found for this point." },
      { status: 404 }
    );
  }

  return NextResponse.json(address);
}
