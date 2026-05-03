"use server";

import crypto from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { userHasRole } from "@/lib/auth/roles";
import {
  ADDRESS_QUOTE_SERVICE_LABELS,
  isAddressQuoteServiceVertical,
  isAddressQuoteRequestServiceVertical,
  type AddressQuoteServiceVertical,
} from "@/lib/address-quotes/service-verticals";
import type {
  AddressQuoteMedia,
  AddressQuoteMediaType,
  BidLineItemCalcMode,
  PropertyAddress,
} from "@/types/database";

const MAX_ACTIVE_ADDRESS_CLAIMS = 3;
const MAX_CUSTOMER_ADDRESS_CLAIMS = 1;
const NEARBY_QUOTE_SEARCH_RADIUS_METERS = 350;

function normalizeAddress(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[.,#]/g, " ")
    .replace(/\s+/g, " ");
}

function hashAddress(normalizedAddress: string) {
  return crypto.createHash("sha256").update(normalizedAddress).digest("hex");
}

function getDistanceMeters(
  first: { latitude: number; longitude: number },
  second: { latitude: number; longitude: number }
) {
  const earthRadiusMeters = 6_371_000;
  const firstLat = (first.latitude * Math.PI) / 180;
  const secondLat = (second.latitude * Math.PI) / 180;
  const deltaLat = ((second.latitude - first.latitude) * Math.PI) / 180;
  const deltaLon = ((second.longitude - first.longitude) * Math.PI) / 180;
  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(firstLat) * Math.cos(secondLat) * Math.sin(deltaLon / 2) ** 2;

  return (
    2 * earthRadiusMeters * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  );
}

async function geocodePropertyAddress(displayAddress: string) {
  try {
    const googleKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
    if (googleKey) {
      const googleUrl = new URL("https://maps.googleapis.com/maps/api/geocode/json");
      googleUrl.searchParams.set("address", displayAddress);
      googleUrl.searchParams.set("key", googleKey);

      const googleResponse = await fetch(googleUrl, { next: { revalidate: 86400 } });
      if (googleResponse.ok) {
        const googleData = (await googleResponse.json()) as {
          status?: string;
          results?: Array<{ geometry?: { location?: { lat: number; lng: number } } }>;
        };
        const location = googleData.results?.[0]?.geometry?.location;
        if (
          googleData.status === "OK" &&
          location &&
          Number.isFinite(location.lat) &&
          Number.isFinite(location.lng)
        ) {
          return { latitude: location.lat, longitude: location.lng };
        }
      }
    }

    const token = process.env.MAPBOX_ACCESS_TOKEN?.trim();
    if (!token) return null;

    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
        displayAddress
      )}.json?access_token=${encodeURIComponent(token)}&limit=1&types=address`,
      { next: { revalidate: 86400 } }
    );

    if (!response.ok) return null;
    const data = (await response.json()) as {
      features?: Array<{ center?: [number, number] }>;
    };
    const center = data.features?.[0]?.center;
    if (!center) return null;

    const [longitude, latitude] = center;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

    return { latitude, longitude };
  } catch (error) {
    console.error("Address quote geocoding failed:", error);
    return null;
  }
}

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getOptionalString(formData: FormData, key: string) {
  const value = getString(formData, key);
  return value.length > 0 ? value : null;
}

function parseDollarsToCents(rawValue: string) {
  const normalized = rawValue.replace(/[$,\s]/g, "");
  const value = Number.parseFloat(normalized);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

function parsePositiveNumber(rawValue: string) {
  const value = Number.parseFloat(rawValue.replace(/[,\s]/g, ""));
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100) / 100;
}

function parseCoordinate(rawValue: string) {
  const value = Number.parseFloat(rawValue);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 10_000_000) / 10_000_000;
}

function getRequestedServices(formData: FormData) {
  return formData
    .getAll("services")
    .filter((value): value is string => typeof value === "string")
    .filter(isAddressQuoteRequestServiceVertical);
}

type SubmittedMeasurement = {
  clientId: string;
  measurementType: "polygon_area" | "linear_length";
  label: string;
  areaSqft?: number;
  lengthFt?: number;
  geometryGeojson: Record<string, unknown>;
};

type SubmittedPricingLineItem = {
  measurementId: string | null;
  measurementClientId: string | null;
  itemLabel: string;
  description: string | null;
  unit: string | null;
  quantity: number;
  amount: number;
  calcMode: BidLineItemCalcMode;
  lineTotal: number;
  displayOrder: number;
  isCustom: boolean;
};

type SubmittedQuoteMedia = {
  mediaType: AddressQuoteMediaType;
  url: string;
  caption: string | null;
  displayOrder: number;
};

function parseMeasurements(rawValue: string): SubmittedMeasurement[] {
  if (!rawValue) return [];

  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((entry, index): SubmittedMeasurement | null => {
        if (!entry || typeof entry !== "object") return null;

        const measurementType: SubmittedMeasurement["measurementType"] =
          entry.measurementType === "linear_length"
            ? "linear_length"
            : "polygon_area";
        const areaSqft =
          typeof entry.areaSqft === "number" && Number.isFinite(entry.areaSqft)
            ? Math.round(entry.areaSqft * 100) / 100
            : null;
        const lengthFt =
          typeof entry.lengthFt === "number" && Number.isFinite(entry.lengthFt)
            ? Math.round(entry.lengthFt * 100) / 100
            : null;
        const geometryGeojson =
          entry.geometryGeojson &&
          typeof entry.geometryGeojson === "object" &&
          (entry.geometryGeojson as { type?: unknown }).type ===
            (measurementType === "linear_length" ? "LineString" : "Polygon")
            ? (entry.geometryGeojson as Record<string, unknown>)
            : null;

        if (!geometryGeojson) return null;
        if (measurementType === "polygon_area" && (!areaSqft || areaSqft <= 0)) {
          return null;
        }
        if (measurementType === "linear_length" && (!lengthFt || lengthFt <= 0)) {
          return null;
        }

        const rawLabel =
          typeof entry.label === "string" ? entry.label.trim() : "";
        const rawClientId =
          typeof entry.id === "string" && entry.id.trim()
            ? entry.id.trim()
            : `measurement_${index}`;

        return {
          clientId: rawClientId,
          measurementType,
          label:
            rawLabel ||
            `${measurementType === "linear_length" ? "Line" : "Area"} ${index + 1}`,
          areaSqft: areaSqft || undefined,
          lengthFt: lengthFt || undefined,
          geometryGeojson,
        };
      })
      .filter((entry): entry is SubmittedMeasurement => entry !== null);
  } catch {
    return [];
  }
}

function toMoney(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.round(parsed * 100) / 100;
}

function toCalcMode(value: unknown): BidLineItemCalcMode {
  return value === "add" ? "add" : "multiply";
}

function applyLineItemMode(
  value: number,
  mode: BidLineItemCalcMode,
  quantity: number
) {
  return mode === "multiply" ? value * quantity : value;
}

function parsePricingLineItems(rawValue: string): SubmittedPricingLineItem[] {
  if (!rawValue) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawValue);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) return [];

  return parsed
    .map((entry, index): SubmittedPricingLineItem | null => {
      if (!entry || typeof entry !== "object") return null;

      const line = entry as Record<string, unknown>;
      const itemLabel = String(line.itemLabel || "").trim();
      if (!itemLabel) return null;

      const quantity = toMoney(line.quantity);
      const amount = toMoney(line.amount);
      const calcMode = toCalcMode(line.calcMode);
      const lineTotal =
        Math.round(applyLineItemMode(amount, calcMode, quantity) * 100) / 100;

      return {
        measurementId:
          typeof line.measurementId === "string" && line.measurementId
            ? line.measurementId
            : null,
        measurementClientId:
          typeof line.measurementClientId === "string" && line.measurementClientId
            ? line.measurementClientId
            : null,
        itemLabel: itemLabel.slice(0, 200),
        description: line.description
          ? String(line.description).slice(0, 1000)
          : null,
        unit: line.unit ? String(line.unit).trim().slice(0, 40) || null : null,
        quantity,
        amount,
        calcMode,
        lineTotal,
        displayOrder: Number.isInteger(line.displayOrder)
          ? Number(line.displayOrder)
          : index,
        isCustom: Boolean(line.isCustom),
      };
    })
    .filter((item): item is SubmittedPricingLineItem => item !== null)
    .filter(
      (item) =>
        item.lineTotal > 0 ||
        item.quantity > 0 ||
        item.amount > 0
    );
}

function parseStringArray(rawValue: string) {
  if (!rawValue) return [];

  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (value): value is string => typeof value === "string" && value.trim().length > 0
    );
  } catch {
    return [];
  }
}

function parseExistingQuoteMedia(rawValue: string): SubmittedQuoteMedia[] {
  if (!rawValue) return [];

  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((entry, index): SubmittedQuoteMedia | null => {
        if (!entry || typeof entry !== "object") return null;
        const row = entry as Partial<AddressQuoteMedia>;
        if (!row.url || typeof row.url !== "string") return null;
        if (
          row.media_type !== "uploaded_photo" &&
          row.media_type !== "street_view" &&
          row.media_type !== "map_snapshot"
        ) {
          return null;
        }

        return {
          mediaType: row.media_type,
          url: row.url,
          caption: row.caption || null,
          displayOrder:
            typeof row.display_order === "number" ? row.display_order : index,
        };
      })
      .filter((entry): entry is SubmittedQuoteMedia => entry !== null);
  } catch {
    return [];
  }
}

function parseStreetViewImages(rawValue: string): SubmittedQuoteMedia[] {
  if (!rawValue) return [];

  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((entry, index): SubmittedQuoteMedia | null => {
        if (!entry || typeof entry !== "object") return null;
        const row = entry as { imageDataUrl?: unknown; caption?: unknown };
        if (
          typeof row.imageDataUrl !== "string" ||
          !row.imageDataUrl.startsWith("data:image/jpeg;base64,")
        ) {
          return null;
        }

        return {
          mediaType: "street_view",
          url: row.imageDataUrl,
          caption:
            typeof row.caption === "string" && row.caption.trim()
              ? row.caption.trim().slice(0, 200)
              : `Street View verification ${index + 1}`,
          displayOrder: index,
        };
      })
      .filter((entry): entry is SubmittedQuoteMedia => entry !== null);
  } catch {
    return [];
  }
}

async function replacePricingLineItems(params: {
  quoteId: string;
  pricingLineItems: SubmittedPricingLineItem[];
  measurementIdByClientId?: Map<string, string>;
}) {
  const admin = createAdminClient();
  await admin
    .from("address_quote_pricing_line_items")
    .delete()
    .eq("address_quote_id", params.quoteId);

  if (params.pricingLineItems.length === 0) return;

  const { error } = await admin.from("address_quote_pricing_line_items").insert(
    params.pricingLineItems.map((item) => ({
      address_quote_id: params.quoteId,
      measurement_id:
        item.measurementId ||
        (item.measurementClientId
          ? params.measurementIdByClientId?.get(item.measurementClientId) || null
          : null),
      item_label: item.itemLabel,
      description: item.description,
      unit: item.unit,
      quantity: item.quantity,
      amount: item.amount,
      calc_mode: item.calcMode,
      line_total: item.lineTotal,
      display_order: item.displayOrder,
      is_custom: item.isCustom,
    }))
  );

  if (error) {
    console.error("Address quote pricing line item save failed:", error);
  }
}

function parseMapSnapshotDataUrl(rawValue: string) {
  if (!rawValue.startsWith("data:image/jpeg;base64,")) return null;

  const base64 = rawValue.replace("data:image/jpeg;base64,", "");
  const buffer = Buffer.from(base64, "base64");
  if (buffer.length === 0 || buffer.length > 2_500_000) return null;

  return buffer;
}

function isAllowedMapSnapshotUrl(rawValue: string) {
  if (!rawValue) return false;

  try {
    const url = new URL(rawValue);
    return (
      url.protocol === "https:" &&
      url.hostname === "api.mapbox.com" &&
      url.pathname.startsWith(
        "/styles/v1/mapbox/satellite-streets-v12/static/"
      )
    );
  } catch {
    return false;
  }
}

async function uploadMapSnapshot(params: {
  quoteId: string;
  contractorId: string;
  snapshotValue: string;
}) {
  if (isAllowedMapSnapshotUrl(params.snapshotValue)) {
    return params.snapshotValue;
  }

  const buffer = parseMapSnapshotDataUrl(params.snapshotValue);
  if (!buffer) return null;

  const admin = createAdminClient();
  const path = `${params.contractorId}/${params.quoteId}/map-snapshot.jpg`;
  const { error } = await admin.storage
    .from("address-quote-snapshots")
    .upload(path, buffer, {
      contentType: "image/jpeg",
      upsert: true,
    });

  if (error) {
    console.error("Map snapshot upload failed:", error);
    return null;
  }

  const { data } = admin.storage
    .from("address-quote-snapshots")
    .getPublicUrl(path);

  return data.publicUrl;
}

async function uploadQuoteDataImage(params: {
  quoteId: string;
  contractorId: string;
  dataUrl: string;
  folder: string;
  index: number;
}) {
  const buffer = parseMapSnapshotDataUrl(params.dataUrl);
  if (!buffer) return null;

  const admin = createAdminClient();
  const path = `${params.contractorId}/${params.quoteId}/${params.folder}/${Date.now()}-${params.index}-${crypto.randomUUID()}.jpg`;
  const { error } = await admin.storage
    .from("address-quote-snapshots")
    .upload(path, buffer, {
      contentType: "image/jpeg",
      upsert: false,
    });

  if (error) {
    console.error("Quote evidence image upload failed:", error);
    return null;
  }

  const { data } = admin.storage
    .from("address-quote-snapshots")
    .getPublicUrl(path);

  return data.publicUrl;
}

function getImageExtension(file: File) {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/gif") return "gif";
  return "jpg";
}

function getQuoteEvidenceImages(formData: FormData) {
  return formData
    .getAll("quoteEvidenceImages")
    .filter((value): value is File => value instanceof File && value.size > 0)
    .filter((file) => file.type.startsWith("image/"))
    .slice(0, 10);
}

async function uploadQuoteEvidenceImage(params: {
  quoteId: string;
  contractorId: string;
  file: File;
  index: number;
}) {
  if (params.file.size > 8_000_000) return null;

  const admin = createAdminClient();
  const extension = getImageExtension(params.file);
  const path = `${params.contractorId}/${params.quoteId}/evidence/${Date.now()}-${params.index}-${crypto.randomUUID()}.${extension}`;
  const { error } = await admin.storage
    .from("address-quote-snapshots")
    .upload(path, params.file, {
      contentType: params.file.type || "image/jpeg",
      upsert: false,
    });

  if (error) {
    console.error("Address quote evidence image upload failed:", error);
    return null;
  }

  const { data } = admin.storage
    .from("address-quote-snapshots")
    .getPublicUrl(path);

  return data.publicUrl;
}

async function replaceQuoteMedia(params: {
  quoteId: string;
  contractorId: string;
  mapSnapshotValues: string[];
  streetViewMedia: SubmittedQuoteMedia[];
  existingMedia: SubmittedQuoteMedia[];
  evidenceImages: File[];
}) {
  const admin = createAdminClient();
  await admin.from("address_quote_media").delete().eq("address_quote_id", params.quoteId);

  const mediaRows: SubmittedQuoteMedia[] = [];

  for (const [index, snapshotValue] of params.mapSnapshotValues.entries()) {
    const url = await uploadMapSnapshot({
      quoteId: params.quoteId,
      contractorId: params.contractorId,
      snapshotValue,
    });
    if (!url) continue;
    mediaRows.push({
      mediaType: "map_snapshot",
      url,
      caption: `Map screenshot ${index + 1}`,
      displayOrder: mediaRows.length,
    });
  }

  for (const media of params.existingMedia) {
    if (media.mediaType === "map_snapshot") continue;
    mediaRows.push({
      ...media,
      displayOrder: mediaRows.length,
    });
  }

  for (const [index, streetView] of params.streetViewMedia.entries()) {
    const url = await uploadQuoteDataImage({
      quoteId: params.quoteId,
      contractorId: params.contractorId,
      dataUrl: streetView.url,
      folder: "street-view",
      index,
    });
    if (!url) continue;
    mediaRows.push({
      mediaType: "street_view",
      url,
      caption: streetView.caption || `Street View verification ${index + 1}`,
      displayOrder: mediaRows.length,
    });
  }

  for (const [index, file] of params.evidenceImages.entries()) {
    const url = await uploadQuoteEvidenceImage({
      quoteId: params.quoteId,
      contractorId: params.contractorId,
      file,
      index,
    });
    if (!url) continue;
    mediaRows.push({
      mediaType: "uploaded_photo",
      url,
      caption: file.name || `Reference photo ${index + 1}`,
      displayOrder: mediaRows.length,
    });
  }

  if (mediaRows.length === 0) return null;

  const { error } = await admin.from("address_quote_media").insert(
    mediaRows.map((media) => ({
      address_quote_id: params.quoteId,
      contractor_id: params.contractorId,
      media_type: media.mediaType,
      url: media.url,
      caption: media.caption,
      display_order: media.displayOrder,
    }))
  );

  if (error) {
    console.error("Address quote media save failed:", error);
    return null;
  }

  return mediaRows.find((media) => media.mediaType === "map_snapshot")?.url || null;
}

async function ensurePropertyAddress(params: {
  displayAddress: string;
  street?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  source: "user_search" | "contractor_entry" | "customer_entry";
}): Promise<PropertyAddress | null> {
  const displayAddress = params.displayAddress.trim();
  const normalizedAddress = normalizeAddress(displayAddress);

  if (!displayAddress || normalizedAddress.length < 6) {
    return null;
  }

  const admin = createAdminClient();
  const addressHash = hashAddress(normalizedAddress);

  const { data: existing } = await admin
    .from("property_addresses")
    .select("*")
    .eq("address_hash", addressHash)
    .maybeSingle();

  if (existing) {
    const typedExisting = existing as PropertyAddress;
    if (
      typeof params.latitude === "number" &&
      typeof params.longitude === "number"
    ) {
      const { data: updated } = await admin
        .from("property_addresses")
        .update({
          latitude: params.latitude,
          longitude: params.longitude,
          confidence: "geocoded",
        })
        .eq("id", typedExisting.id)
        .select("*")
        .single();

      return (updated as PropertyAddress | null) || typedExisting;
    }

    if (typedExisting.latitude !== null && typedExisting.longitude !== null) {
      return typedExisting;
    }

    const geocoded = await geocodePropertyAddress(displayAddress);
    if (!geocoded) return typedExisting;

    const { data: updated } = await admin
      .from("property_addresses")
      .update({
        latitude: geocoded.latitude,
        longitude: geocoded.longitude,
        confidence: "geocoded",
      })
      .eq("id", typedExisting.id)
      .select("*")
      .single();

    return (updated as PropertyAddress | null) || typedExisting;
  }

  const geocoded =
    typeof params.latitude === "number" && typeof params.longitude === "number"
      ? { latitude: params.latitude, longitude: params.longitude }
      : await geocodePropertyAddress(displayAddress);

  const { data: inserted, error } = await admin
    .from("property_addresses")
    .insert({
      display_address: displayAddress,
      normalized_address: normalizedAddress,
      address_hash: addressHash,
      street: params.street || null,
      city: params.city || null,
      state: params.state || null,
      zip: params.zip || null,
      latitude: geocoded?.latitude || null,
      longitude: geocoded?.longitude || null,
      source: params.source,
      confidence: geocoded ? "geocoded" : "unverified",
    })
    .select("*")
    .single();

  if (error) {
    console.error("Address insert failed:", error);
    return null;
  }

  return inserted as PropertyAddress;
}

async function findNearbyPublishedQuoteAddress(address: PropertyAddress) {
  if (address.latitude === null || address.longitude === null) return null;

  const admin = createAdminClient();
  const { data: publishedQuotes } = await admin
    .from("address_quotes")
    .select("property_address_id")
    .eq("status", "published")
    .is("removed_at", null);
  const publishedAddressIds = Array.from(
    new Set(
      ((publishedQuotes || []) as Array<{ property_address_id: string }>).map(
        (quote) => quote.property_address_id
      )
    )
  ).filter((addressId) => addressId !== address.id);

  if (publishedAddressIds.length === 0) return null;

  const { data: nearbyCandidates } = await admin
    .from("property_addresses")
    .select("id, latitude, longitude")
    .in("id", publishedAddressIds)
    .not("latitude", "is", null)
    .not("longitude", "is", null);

  const searchPoint = {
    latitude: Number(address.latitude),
    longitude: Number(address.longitude),
  };
  if (!Number.isFinite(searchPoint.latitude) || !Number.isFinite(searchPoint.longitude)) {
    return null;
  }

  return ((nearbyCandidates || []) as Array<{
    id: string;
    latitude: number | null;
    longitude: number | null;
  }>)
    .map((candidate) => {
      const candidatePoint = {
        latitude: Number(candidate.latitude),
        longitude: Number(candidate.longitude),
      };
      if (
        !Number.isFinite(candidatePoint.latitude) ||
        !Number.isFinite(candidatePoint.longitude)
      ) {
        return null;
      }

      return {
        id: candidate.id,
        distanceMeters: getDistanceMeters(searchPoint, candidatePoint),
      };
    })
    .filter(
      (candidate): candidate is { id: string; distanceMeters: number } =>
        candidate !== null &&
        candidate.distanceMeters <= NEARBY_QUOTE_SEARCH_RADIUS_METERS
    )
    .sort((first, second) => first.distanceMeters - second.distanceMeters)[0];
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user || null;
}

async function hasVerifiedAddressClaim(userId: string, propertyAddressId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("property_address_claims")
    .select("id")
    .eq("user_id", userId)
    .eq("property_address_id", propertyAddressId)
    .eq("status", "verified")
    .maybeSingle();

  return Boolean(data);
}

async function hasCustomerAddressAccess(userId: string, propertyAddressId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("property_address_claims")
    .select("id")
    .eq("user_id", userId)
    .eq("property_address_id", propertyAddressId)
    .in("status", ["pending", "verified"])
    .maybeSingle();

  return Boolean(data);
}

export async function searchPublicAddressQuotes(formData: FormData) {
  const displayAddress = getString(formData, "displayAddress");
  const address = await ensurePropertyAddress({
    displayAddress,
    source: "user_search",
  });

  if (!address) {
    redirect("/address-quotes?error=address");
  }

  const admin = createAdminClient();
  const { count: exactQuoteCount } = await admin
    .from("address_quotes")
    .select("*", { count: "exact", head: true })
    .eq("property_address_id", address.id)
    .eq("status", "published")
    .is("removed_at", null);

  if ((exactQuoteCount || 0) === 0) {
    const nearbyAddress = await findNearbyPublishedQuoteAddress(address);
    if (nearbyAddress) {
      const query = new URLSearchParams({
        nearby: "1",
        searched: displayAddress,
        distance: String(Math.round(nearbyAddress.distanceMeters)),
      });
      redirect(`/address-quotes/${nearbyAddress.id}?${query}`);
    }
  }

  redirect(`/address-quotes/${address.id}`);
}

export async function claimPropertyAddress(
  formData: FormData
): Promise<void> {
  const user = await requireUser();
  if (!user) redirect("/login");

  const propertyAddressId = getString(formData, "propertyAddressId");
  const evidenceNotes = getOptionalString(formData, "evidenceNotes");

  if (!propertyAddressId) {
    redirect("/address-quotes?error=address");
  }

  const admin = createAdminClient();
  const isCustomer = await userHasRole(user.id, "customer");
  const { data: activeClaims } = await admin
    .from("property_address_claims")
    .select("id, property_address_id")
    .eq("user_id", user.id)
    .in("status", ["pending", "verified"]);
  const existingClaimForAddress = (activeClaims || []).find(
    (claim) => claim.property_address_id === propertyAddressId
  );
  const claimLimit = isCustomer
    ? MAX_CUSTOMER_ADDRESS_CLAIMS
    : MAX_ACTIVE_ADDRESS_CLAIMS;

  if ((activeClaims || []).length >= claimLimit && !existingClaimForAddress) {
    redirect(`/address-quotes/${propertyAddressId}?error=claim-limit`);
  }

  const now = new Date().toISOString();
  const { error } = await admin.from("property_address_claims").upsert(
    {
      property_address_id: propertyAddressId,
      user_id: user.id,
      status: isCustomer ? "verified" : "pending",
      verification_method: isCustomer ? "manual_admin" : "admin_review",
      evidence_notes: evidenceNotes,
      verified_at: isCustomer ? now : null,
    },
    { onConflict: "property_address_id,user_id" }
  );

  if (error) {
    console.error("Address claim failed:", error);
    redirect(`/address-quotes/${propertyAddressId}?error=claim`);
  }

  revalidatePath(`/address-quotes/${propertyAddressId}`);
  redirect(
    `/address-quotes/${propertyAddressId}?claim=${
      isCustomer ? "verified" : "pending"
    }`
  );
}

export async function requestQuotesForClaimedAddress(
  formData: FormData
): Promise<void> {
  const user = await requireUser();
  if (!user) redirect("/login");
  if (!(await userHasRole(user.id, "customer"))) redirect("/login");

  const propertyAddressId = getString(formData, "propertyAddressId");
  const services = getRequestedServices(formData);

  if (!propertyAddressId) redirect("/address-quotes?error=address");
  if (services.length === 0) {
    redirect(`/address-quotes/${propertyAddressId}?error=services`);
  }

  if (!(await hasCustomerAddressAccess(user.id, propertyAddressId))) {
    redirect(`/address-quotes/${propertyAddressId}?error=claim-required`);
  }

  const admin = createAdminClient();
  const { error } = await admin.from("address_quote_requests").insert({
    property_address_id: propertyAddressId,
    requester_user_id: user.id,
    requester_email: user.email || null,
    requested_services_json: services,
    notes: getOptionalString(formData, "notes"),
    status: "open",
  });

  if (error) {
    console.error("Address quote request failed:", error);
    redirect(`/address-quotes/${propertyAddressId}?error=request`);
  }

  revalidatePath(`/address-quotes/${propertyAddressId}`);
  redirect(`/address-quotes/${propertyAddressId}?request=created`);
}

export async function createCustomerAddressQuoteRequest(
  formData: FormData
): Promise<void> {
  const user = await requireUser();
  if (!user) redirect("/login");

  if (!(await userHasRole(user.id, "customer"))) {
    redirect("/login");
  }

  const propertyAddressId = getString(formData, "propertyAddressId");
  const services = getRequestedServices(formData);

  if (!propertyAddressId) {
    redirect("/customer/address-requests?error=address");
  }
  if (services.length === 0) {
    redirect("/customer/address-requests?error=services");
  }

  if (!(await hasCustomerAddressAccess(user.id, propertyAddressId))) {
    redirect("/customer/address-requests?error=claim-required");
  }

  const admin = createAdminClient();
  const { error } = await admin.from("address_quote_requests").insert({
    property_address_id: propertyAddressId,
    requester_user_id: user.id,
    requester_email: user.email || null,
    requested_services_json: services,
    notes: getOptionalString(formData, "notes"),
    status: "open",
  });

  if (error) {
    console.error("Customer address quote request failed:", error);
    redirect("/customer/address-requests?error=request");
  }

  revalidatePath("/customer/address-requests");
  revalidatePath(`/address-quotes/${propertyAddressId}`);
  redirect("/customer/address-requests?request=created");
}

export async function saveCustomerAddressForRequests(
  formData: FormData
): Promise<void> {
  const user = await requireUser();
  if (!user) redirect("/login");
  if (!(await userHasRole(user.id, "customer"))) redirect("/login");

  const displayAddress = getString(formData, "displayAddress");
  const street = getOptionalString(formData, "street");
  const city = getOptionalString(formData, "city");
  const state = getOptionalString(formData, "state");
  const zip = getOptionalString(formData, "zip");
  const mapLatitude = parseCoordinate(getString(formData, "mapLatitude"));
  const mapLongitude = parseCoordinate(getString(formData, "mapLongitude"));

  const address = await ensurePropertyAddress({
    displayAddress,
    street,
    city,
    state,
    zip,
    latitude: mapLatitude,
    longitude: mapLongitude,
    source: "customer_entry",
  });

  if (!address) {
    redirect("/customer/address-requests?error=address");
  }

  const admin = createAdminClient();
  const { data: activeClaims } = await admin
    .from("property_address_claims")
    .select("id, property_address_id")
    .eq("user_id", user.id)
    .in("status", ["pending", "verified"]);
  const existingClaimForAddress = (activeClaims || []).find(
    (claim) => claim.property_address_id === address.id
  );

  if (
    (activeClaims || []).length >= MAX_CUSTOMER_ADDRESS_CLAIMS &&
    !existingClaimForAddress
  ) {
    redirect("/customer/address-requests?error=address-limit");
  }

  const now = new Date().toISOString();
  const { error } = await admin.from("property_address_claims").upsert(
    {
      property_address_id: address.id,
      user_id: user.id,
      status: "verified",
      verification_method: "manual_admin",
      evidence_notes: "Customer saved this as their address request address.",
      verified_at: now,
    },
    { onConflict: "property_address_id,user_id" }
  );

  if (error) {
    console.error("Customer address save failed:", error);
    redirect("/customer/address-requests?error=address");
  }

  revalidatePath("/customer/address-requests");
  revalidatePath(`/address-quotes/${address.id}`);
  redirect("/customer/address-requests?address=saved");
}

export async function submitAddressQuoteRequestResponse(
  formData: FormData
): Promise<void> {
  const user = await requireUser();
  if (!user) redirect("/login");
  if (!(await userHasRole(user.id, "bidder"))) redirect("/login");

  const requestId = getString(formData, "requestId");
  const quoteTotalCents = parseDollarsToCents(getString(formData, "quoteTotalDollars"));
  const timeline = getString(formData, "timeline");
  const message = getOptionalString(formData, "message");

  if (!requestId) redirect("/bidder/address-requests?error=request");
  if (quoteTotalCents === null || quoteTotalCents <= 0) {
    redirect(`/bidder/address-requests/${requestId}?error=price`);
  }
  if (!timeline) {
    redirect(`/bidder/address-requests/${requestId}?error=timeline`);
  }

  const admin = createAdminClient();
  const { data: request } = await admin
    .from("address_quote_requests")
    .select("id, property_address_id, status")
    .eq("id", requestId)
    .eq("status", "open")
    .maybeSingle();

  if (!request) {
    redirect(`/bidder/address-requests/${requestId}?error=request`);
  }

  const { data: existingResponse } = await admin
    .from("address_quote_request_responses")
    .select("id")
    .eq("request_id", requestId)
    .eq("contractor_id", user.id)
    .eq("status", "submitted")
    .maybeSingle();

  if (existingResponse) {
    redirect(`/bidder/address-requests/${requestId}?error=duplicate`);
  }

  const { error } = await admin.from("address_quote_request_responses").insert({
    request_id: requestId,
    property_address_id: request.property_address_id,
    contractor_id: user.id,
    quote_total_cents: quoteTotalCents,
    timeline,
    message,
    status: "submitted",
  });

  if (error) {
    console.error("Address quote request response failed:", error);
    redirect(`/bidder/address-requests/${requestId}?error=response`);
  }

  revalidatePath(`/bidder/address-requests/${requestId}`);
  revalidatePath("/bidder/address-requests");
  revalidatePath("/customer/address-requests");
  redirect(`/bidder/address-requests/${requestId}?response=submitted`);
}

export async function selectAddressQuoteRequestResponse(
  formData: FormData
): Promise<void> {
  const user = await requireUser();
  if (!user) redirect("/login");
  if (!(await userHasRole(user.id, "customer"))) redirect("/login");

  const requestId = getString(formData, "requestId");
  const responseId = getString(formData, "responseId");
  if (!requestId || !responseId) {
    redirect("/customer/address-requests?error=response");
  }

  const admin = createAdminClient();
  const { data: request } = await admin
    .from("address_quote_requests")
    .select("id, requester_user_id, status")
    .eq("id", requestId)
    .eq("requester_user_id", user.id)
    .maybeSingle();

  if (!request || request.status !== "open") {
    redirect("/customer/address-requests?error=request");
  }

  const { data: response } = await admin
    .from("address_quote_request_responses")
    .select("id")
    .eq("id", responseId)
    .eq("request_id", requestId)
    .eq("status", "submitted")
    .maybeSingle();

  if (!response) {
    redirect("/customer/address-requests?error=response");
  }

  const now = new Date().toISOString();
  const { error: responseError } = await admin
    .from("address_quote_request_responses")
    .update({ status: "selected", selected_at: now })
    .eq("id", responseId)
    .eq("request_id", requestId);

  if (responseError) {
    console.error("Address quote response selection failed:", responseError);
    redirect("/customer/address-requests?error=response");
  }

  await admin
    .from("address_quote_request_responses")
    .update({ status: "declined" })
    .eq("request_id", requestId)
    .eq("status", "submitted");

  const { error: requestError } = await admin
    .from("address_quote_requests")
    .update({
      status: "closed",
      selected_response_id: responseId,
    })
    .eq("id", requestId)
    .eq("requester_user_id", user.id);

  if (requestError) {
    console.error("Address quote request close failed:", requestError);
    redirect("/customer/address-requests?error=request");
  }

  revalidatePath("/customer/address-requests");
  revalidatePath("/bidder/address-requests");
  redirect("/customer/address-requests?response=selected");
}

export async function removeQuoteFromClaimedAddress(
  formData: FormData
): Promise<void> {
  const user = await requireUser();
  if (!user) redirect("/login");

  const propertyAddressId = getString(formData, "propertyAddressId");
  const addressQuoteId = getString(formData, "addressQuoteId");

  if (!propertyAddressId || !addressQuoteId) {
    redirect("/address-quotes?error=quote");
  }

  if (!(await hasVerifiedAddressClaim(user.id, propertyAddressId))) {
    redirect(`/address-quotes/${propertyAddressId}?error=claim-required`);
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { error: updateError } = await admin
    .from("address_quotes")
    .update({ status: "removed", removed_at: now })
    .eq("id", addressQuoteId)
    .eq("property_address_id", propertyAddressId);

  if (updateError) {
    console.error("Address quote removal failed:", updateError);
    redirect(`/address-quotes/${propertyAddressId}?error=remove`);
  }

  await admin.from("address_quote_removal_requests").insert({
    address_quote_id: addressQuoteId,
    property_address_id: propertyAddressId,
    requester_user_id: user.id,
    requester_email: user.email || null,
    reason: getOptionalString(formData, "reason"),
    status: "auto_hidden",
  });

  revalidatePath(`/address-quotes/${propertyAddressId}`);
  redirect(`/address-quotes/${propertyAddressId}?quote=removed`);
}

export async function createManualAddressQuote(
  formData: FormData
): Promise<void> {
  const user = await requireUser();
  if (!user) redirect("/login");
  if (!(await userHasRole(user.id, "bidder"))) {
    redirect("/login");
  }

  const displayAddress = getString(formData, "displayAddress");
  const serviceVertical = getString(formData, "serviceVertical");
  const title = getString(formData, "title");
  const summary = getString(formData, "summary");
  const pricingLineItems = parsePricingLineItems(
    getString(formData, "pricingLineItemsJson")
  );
  const pricingLineItemsTotal = Math.round(
    pricingLineItems.reduce((total, item) => total + item.lineTotal, 0) * 100
  ) / 100;
  const quoteTotalCents =
    pricingLineItems.length > 0
      ? Math.round(pricingLineItemsTotal * 100)
      : parseDollarsToCents(getString(formData, "quoteTotal"));
  const mapMeasuredAreaSqft = parsePositiveNumber(
    getString(formData, "mapMeasuredAreaSqft")
  );
  const mapPickedLatitude = parseCoordinate(getString(formData, "mapPickedLatitude"));
  const mapPickedLongitude = parseCoordinate(
    getString(formData, "mapPickedLongitude")
  );
  const manualMeasuredAreaSqft = parsePositiveNumber(
    getString(formData, "measuredAreaSqft")
  );
  const submittedMeasurements = parseMeasurements(
    getString(formData, "measurementsJson")
  );
  const mapSnapshotValue =
    getString(formData, "mapSnapshotUrl") ||
    getString(formData, "mapSnapshotDataUrl");
  const mapSnapshotValues = Array.from(
    new Set([
      ...parseStringArray(getString(formData, "mapSnapshotUrlsJson")),
      ...(mapSnapshotValue ? [mapSnapshotValue] : []),
    ])
  );
  const streetViewMedia = parseStreetViewImages(
    getString(formData, "streetViewImagesJson")
  );
  const evidenceImages = getQuoteEvidenceImages(formData);
  const areaMeasurements = submittedMeasurements.filter(
    (measurement) => measurement.measurementType === "polygon_area"
  );
  const lineMeasurements = submittedMeasurements.filter(
    (measurement) => measurement.measurementType === "linear_length"
  );
  const savedAreaTotalSqft =
    areaMeasurements.length > 0
      ? Math.round(
          areaMeasurements.reduce(
            (total, measurement) => total + (measurement.areaSqft || 0),
            0
          ) * 100
        ) / 100
      : null;
  const savedLengthTotalFt =
    lineMeasurements.length > 0
      ? Math.round(
          lineMeasurements.reduce(
            (total, measurement) => total + (measurement.lengthFt || 0),
            0
          ) * 100
        ) / 100
      : null;
  const measuredAreaSqft =
    savedAreaTotalSqft ?? mapMeasuredAreaSqft ?? manualMeasuredAreaSqft;
  const measurementSource =
    submittedMeasurements.length > 0 || mapMeasuredAreaSqft ? "map_drawn" : "manual";

  if (!isAddressQuoteServiceVertical(serviceVertical)) {
    redirect("/bidder/address-quotes/new?error=service");
  }

  if (!title || !summary || quoteTotalCents === null) {
    redirect("/bidder/address-quotes/new?error=quote");
  }

  const address = await ensurePropertyAddress({
    displayAddress,
    street: getOptionalString(formData, "street"),
    city: getOptionalString(formData, "city"),
    state: getOptionalString(formData, "state"),
    zip: getOptionalString(formData, "zip"),
    latitude: mapPickedLatitude,
    longitude: mapPickedLongitude,
    source: "contractor_entry",
  });

  if (!address) {
    redirect("/bidder/address-quotes/new?error=address");
  }

  const shouldPublish = getString(formData, "intent") === "publish";
  const now = new Date().toISOString();
  const measurementSnapshot =
    measuredAreaSqft !== null || savedLengthTotalFt !== null
      ? {
          measuredAreaSqft,
          measuredLengthFt: savedLengthTotalFt,
          unit: "mixed",
          source: measurementSource,
          areas:
            areaMeasurements.length > 0
              ? areaMeasurements.map((measurement) => ({
                  label: measurement.label,
                  areaSqft: measurement.areaSqft,
                }))
              : undefined,
          lines:
            lineMeasurements.length > 0
              ? lineMeasurements.map((measurement) => ({
                  label: measurement.label,
                  lengthFt: measurement.lengthFt,
                }))
              : undefined,
        }
      : {};
  const pricingSnapshot = {
    quoteTotalCents,
    source: "contractor_manual",
    lineItemsTotal: pricingLineItemsTotal,
    serviceLabel:
      ADDRESS_QUOTE_SERVICE_LABELS[serviceVertical as AddressQuoteServiceVertical],
  };

  const admin = createAdminClient();
  const { data: quote, error } = await admin
    .from("address_quotes")
    .insert({
      property_address_id: address.id,
      contractor_id: user.id,
      service_vertical: serviceVertical as AddressQuoteServiceVertical,
      quote_source: "contractor_unsolicited",
      status: shouldPublish ? "published" : "draft",
      title,
      summary,
      scope_notes: getOptionalString(formData, "scopeNotes"),
      quote_total_cents: quoteTotalCents,
      currency: "usd",
      measurement_snapshot_json: measurementSnapshot,
      pricing_snapshot_json: pricingSnapshot,
      published_at: shouldPublish ? now : null,
    })
    .select("id")
    .single();

  if (error || !quote) {
    console.error("Manual address quote insert failed:", error);
    redirect("/bidder/address-quotes/new?error=save");
  }

  const mapSnapshotUrl = await replaceQuoteMedia({
    quoteId: quote.id,
    contractorId: user.id,
    mapSnapshotValues,
    streetViewMedia,
    existingMedia: [],
    evidenceImages,
  });

  if (mapSnapshotUrl) {
    await admin
      .from("address_quotes")
      .update({ map_snapshot_url: mapSnapshotUrl })
      .eq("id", quote.id);
  }

  const measurementIdByClientId = new Map<string, string>();
  if (submittedMeasurements.length > 0) {
    const { data: insertedMeasurements } = await admin
      .from("address_quote_measurements")
      .insert(
        submittedMeasurements.map((measurement) => ({
          address_quote_id: quote.id,
          measurement_type: measurement.measurementType,
          label: measurement.label,
          geometry_geojson: measurement.geometryGeojson,
          area_sqft: measurement.areaSqft || null,
          length_ft: measurement.lengthFt || null,
          source: "map_drawn",
          confidence: "contractor_confirmed",
        }))
      )
      .select("id");

    (insertedMeasurements || []).forEach((insertedMeasurement, index) => {
      const clientId = submittedMeasurements[index]?.clientId;
      if (clientId) measurementIdByClientId.set(clientId, insertedMeasurement.id);
    });
  } else if (measuredAreaSqft !== null) {
    await admin.from("address_quote_measurements").insert({
      address_quote_id: quote.id,
      measurement_type: "manual_area",
      label: mapMeasuredAreaSqft ? "Map measured area" : "Manual measured area",
      geometry_geojson: null,
      area_sqft: measuredAreaSqft,
      length_ft: null,
      source: measurementSource,
      confidence: "contractor_confirmed",
    });
  }

  await replacePricingLineItems({
    quoteId: quote.id,
    pricingLineItems,
    measurementIdByClientId,
  });

  revalidatePath("/bidder/address-quotes");
  revalidatePath(`/address-quotes/${address.id}`);
  redirect("/bidder/address-quotes");
}

export async function updateContractorAddressQuote(
  formData: FormData
): Promise<void> {
  const user = await requireUser();
  if (!user) redirect("/login");
  if (!(await userHasRole(user.id, "bidder"))) redirect("/login");

  const quoteId = getString(formData, "quoteId");
  const serviceVertical = getString(formData, "serviceVertical");
  const title = getString(formData, "title");
  const summary = getString(formData, "summary");
  const scopeNotes = getOptionalString(formData, "scopeNotes");
  const pricingLineItems = parsePricingLineItems(
    getString(formData, "pricingLineItemsJson")
  );
  const mapMeasuredAreaSqft = parsePositiveNumber(
    getString(formData, "mapMeasuredAreaSqft")
  );
  const mapPickedLatitude = parseCoordinate(getString(formData, "mapPickedLatitude"));
  const mapPickedLongitude = parseCoordinate(
    getString(formData, "mapPickedLongitude")
  );
  const submittedMeasurements = parseMeasurements(
    getString(formData, "measurementsJson")
  );
  const mapSnapshotValue =
    getString(formData, "mapSnapshotUrl") ||
    getString(formData, "mapSnapshotDataUrl");
  const mapSnapshotValues = Array.from(
    new Set([
      ...parseStringArray(getString(formData, "mapSnapshotUrlsJson")),
      ...(mapSnapshotValue ? [mapSnapshotValue] : []),
    ])
  );
  const existingMedia = parseExistingQuoteMedia(
    getString(formData, "existingQuoteMediaJson")
  );
  const streetViewMedia = parseStreetViewImages(
    getString(formData, "streetViewImagesJson")
  );
  const evidenceImages = getQuoteEvidenceImages(formData);
  const areaMeasurements = submittedMeasurements.filter(
    (measurement) => measurement.measurementType === "polygon_area"
  );
  const lineMeasurements = submittedMeasurements.filter(
    (measurement) => measurement.measurementType === "linear_length"
  );
  const savedAreaTotalSqft =
    areaMeasurements.length > 0
      ? Math.round(
          areaMeasurements.reduce(
            (total, measurement) => total + (measurement.areaSqft || 0),
            0
          ) * 100
        ) / 100
      : null;
  const savedLengthTotalFt =
    lineMeasurements.length > 0
      ? Math.round(
          lineMeasurements.reduce(
            (total, measurement) => total + (measurement.lengthFt || 0),
            0
          ) * 100
        ) / 100
      : null;
  const measuredAreaSqft = savedAreaTotalSqft ?? mapMeasuredAreaSqft;
  const measurementSource =
    submittedMeasurements.length > 0 || mapMeasuredAreaSqft ? "map_drawn" : "manual";
  const pricingLineItemsTotal = Math.round(
    pricingLineItems.reduce((total, item) => total + item.lineTotal, 0) * 100
  ) / 100;
  const quoteTotalCents =
    pricingLineItems.length > 0
      ? Math.round(pricingLineItemsTotal * 100)
      : parseDollarsToCents(getString(formData, "quoteTotal"));
  const intent = getString(formData, "intent");

  if (!quoteId) redirect("/bidder/address-quotes?error=quote");
  if (!isAddressQuoteServiceVertical(serviceVertical)) {
    redirect(`/bidder/address-quotes/${quoteId}/edit?error=service`);
  }
  if (!title || !summary || quoteTotalCents === null) {
    redirect(`/bidder/address-quotes/${quoteId}/edit?error=quote`);
  }

  const admin = createAdminClient();
  const { data: existingQuote } = await admin
    .from("address_quotes")
    .select("id, property_address_id, contractor_id, status, map_snapshot_url")
    .eq("id", quoteId)
    .eq("contractor_id", user.id)
    .is("removed_at", null)
    .maybeSingle();

  if (!existingQuote) {
    redirect("/bidder/address-quotes?error=not-found");
  }

  if (mapPickedLatitude !== null && mapPickedLongitude !== null) {
    await admin
      .from("property_addresses")
      .update({
        latitude: mapPickedLatitude,
        longitude: mapPickedLongitude,
        confidence: "geocoded",
      })
      .eq("id", existingQuote.property_address_id);
  }

  const shouldPublish = intent === "publish";
  const publishedAt =
    shouldPublish && existingQuote.status !== "published"
      ? new Date().toISOString()
      : shouldPublish
        ? undefined
        : null;
  const mapSnapshotUrl = await replaceQuoteMedia({
    quoteId,
    contractorId: user.id,
    mapSnapshotValues,
    streetViewMedia,
    existingMedia,
    evidenceImages,
  });
  const measurementSnapshot =
    measuredAreaSqft !== null || savedLengthTotalFt !== null
      ? {
          measuredAreaSqft,
          measuredLengthFt: savedLengthTotalFt,
          unit: "mixed",
          source: measurementSource,
          areas:
            areaMeasurements.length > 0
              ? areaMeasurements.map((measurement) => ({
                  label: measurement.label,
                  areaSqft: measurement.areaSqft,
                }))
              : undefined,
          lines:
            lineMeasurements.length > 0
              ? lineMeasurements.map((measurement) => ({
                  label: measurement.label,
                  lengthFt: measurement.lengthFt,
                }))
              : undefined,
        }
      : {};

  const updatePayload: Record<string, unknown> = {
    service_vertical: serviceVertical as AddressQuoteServiceVertical,
    status: shouldPublish ? "published" : "draft",
    title,
    summary,
    scope_notes: scopeNotes,
    quote_total_cents: quoteTotalCents,
    map_snapshot_url: mapSnapshotValues.length > 0
      ? mapSnapshotUrl || existingQuote.map_snapshot_url || null
      : null,
    measurement_snapshot_json: measurementSnapshot,
    pricing_snapshot_json: {
      quoteTotalCents,
      source: "contractor_manual",
      lineItemsTotal: pricingLineItemsTotal,
      serviceLabel:
        ADDRESS_QUOTE_SERVICE_LABELS[serviceVertical as AddressQuoteServiceVertical],
    },
  };

  if (publishedAt !== undefined) {
    updatePayload.published_at = publishedAt;
  }

  const { error } = await admin
    .from("address_quotes")
    .update(updatePayload)
    .eq("id", quoteId)
    .eq("contractor_id", user.id);

  if (error) {
    console.error("Contractor address quote update failed:", error);
    redirect(`/bidder/address-quotes/${quoteId}/edit?error=save`);
  }

  const measurementIdByClientId = new Map<string, string>();
  await admin
    .from("address_quote_measurements")
    .delete()
    .eq("address_quote_id", quoteId);

  if (submittedMeasurements.length > 0) {
    const { data: insertedMeasurements } = await admin
      .from("address_quote_measurements")
      .insert(
        submittedMeasurements.map((measurement) => ({
          address_quote_id: quoteId,
          measurement_type: measurement.measurementType,
          label: measurement.label,
          geometry_geojson: measurement.geometryGeojson,
          area_sqft: measurement.areaSqft || null,
          length_ft: measurement.lengthFt || null,
          source: "map_drawn",
          confidence: "contractor_confirmed",
        }))
      )
      .select("id");

    (insertedMeasurements || []).forEach((insertedMeasurement, index) => {
      const clientId = submittedMeasurements[index]?.clientId;
      if (clientId) measurementIdByClientId.set(clientId, insertedMeasurement.id);
    });
  } else if (measuredAreaSqft !== null) {
    await admin.from("address_quote_measurements").insert({
      address_quote_id: quoteId,
      measurement_type: "manual_area",
      label: "Map measured area",
      geometry_geojson: null,
      area_sqft: measuredAreaSqft,
      length_ft: null,
      source: measurementSource,
      confidence: "contractor_confirmed",
    });
  }

  await replacePricingLineItems({
    quoteId,
    pricingLineItems,
    measurementIdByClientId,
  });

  revalidatePath("/bidder/address-quotes");
  revalidatePath(`/address-quotes/${existingQuote.property_address_id}`);
  redirect("/bidder/address-quotes?quote=updated");
}

export async function deleteContractorAddressQuote(
  formData: FormData
): Promise<void> {
  const user = await requireUser();
  if (!user) redirect("/login");
  if (!(await userHasRole(user.id, "bidder"))) redirect("/login");

  const quoteId = getString(formData, "quoteId");
  if (!quoteId) redirect("/bidder/address-quotes?error=quote");

  const admin = createAdminClient();
  const { data: existingQuote } = await admin
    .from("address_quotes")
    .select("id, property_address_id")
    .eq("id", quoteId)
    .eq("contractor_id", user.id)
    .is("removed_at", null)
    .maybeSingle();

  if (!existingQuote) {
    redirect("/bidder/address-quotes?error=not-found");
  }

  const { error } = await admin
    .from("address_quotes")
    .update({
      status: "removed",
      removed_at: new Date().toISOString(),
    })
    .eq("id", quoteId)
    .eq("contractor_id", user.id);

  if (error) {
    console.error("Contractor address quote delete failed:", error);
    redirect("/bidder/address-quotes?error=delete");
  }

  revalidatePath("/bidder/address-quotes");
  revalidatePath(`/address-quotes/${existingQuote.property_address_id}`);
  redirect("/bidder/address-quotes?quote=deleted");
}

export async function verifyPropertyAddressClaim(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (!user) redirect("/login");
  if (!(await userHasRole(user.id, "admin"))) redirect("/login");

  const claimId = getString(formData, "claimId");
  const propertyAddressId = getString(formData, "propertyAddressId");
  if (!claimId) redirect("/admin/address-quotes?error=claim");

  const admin = createAdminClient();
  const { error } = await admin
    .from("property_address_claims")
    .update({
      status: "verified",
      verification_method: "manual_admin",
      verified_at: new Date().toISOString(),
    })
    .eq("id", claimId);

  if (error) {
    console.error("Address claim verification failed:", error);
    redirect("/admin/address-quotes?error=verify-claim");
  }

  revalidatePath("/admin/address-quotes");
  if (propertyAddressId) revalidatePath(`/address-quotes/${propertyAddressId}`);
  redirect("/admin/address-quotes?claim=verified");
}

export async function rejectPropertyAddressClaim(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (!user) redirect("/login");
  if (!(await userHasRole(user.id, "admin"))) redirect("/login");

  const claimId = getString(formData, "claimId");
  const propertyAddressId = getString(formData, "propertyAddressId");
  if (!claimId) redirect("/admin/address-quotes?error=claim");

  const admin = createAdminClient();
  const { error } = await admin
    .from("property_address_claims")
    .update({ status: "rejected" })
    .eq("id", claimId);

  if (error) {
    console.error("Address claim rejection failed:", error);
    redirect("/admin/address-quotes?error=reject-claim");
  }

  revalidatePath("/admin/address-quotes");
  if (propertyAddressId) revalidatePath(`/address-quotes/${propertyAddressId}`);
  redirect("/admin/address-quotes?claim=rejected");
}
