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
  type AddressQuoteServiceVertical,
} from "@/lib/address-quotes/service-verticals";
import type { PropertyAddress } from "@/types/database";

const MAX_ACTIVE_ADDRESS_CLAIMS = 3;

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

function getRequestedServices(formData: FormData) {
  return formData
    .getAll("services")
    .filter((value): value is string => typeof value === "string")
    .filter(isAddressQuoteServiceVertical);
}

async function ensurePropertyAddress(params: {
  displayAddress: string;
  street?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
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
    return existing as PropertyAddress;
  }

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
      source: params.source,
      confidence: "unverified",
    })
    .select("*")
    .single();

  if (error) {
    console.error("Address insert failed:", error);
    return null;
  }

  return inserted as PropertyAddress;
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

export async function searchPublicAddressQuotes(formData: FormData) {
  const displayAddress = getString(formData, "displayAddress");
  const address = await ensurePropertyAddress({
    displayAddress,
    source: "user_search",
  });

  if (!address) {
    redirect("/address-quotes?error=address");
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
  const { count } = await admin
    .from("property_address_claims")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .in("status", ["pending", "verified"]);

  if ((count || 0) >= MAX_ACTIVE_ADDRESS_CLAIMS) {
    redirect(`/address-quotes/${propertyAddressId}?error=claim-limit`);
  }

  const { error } = await admin.from("property_address_claims").upsert(
    {
      property_address_id: propertyAddressId,
      user_id: user.id,
      status: "pending",
      verification_method: "admin_review",
      evidence_notes: evidenceNotes,
    },
    { onConflict: "property_address_id,user_id" }
  );

  if (error) {
    console.error("Address claim failed:", error);
    redirect(`/address-quotes/${propertyAddressId}?error=claim`);
  }

  revalidatePath(`/address-quotes/${propertyAddressId}`);
  redirect(`/address-quotes/${propertyAddressId}?claim=pending`);
}

export async function requestQuotesForClaimedAddress(
  formData: FormData
): Promise<void> {
  const user = await requireUser();
  if (!user) redirect("/login");

  const propertyAddressId = getString(formData, "propertyAddressId");
  const services = getRequestedServices(formData);

  if (!propertyAddressId) redirect("/address-quotes?error=address");
  if (services.length === 0) {
    redirect(`/address-quotes/${propertyAddressId}?error=services`);
  }

  if (!(await hasVerifiedAddressClaim(user.id, propertyAddressId))) {
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
  const quoteTotalCents = parseDollarsToCents(getString(formData, "quoteTotal"));
  const measuredAreaSqft = parsePositiveNumber(getString(formData, "measuredAreaSqft"));

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
    source: "contractor_entry",
  });

  if (!address) {
    redirect("/bidder/address-quotes/new?error=address");
  }

  const shouldPublish = getString(formData, "intent") === "publish";
  const now = new Date().toISOString();
  const measurementSnapshot =
    measuredAreaSqft !== null
      ? {
          measuredAreaSqft,
          unit: "sq_ft",
          source: "manual",
        }
      : {};
  const pricingSnapshot = {
    quoteTotalCents,
    source: "contractor_manual",
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

  if (measuredAreaSqft !== null) {
    await admin.from("address_quote_measurements").insert({
      address_quote_id: quote.id,
      measurement_type: "manual_area",
      label: "Manual measured area",
      area_sqft: measuredAreaSqft,
      source: "manual",
      confidence: "contractor_confirmed",
    });
  }

  revalidatePath("/bidder/address-quotes");
  revalidatePath(`/address-quotes/${address.id}`);
  redirect("/bidder/address-quotes");
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
