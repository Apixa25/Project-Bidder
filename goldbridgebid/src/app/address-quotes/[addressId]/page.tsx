import Link from "next/link";
import { notFound } from "next/navigation";
import {
  BadgeDollarSign,
  CheckCircle2,
  ClipboardList,
  MapPin,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  claimPropertyAddress,
  removeQuoteFromClaimedAddress,
  requestQuotesForClaimedAddress,
} from "@/lib/address-quotes/actions";
import {
  ADDRESS_QUOTE_SERVICE_LABELS,
  ADDRESS_QUOTE_SERVICE_VERTICALS,
  type AddressQuoteServiceVertical,
} from "@/lib/address-quotes/service-verticals";
import type {
  AddressQuote,
  AddressQuoteMeasurement,
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
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatServices(services: unknown) {
  if (!Array.isArray(services)) return "Requested services";
  return services
    .filter((service): service is AddressQuoteServiceVertical =>
      ADDRESS_QUOTE_SERVICE_VERTICALS.includes(service as AddressQuoteServiceVertical)
    )
    .map((service) => ADDRESS_QUOTE_SERVICE_LABELS[service])
    .join(", ");
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
  }>;
}) {
  const { addressId } = await params;
  const query = await searchParams;
  const supabase = await createClient();
  const admin = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: address } = await admin
    .from("property_addresses")
    .select("*")
    .eq("id", addressId)
    .maybeSingle();

  if (!address) notFound();

  const { data: quotes } = await admin
    .from("address_quotes")
    .select("*")
    .eq("property_address_id", addressId)
    .eq("status", "published")
    .is("removed_at", null)
    .order("published_at", { ascending: false });

  const contractorIds = Array.from(
    new Set((quotes || []).map((quote) => quote.contractor_id))
  );
  const quoteIds = (quotes || []).map((quote) => quote.id);
  const [{ data: contractorProfiles }, { data: measurementRows }] = await Promise.all([
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

  const { data: userClaims } = user
    ? await admin
        .from("property_address_claims")
        .select("*")
        .eq("property_address_id", addressId)
        .eq("user_id", user.id)
    : { data: [] };

  const currentClaim = ((userClaims || []) as PropertyAddressClaim[])[0] || null;
  const isVerifiedClaimant = currentClaim?.status === "verified";

  const { count: activeClaimCount } = user
    ? await admin
        .from("property_address_claims")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .in("status", ["pending", "verified"])
    : { count: 0 };

  const { data: quoteRequests } = isVerifiedClaimant
    ? await admin
        .from("address_quote_requests")
        .select("*")
        .eq("property_address_id", addressId)
        .order("created_at", { ascending: false })
    : { data: [] };

  const canClaim = Boolean(user) && !currentClaim && (activeClaimCount || 0) < 3;
  const feedback =
    query.claim === "pending"
      ? {
          tone: "success",
          message: "Address claim submitted. Admin verification is required before controls unlock.",
        }
      : query.request === "created"
        ? {
            tone: "success",
            message: "Quote request created for this verified address.",
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
                    ? "You can claim at most 3 active addresses."
                    : query.error === "claim-required"
                      ? "This action requires a verified address claim."
                      : query.error === "services"
                        ? "Choose at least one quote category."
                        : "That action could not be completed. Please try again.",
              }
            : null;

  return (
    <main className="min-h-screen bg-bg-warm">
      <section className="border-b border-border bg-surface px-6 py-8">
        <div className="mx-auto max-w-6xl">
          <Link
            href="/address-quotes"
            className="text-sm font-medium text-primary transition-colors hover:text-primary-dark"
          >
            ← Search another address
          </Link>
          <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-text-muted">
                <MapPin className="h-4 w-4" />
                Public address quote page
              </div>
              <h1 className="mt-2 text-3xl font-bold text-text-primary">
                {(address as PropertyAddress).display_address}
              </h1>
              <p className="mt-2 max-w-3xl text-text-secondary">
                Anyone can view published quotes for this address. Claiming the
                address is only needed to request new quotes or remove quotes.
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
                Contractors can still leave free quotes here, and verified
                address claimants can request quote categories.
              </p>
            </div>
          ) : (
            ((quotes || []) as AddressQuote[]).map((quote) => {
              const contractor = contractorMap.get(quote.contractor_id);
              const quoteMeasurements = measurementsByQuote.get(quote.id) || [];

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

                  <div className="mt-5 grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                        Contractor
                      </p>
                      <p className="mt-1 font-medium text-text-primary">
                        {contractor?.business_name ||
                          contractor?.full_name ||
                          "Contractor profile"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                        Measurement
                      </p>
                      <p className="mt-1 font-medium text-text-primary">
                        {typeof quote.measurement_snapshot_json?.measuredAreaSqft ===
                        "number"
                          ? `${quote.measurement_snapshot_json.source === "map_drawn" ? "Map-measured" : "Measured"}: ${quote.measurement_snapshot_json.measuredAreaSqft.toLocaleString()} sq ft`
                          : typeof quote.measurement_snapshot_json?.measuredLengthFt ===
                              "number"
                            ? `Map-measured: ${quote.measurement_snapshot_json.measuredLengthFt.toLocaleString()} linear ft`
                            : "Measurement details pending"}
                      </p>
                    </div>
                  </div>

                  {quote.map_snapshot_url && (
                    <div className="mt-5 border-t border-border pt-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                        Measurement map screenshot
                      </p>
                      <img
                        src={quote.map_snapshot_url}
                        alt={`Map screenshot for ${quote.title}`}
                        className="mt-2 w-full rounded-xl border border-border bg-bg-warm"
                      />
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
                Claim this address
              </h2>
            </div>
            <p className="mt-2 text-sm leading-6 text-text-secondary">
              Viewing quotes is public. Claiming is only for address control:
              requesting quote categories or removing unwanted quotes.
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
                  Verified address
                </div>
                <p className="mt-1">
                  You can request quotes and remove quotes for this address.
                </p>
              </div>
            ) : currentClaim ? (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Your address claim is {currentClaim.status}. Admin approval is
                required before quote requests or removals are enabled.
              </div>
            ) : canClaim ? (
              <form action={claimPropertyAddress} className="mt-4 space-y-3">
                <input type="hidden" name="propertyAddressId" value={addressId} />
                <label className="block text-sm font-semibold text-text-primary">
                  Claim note
                </label>
                <textarea
                  name="evidenceNotes"
                  rows={3}
                  placeholder="Example: This is my home address. I can verify if needed."
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <button
                  type="submit"
                  className="w-full rounded-lg bg-secondary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-secondary-dark"
                >
                  Submit Address Claim
                </button>
                <p className="text-xs text-text-muted">
                  You can have up to 3 active claimed addresses.
                </p>
              </form>
            ) : (
              <div className="mt-4 rounded-lg border border-border bg-bg-warm px-4 py-3 text-sm text-text-secondary">
                You already have 3 active address claims.
              </div>
            )}
          </section>

          {isVerifiedClaimant && (
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
                  {ADDRESS_QUOTE_SERVICE_VERTICALS.map((service) => (
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
                      {ADDRESS_QUOTE_SERVICE_LABELS[service]}
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
