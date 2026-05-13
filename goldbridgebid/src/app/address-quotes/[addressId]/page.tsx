import Link from "next/link";
import { notFound } from "next/navigation";
import {
  BadgeDollarSign,
  CheckCircle2,
  ClipboardList,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { userHasRole } from "@/lib/auth/roles";
import {
  claimPropertyAddress,
  removeQuoteFromClaimedAddress,
  requestQuotesForClaimedAddress,
} from "@/lib/address-quotes/actions";
import {
  ADDRESS_QUOTE_SERVICE_LABELS,
  ADDRESS_QUOTE_REQUEST_SERVICE_LABELS,
  ADDRESS_QUOTE_REQUEST_SERVICE_VERTICALS,
  formatAddressQuoteRequestServices,
} from "@/lib/address-quotes/service-verticals";
import { BrowserBackButton } from "@/components/BrowserBackButton";
import AddressWithMapPreview from "@/components/address-quotes/AddressWithMapPreview";
import type {
  AddressQuote,
  AddressQuoteMedia,
  AddressQuoteMeasurement,
  AddressQuotePricingLineItem,
  AddressQuoteRequest,
  Profile,
  PropertyAddress,
  PropertyAddressClaim,
} from "@/types/database";

function formatMoney(cents: number | null) {
  if (cents === null) return "Quote pending";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function formatServices(services: unknown) {
  return formatAddressQuoteRequestServices(services);
}

function formatContractorAddress(contractor: Profile | undefined) {
  if (!contractor) return null;
  const cityStateZip = [contractor.city, contractor.state, contractor.zip]
    .filter(Boolean)
    .join(", ");

  return [contractor.address, cityStateZip].filter(Boolean).join(", ") || null;
}

export default async function AddressQuoteDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ addressId: string }>;
  searchParams: Promise<{
    error?: string;
    claim?: string;
    request?: string;
    quote?: string;
    nearby?: string;
    searched?: string;
    distance?: string;
  }>;
}) {
  const { addressId } = await params;
  const query = await searchParams;
  const supabase = await createClient();
  const admin = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: address }, { data: quotes }] = await Promise.all([
    admin
      .from("property_addresses")
      .select("*")
      .eq("id", addressId)
      .maybeSingle(),
    admin
      .from("address_quotes")
      .select("*")
      .eq("property_address_id", addressId)
      .eq("status", "published")
      .is("removed_at", null)
      .order("published_at", { ascending: false }),
  ]);

  if (!address) notFound();

  const contractorIds = Array.from(
    new Set((quotes || []).map((quote) => quote.contractor_id))
  );
  const quoteIds = (quotes || []).map((quote) => quote.id);
  const [
    { data: contractorProfiles },
    { data: measurementRows },
    { data: pricingLineRows },
    { data: quoteMediaRows },
  ] = await Promise.all([
    contractorIds.length
      ? admin.from("profiles").select("*").in("user_id", contractorIds)
      : Promise.resolve({ data: [] }),
    quoteIds.length
      ? admin
          .from("address_quote_measurements")
          .select("*")
          .in("address_quote_id", quoteIds)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [] }),
    quoteIds.length
      ? admin
          .from("address_quote_pricing_line_items")
          .select("*")
          .in("address_quote_id", quoteIds)
          .order("display_order", { ascending: true })
      : Promise.resolve({ data: [] }),
    quoteIds.length
      ? admin
          .from("address_quote_media")
          .select("*")
          .in("address_quote_id", quoteIds)
          .order("display_order", { ascending: true })
      : Promise.resolve({ data: [] }),
  ]);
  const contractorMap = new Map(
    ((contractorProfiles || []) as Profile[]).map((profile) => [
      profile.user_id,
      profile,
    ])
  );
  const measurementsByQuote = new Map<string, AddressQuoteMeasurement[]>();
  for (const measurement of (measurementRows || []) as AddressQuoteMeasurement[]) {
    const rows = measurementsByQuote.get(measurement.address_quote_id) || [];
    rows.push(measurement);
    measurementsByQuote.set(measurement.address_quote_id, rows);
  }
  const pricingLinesByQuote = new Map<string, AddressQuotePricingLineItem[]>();
  for (const pricingLine of (pricingLineRows || []) as AddressQuotePricingLineItem[]) {
    const rows = pricingLinesByQuote.get(pricingLine.address_quote_id) || [];
    rows.push(pricingLine);
    pricingLinesByQuote.set(pricingLine.address_quote_id, rows);
  }
  const mediaByQuote = new Map<string, AddressQuoteMedia[]>();
  for (const media of (quoteMediaRows || []) as AddressQuoteMedia[]) {
    const rows = mediaByQuote.get(media.address_quote_id) || [];
    rows.push(media);
    mediaByQuote.set(media.address_quote_id, rows);
  }

  const [
    { data: userClaims },
    { data: addressClaimRows },
    isCustomerUser,
    { count: activeClaimCount },
  ] = await Promise.all([
    user
      ? admin
          .from("property_address_claims")
          .select("*")
          .eq("property_address_id", addressId)
          .eq("user_id", user.id)
      : Promise.resolve({ data: [] }),
    admin
      .from("property_address_claims")
      .select("user_id")
      .eq("property_address_id", addressId)
      .eq("status", "verified")
      .limit(10),
    user ? userHasRole(user.id, "customer") : Promise.resolve(false),
    user
      ? admin
          .from("property_address_claims")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .in("status", ["pending", "verified"])
      : Promise.resolve({ count: 0 }),
  ]);

  const currentClaim = ((userClaims || []) as PropertyAddressClaim[])[0] || null;
  const addressClaimUserIds = Array.from(
    new Set((addressClaimRows || []).map((claim) => claim.user_id))
  );

  const [{ data: addressClaimProfileRows }, { data: quoteRequests }] =
    await Promise.all([
      addressClaimUserIds.length
        ? admin
            .from("profiles")
            .select("*")
            .in("user_id", addressClaimUserIds)
        : Promise.resolve({ data: [] }),
      (() => {
        const isVerifiedClaimant = currentClaim?.status === "verified";
        const hasAccess =
          isVerifiedClaimant ||
          (isCustomerUser &&
            (currentClaim?.status === "pending" ||
              currentClaim?.status === "verified"));
        return hasAccess
          ? admin
              .from("address_quote_requests")
              .select("*")
              .eq("property_address_id", addressId)
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [] });
      })(),
    ]);

  const addressMapImageUrl =
    ((addressClaimProfileRows || []) as Profile[]).find(
      (profile) => profile.exact_address_map_image_url
    )?.exact_address_map_image_url || null;
  const isVerifiedClaimant = currentClaim?.status === "verified";
  const hasCustomerAddressAccess =
    isVerifiedClaimant ||
    (isCustomerUser &&
      (currentClaim?.status === "pending" || currentClaim?.status === "verified"));

  const claimLimit = isCustomerUser ? 1 : 3;
  const canClaim =
    Boolean(user) &&
    !hasCustomerAddressAccess &&
    (Boolean(currentClaim) || (activeClaimCount || 0) < claimLimit);
  const feedback =
    query.claim === "pending"
      ? {
          tone: "success",
          message: "Address claim submitted. Admin verification is required before controls unlock.",
        }
      : query.claim === "verified"
        ? {
            tone: "success",
            message: "Address saved. You can request quick quotes now.",
          }
      : query.request === "created"
        ? {
            tone: "success",
            message: "Quote request created for this address.",
          }
        : query.quote === "removed"
          ? {
              tone: "success",
              message: "Quote removed from the public address page.",
            }
          : query.error
            ? {
                tone: "error",
                message:
                  query.error === "claim-limit"
                    ? isCustomerUser
                      ? "Customers can use one address for quick quote requests."
                      : "You can claim at most 3 active addresses."
                    : query.error === "claim-required"
                      ? "Save this address before requesting quick quotes."
                      : query.error === "services"
                        ? "Choose at least one quote category."
                        : "That action could not be completed. Please try again.",
              }
            : null;

  return (
    <main className="min-h-screen bg-bg-warm">
      <section className="border-b border-border bg-surface px-6 py-8">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/address-quotes"
              className="text-sm font-medium text-primary transition-colors hover:text-primary-dark"
            >
              ← Search another address
            </Link>
            <BrowserBackButton />
          </div>
          <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-text-muted">
                <MapPin className="h-4 w-4" />
                Public address quote page
              </div>
              {query.nearby === "1" && (
                <div className="mt-4 rounded-xl border-2 border-primary bg-primary/10 px-4 py-3 text-sm font-semibold text-text-primary">
                  We believe this might be the address you were looking for.
                  Check the address, map, and property photos before treating it
                  as your property.
                </div>
              )}
              <AddressWithMapPreview
                address={(address as PropertyAddress).display_address}
                mapImageUrl={addressMapImageUrl}
                className="mt-3"
                addressClassName="text-3xl font-bold text-text-primary"
                imageClassName="h-20 w-32 sm:h-24 sm:w-40"
              />
              <p className="mt-2 max-w-3xl text-text-secondary">
                Anyone can view published quotes for this address. Customers can
                save one address to request quick quotes from contractors.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-bg-warm px-4 py-3 text-sm text-text-secondary">
              <p className="font-semibold text-text-primary">
                {(quotes || []).length} public quote
                {(quotes || []).length === 1 ? "" : "s"}
              </p>
              <p>
                Claim status:{" "}
                <span className="font-semibold capitalize">
                  {currentClaim?.status || "not claimed by you"}
                </span>
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-6 py-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          {feedback && (
            <div
              className={`rounded-xl border px-4 py-3 text-sm ${
                feedback.tone === "success"
                  ? "border-green-200 bg-green-50 text-green-800"
                  : "border-red-200 bg-red-50 text-red-700"
              }`}
            >
              {feedback.message}
            </div>
          )}

          {(quotes || []).length === 0 ? (
            <div className="rounded-xl border border-border bg-surface px-6 py-12 text-center shadow-sm">
              <ClipboardList className="mx-auto mb-4 h-10 w-10 text-text-muted" />
              <h2 className="text-lg font-semibold text-text-primary">
                No public quotes for this address yet
              </h2>
              <p className="mx-auto mt-2 max-w-xl text-sm text-text-secondary">
                Contractors can still leave free quotes here, and customers can
                save one address to request quote categories.
              </p>
            </div>
          ) : (
            ((quotes || []) as AddressQuote[]).map((quote) => {
              const contractor = contractorMap.get(quote.contractor_id);
              const quoteMeasurements = measurementsByQuote.get(quote.id) || [];
              const quotePricingLines = pricingLinesByQuote.get(quote.id) || [];
              const quoteMedia = mediaByQuote.get(quote.id) || [];
              const evidenceMedia =
                quoteMedia.length > 0
                  ? quoteMedia
                  : quote.map_snapshot_url
                    ? ([
                        {
                          id: `${quote.id}_legacy_map_snapshot`,
                          address_quote_id: quote.id,
                          contractor_id: quote.contractor_id,
                          media_type: "map_snapshot",
                          url: quote.map_snapshot_url,
                          caption: "Measurement map screenshot",
                          display_order: 0,
                          created_at: quote.created_at,
                        },
                      ] satisfies AddressQuoteMedia[])
                    : [];
              const contractorDisplayName =
                contractor?.business_name ||
                contractor?.full_name ||
                "Contractor profile";
              const contractorAddress = formatContractorAddress(contractor);

              return (
                <article
                  key={quote.id}
                  className="rounded-xl border border-border bg-surface p-6 shadow-sm"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-secondary/10 px-3 py-1 text-xs font-semibold text-secondary">
                          {ADDRESS_QUOTE_SERVICE_LABELS[quote.service_vertical]}
                        </span>
                        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                          Public quote
                        </span>
                      </div>
                      <h2 className="mt-3 text-xl font-bold text-text-primary">
                        {quote.title}
                      </h2>
                      <p className="mt-2 text-sm leading-6 text-text-secondary">
                        {quote.summary}
                      </p>
                    </div>
                    <div className="rounded-xl bg-bg-warm px-4 py-3 text-right">
                      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                        Quote
                      </p>
                      <p className="text-2xl font-bold text-text-primary">
                        {formatMoney(quote.quote_total_cents)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 border-t border-border pt-4">
                    <div className="rounded-xl border border-border bg-bg-warm p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                        Quote provided by
                      </p>
                      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex min-w-0 flex-1 flex-col gap-4 sm:flex-row">
                          {contractor?.company_logo_url ? (
                            <img
                              src={contractor.company_logo_url}
                              alt={`${contractorDisplayName} company logo`}
                              className="h-20 w-20 shrink-0 rounded-xl border border-border bg-white object-cover"
                            />
                          ) : (
                            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-2xl font-bold text-secondary">
                              {contractorDisplayName.slice(0, 1).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <h3 className="text-lg font-bold text-text-primary">
                              {contractorDisplayName}
                            </h3>
                            {contractor?.business_name && contractor.full_name && (
                              <p className="mt-0.5 text-sm font-medium text-text-secondary">
                                Contact: {contractor.full_name}
                              </p>
                            )}
                            <div className="mt-3 space-y-2 text-sm text-text-secondary">
                              {contractor?.phone && (
                                <a
                                  href={`tel:${contractor.phone}`}
                                  className="flex items-center gap-2 font-medium text-text-primary hover:text-primary"
                                >
                                  <Phone className="h-4 w-4 text-secondary" />
                                  {contractor.phone}
                                </a>
                              )}
                              {contractor?.email && (
                                <a
                                  href={`mailto:${contractor.email}`}
                                  className="flex items-center gap-2 font-medium text-text-primary hover:text-primary"
                                >
                                  <Mail className="h-4 w-4 text-secondary" />
                                  {contractor.email}
                                </a>
                              )}
                              {contractorAddress && (
                                <p className="flex items-start gap-2">
                                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
                                  <span>{contractorAddress}</span>
                                </p>
                              )}
                            </div>
                            {contractor?.bio && (
                              <p className="mt-3 rounded-lg bg-surface px-3 py-2 text-xs leading-5 text-text-secondary">
                                {contractor.bio}
                              </p>
                            )}
                          </div>
                        </div>
                        {contractor?.avatar_url && (
                          <img
                            src={contractor.avatar_url}
                            alt={`${contractor.full_name || contractorDisplayName} profile photo`}
                            className="h-24 w-24 shrink-0 rounded-full border-4 border-white object-cover shadow-md sm:ml-4"
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  {evidenceMedia.length > 0 && (
                    <div className="mt-5 border-t border-border pt-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                        Quote evidence images
                      </p>
                      <div className="mt-2 grid gap-3 sm:grid-cols-2">
                        {evidenceMedia.map((media, index) => (
                          <figure
                            key={media.id}
                            className="overflow-hidden rounded-xl border border-border bg-bg-warm"
                          >
                            <img
                              src={media.url}
                              alt={
                                media.caption ||
                                `${media.media_type === "map_snapshot" ? "Map screenshot" : "Reference photo"} for ${quote.title}`
                              }
                              className="aspect-video w-full object-cover"
                            />
                            <figcaption className="px-3 py-2 text-xs font-semibold text-text-secondary">
                              {media.caption ||
                                (media.media_type === "map_snapshot"
                                  ? `Map screenshot ${index + 1}`
                                  : `Reference photo ${index + 1}`)}
                            </figcaption>
                          </figure>
                        ))}
                      </div>
                    </div>
                  )}

                  {isVerifiedClaimant && (
                    <form action={removeQuoteFromClaimedAddress} className="mt-4">
                      <input type="hidden" name="propertyAddressId" value={addressId} />
                      <input type="hidden" name="addressQuoteId" value={quote.id} />
                      <input
                        type="hidden"
                        name="reason"
                        value="Address claimant removed this public quote."
                      />
                      <button
                        type="submit"
                        className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Remove this quote from my address
                      </button>
                    </form>
                  )}

                  {quoteMeasurements.length > 0 && (
                    <div className="mt-5 border-t border-border pt-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                        Measurement line items
                      </p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        {quoteMeasurements.map((measurement, index) => (
                          <div
                            key={measurement.id}
                            className="rounded-lg bg-bg-warm px-3 py-2 text-sm"
                          >
                            <p className="font-semibold text-text-primary">
                              {measurement.label || `Area ${index + 1}`}
                            </p>
                            <p className="text-text-secondary">
                              {measurement.measurement_type === "linear_length"
                                ? measurement.length_ft
                                  ? `${measurement.length_ft.toLocaleString()} linear ft`
                                  : "Length pending"
                                : measurement.area_sqft
                                  ? `${measurement.area_sqft.toLocaleString()} sq ft`
                                  : "Area pending"}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {quotePricingLines.length > 0 && (
                    <div className="mt-5 border-t border-border pt-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                          Priced bid sheet
                        </p>
                        <p className="text-sm font-bold text-text-primary">
                          {formatMoney(quote.quote_total_cents)}
                        </p>
                      </div>
                      <div className="mt-2 overflow-x-auto rounded-lg bg-bg-warm px-3 py-2">
                        <table className="w-full text-sm tabular-nums">
                          <thead>
                            <tr className="border-b border-border/70 text-left">
                              <th className="py-2 pr-3 font-semibold text-text-primary">
                                Item
                              </th>
                              <th className="px-2 py-2 text-center font-semibold text-text-primary">
                                Qty
                              </th>
                              <th className="px-2 py-2 text-right font-semibold text-text-primary">
                                Price
                              </th>
                              <th className="py-2 pl-2 text-right font-semibold text-text-primary">
                                Total
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {quotePricingLines.map((line) => (
                              <tr
                                key={line.id}
                                className="border-b border-border/40 last:border-0"
                              >
                                <td className="py-2 pr-3 align-top">
                                  <p className="font-medium text-text-primary">
                                    {line.item_label}
                                  </p>
                                  {line.is_custom && (
                                    <span className="mt-1 inline-flex rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">
                                      Custom
                                    </span>
                                  )}
                                </td>
                                <td className="px-2 py-2 text-center align-top text-text-secondary">
                                  {Number(line.quantity).toLocaleString()}{" "}
                                  {line.unit || ""}
                                </td>
                                <td className="px-2 py-2 text-right align-top text-text-secondary">
                                  {line.calc_mode === "add" ? "+" : "×"}{" "}
                                  {formatMoney(Math.round(Number(line.amount || 0) * 100))}
                                </td>
                                <td className="py-2 pl-2 text-right align-top font-semibold text-text-primary">
                                  {formatMoney(Math.round(Number(line.line_total || 0) * 100))}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </article>
              );
            })
          )}
        </div>

        <aside className="space-y-4">
          <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-secondary" />
              <h2 className="font-semibold text-text-primary">
                Save this address
              </h2>
            </div>
            <p className="mt-2 text-sm leading-6 text-text-secondary">
              Viewing quotes is public. Customers can save one address for
              quick quote requests.
            </p>

            {!user ? (
              <Link
                href="/login"
                className="mt-4 inline-flex w-full justify-center rounded-lg bg-secondary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-secondary-dark"
              >
                Log in to claim
              </Link>
            ) : isVerifiedClaimant ? (
              <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                <div className="flex items-center gap-2 font-semibold">
                  <CheckCircle2 className="h-4 w-4" />
                  Saved address
                </div>
                <p className="mt-1">
                  You can request quotes and remove quotes for this address.
                </p>
              </div>
            ) : hasCustomerAddressAccess ? (
              <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                <div className="flex items-center gap-2 font-semibold">
                  <CheckCircle2 className="h-4 w-4" />
                  Saved customer address
                </div>
                <p className="mt-1">
                  You can request quick quotes for this address.
                </p>
              </div>
            ) : currentClaim && !canClaim ? (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Your address claim is {currentClaim.status}. Admin approval is
                required before quote requests or removals are enabled.
              </div>
            ) : canClaim ? (
              <form action={claimPropertyAddress} className="mt-4 space-y-3">
                <input type="hidden" name="propertyAddressId" value={addressId} />
                <label className="block text-sm font-semibold text-text-primary">
                  Address note
                </label>
                <textarea
                  name="evidenceNotes"
                  rows={3}
                  placeholder="Example: This is my home address."
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <button
                  type="submit"
                  className="w-full rounded-lg bg-secondary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-secondary-dark"
                >
                  Save This Address
                </button>
                <p className="text-xs text-text-muted">
                  Customers can use one address for quick quote requests.
                </p>
              </form>
            ) : (
              <div className="mt-4 rounded-lg border border-border bg-bg-warm px-4 py-3 text-sm text-text-secondary">
                You already have an active customer address.
              </div>
            )}
          </section>

          {hasCustomerAddressAccess && (
            <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <BadgeDollarSign className="h-5 w-5 text-primary" />
                <h2 className="font-semibold text-text-primary">
                  Request quotes
                </h2>
              </div>
              <form action={requestQuotesForClaimedAddress} className="mt-4 space-y-3">
                <input type="hidden" name="propertyAddressId" value={addressId} />
                <div className="space-y-2">
                  {ADDRESS_QUOTE_REQUEST_SERVICE_VERTICALS.map((service) => (
                    <label
                      key={service}
                      className="flex items-center gap-2 rounded-lg border border-border bg-bg-warm px-3 py-2 text-sm text-text-primary"
                    >
                      <input
                        type="checkbox"
                        name="services"
                        value={service}
                        className="rounded border-border text-secondary"
                      />
                      {ADDRESS_QUOTE_REQUEST_SERVICE_LABELS[service]}
                    </label>
                  ))}
                </div>
                <textarea
                  name="notes"
                  rows={3}
                  placeholder="Optional notes for contractors."
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <button
                  type="submit"
                  className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-primary-dark hover:text-white"
                >
                  Request Quotes
                </button>
              </form>

              {((quoteRequests || []) as AddressQuoteRequest[]).length > 0 && (
                <div className="mt-5 border-t border-border pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                    Existing requests
                  </p>
                  <div className="mt-2 space-y-2">
                    {((quoteRequests || []) as AddressQuoteRequest[]).map((request) => (
                      <div
                        key={request.id}
                        className="rounded-lg bg-bg-warm px-3 py-2 text-sm text-text-secondary"
                      >
                        {formatServices(request.requested_services_json)}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}
        </aside>
      </section>
    </main>
  );
}
