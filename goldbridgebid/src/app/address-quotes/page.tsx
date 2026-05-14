import Link from "next/link";
import { headers } from "next/headers";
import { MapPin, Search, ShieldCheck } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { searchPublicAddressQuotes } from "@/lib/address-quotes/actions";
import { ADDRESS_QUOTE_SERVICE_LABELS } from "@/lib/address-quotes/service-verticals";
import AddressQuoteDiscoveryMap from "@/components/address-quotes/AddressQuoteDiscoveryMap";
import type { AddressQuote, PropertyAddress } from "@/types/database";

export default async function AddressQuotesSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  const headerStore = await headers();
  const vercelLat = headerStore.get("x-vercel-ip-latitude");
  const vercelLng = headerStore.get("x-vercel-ip-longitude");
  const userLocation =
    vercelLat && vercelLng
      ? { latitude: parseFloat(vercelLat), longitude: parseFloat(vercelLng) }
      : null;
  const admin = createAdminClient();
  const { data: publishedQuotes } = await admin
    .from("address_quotes")
    .select("id, property_address_id")
    .eq("status", "published")
    .is("removed_at", null);
  const addressIds = Array.from(
    new Set(((publishedQuotes || []) as AddressQuote[]).map((quote) => quote.property_address_id))
  );
  const { data: addressRows } = addressIds.length
    ? await admin
        .from("property_addresses")
        .select("id, display_address, latitude, longitude")
        .in("id", addressIds)
        .not("latitude", "is", null)
        .not("longitude", "is", null)
    : { data: [] };
  const quoteCountsByAddress = new Map<string, number>();
  for (const quote of (publishedQuotes || []) as AddressQuote[]) {
    quoteCountsByAddress.set(
      quote.property_address_id,
      (quoteCountsByAddress.get(quote.property_address_id) || 0) + 1
    );
  }
  const mapMarkers = ((addressRows || []) as PropertyAddress[]).map((address) => ({
    addressId: address.id,
    displayAddress: address.display_address,
    latitude: Number(address.latitude),
    longitude: Number(address.longitude),
    quoteCount: quoteCountsByAddress.get(address.id) || 0,
  }));

  return (
    <main className="min-h-screen bg-bg-warm">
      <section className="border-b border-border bg-gradient-to-br from-accent via-secondary-dark to-slate-950 px-4 py-6 text-white sm:px-6 sm:py-8">
        <div className="mx-auto max-w-4xl">
          <Link
            href="/"
            className="text-sm font-medium text-white/75 transition-colors hover:text-white"
          >
            ← Back to ProjectXBidX
          </Link>
          <div className="mt-4 flex items-center gap-3 sm:mt-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 sm:h-12 sm:w-12">
              <MapPin className="h-5 w-5 text-primary sm:h-6 sm:w-6" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary sm:text-sm">
              Public Address Quotes
            </p>
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight sm:mt-4 sm:max-w-3xl sm:text-4xl md:text-5xl">
            Did you receive a card saying you have an estimate? Look your address up here.
          </h1>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
        <AddressQuoteDiscoveryMap markers={mapMarkers} userLocation={userLocation} />

        <form
          action={searchPublicAddressQuotes}
          className="mt-8 rounded-2xl border border-border bg-surface p-6 shadow-sm"
        >
          <label
            htmlFor="displayAddress"
            className="block text-sm font-semibold text-text-primary"
          >
            Search by address
          </label>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <input
              id="displayAddress"
              name="displayAddress"
              type="text"
              required
              placeholder="Example: 123 Front St, Crescent City, CA"
              className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-4 py-3 text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-secondary px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-secondary-dark"
            >
              <Search className="h-4 w-4" />
              Search Quotes
            </button>
          </div>
          <p className="mt-3 text-sm leading-6 text-text-secondary">
            If we do not find an exact published quote for the address you type,
            we will also check for nearby quote addresses so a close map pin does
            not hide an estimate meant for your property.
          </p>
          {params.error === "address" && (
            <p className="mt-3 text-sm text-red-600">
              Please enter a fuller address so we can create the quote page.
            </p>
          )}
        </form>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
            <h2 className="font-semibold text-text-primary">
              Anyone can look up quotes
            </h2>
            <p className="mt-2 text-sm leading-6 text-text-secondary">
              Public address quote pages are open for discovery. No claim is
              needed to view published contractor quotes.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-secondary" />
              <h2 className="font-semibold text-text-primary">
                Save one customer address
              </h2>
            </div>
            <p className="mt-2 text-sm leading-6 text-text-secondary">
              To request quick quotes, a customer saves one address to their
              account. Contractors can then see that address and respond.
            </p>
          </div>
        </div>

        <div className="mt-8 rounded-xl border border-primary/20 bg-primary/5 p-5">
          <p className="text-sm font-semibold text-text-primary">
            First supported categories
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {Object.values(ADDRESS_QUOTE_SERVICE_LABELS).map((label) => (
              <span
                key={label}
                className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-text-secondary shadow-sm"
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
