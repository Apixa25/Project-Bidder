import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const WINDOW_MS = 10 * 60 * 1000;
const SIGNED_IN_LIMIT = 30;
const ANONYMOUS_LIMIT = 10;
const NOMINATIM_GAP_MS = 1100;

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
let nominatimAvailableAt = 0;

export function mapClientKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  return ip;
}

export async function signedInMapUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Per-instance limit. This does not need Redis. A new server process
 * starts with an empty counter, which is the free bound for a public route.
 */
export function mapRateLimitResponse(request: Request, route: string, signedIn: boolean) {
  const limit = signedIn ? SIGNED_IN_LIMIT : ANONYMOUS_LIMIT;
  const key = `${route}:${mapClientKey(request)}:${signedIn ? "user" : "anon"}`;
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || now >= current.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return null;
  }

  if (current.count >= limit) {
    return NextResponse.json(
      { error: "Too many map lookups. Wait a few minutes and try again." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  current.count += 1;
  return null;
}

/** OpenStreetMap asks for at most one Nominatim request per second. */
export function takeNominatimSlot() {
  const now = Date.now();
  if (now < nominatimAvailableAt) return false;
  nominatimAvailableAt = now + NOMINATIM_GAP_MS;
  return true;
}

export function nominatimBusyResponse() {
  return NextResponse.json(
    { error: "Address lookup is busy. Try again in a second." },
    { status: 429, headers: { "Retry-After": "1" } }
  );
}
