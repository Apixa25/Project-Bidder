import Link from "next/link";
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
      <section className="border-b border-border bg-gradient-to-br from-accent via-secondary-dark to-slate-950 px-6 py-16 text-white">
        <div className="mx-auto max-w-4xl">
          <Link
            href="/"
            className="text-sm font-medium text-white/75 transition-colors hover:text-white"
          >
            ← Back to ProjectXBidX
          </Link>
          <div className="mt-10 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10">
              <MapPin className="h-6 w-6 text-primary" />
            </div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
              Public Address Quotes
            </p>
          </div>
          <h1 className="mt-5 max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
            Search an address and see free contractor quotes left there.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-white/80">
            Contractors can leave measured quotes on real addresses. Homeowners
            can search any address, compare public quotes, and claim up to 3
            addresses to request or remove quotes.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-10">
        <form
          action={searchPublicAddressQuotes}
          className="rounded-2xl border border-border bg-surface p-6 shadow-sm"
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
          {params.error === "address" && (
            <p className="mt-3 text-sm text-red-600">
              Please enter a fuller address so we can create the quote page.
            </p>
          )}
        </form>

        <AddressQuoteDiscoveryMap markers={mapMarkers} />

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
                Control requires a claim
              </h2>
            </div>
            <p className="mt-2 text-sm leading-6 text-text-secondary">
              To request quotes or remove quotes, a homeowner claims the address.
              Each user can have at most 3 active claimed addresses.
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
