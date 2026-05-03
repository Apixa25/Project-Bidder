import { NextResponse } from "next/server";

export async function GET() {
  const apiKey =
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY?.trim() ||
    process.env.GOOGLE_MAPS_API_KEY?.trim() ||
    "";

  if (!apiKey) {
    return NextResponse.json(
      { error: "Google Maps browser key is not configured." },
      { status: 500 }
    );
  }

  return NextResponse.json({ apiKey });
}
