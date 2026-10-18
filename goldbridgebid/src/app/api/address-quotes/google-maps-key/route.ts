import { NextResponse } from "next/server";
import {
  mapRateLimitResponse,
  signedInMapUser,
} from "@/lib/address-quotes/public-route-guard";

export async function GET(request: Request) {
  const user = await signedInMapUser();
  const limited = mapRateLimitResponse(request, "google-maps-key", Boolean(user));
  if (limited) return limited;

  if (!user) {
    return NextResponse.json(
      { error: "Sign in to load Google Maps." },
      { status: 404 }
    );
  }

  const apiKey =
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY?.trim() ||
    "";

  if (!apiKey) {
    return NextResponse.json(
      { error: "Google Maps browser key is not configured." },
      { status: 404 }
    );
  }

  return NextResponse.json({ apiKey });
}
