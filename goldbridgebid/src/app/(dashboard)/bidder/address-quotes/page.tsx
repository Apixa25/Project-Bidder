import Link from "next/link";
import { redirect } from "next/navigation";
import { MapPin, Plus, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { userHasRole } from "@/lib/auth/roles";
import { ADDRESS_QUOTE_SERVICE_LABELS } from "@/lib/address-quotes/service-verticals";
import type { AddressQuote, PropertyAddress } from "@/types/database";

function formatMoney(cents: number | null) {
  if (cents === null) return "No price";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export default async function BidderAddressQuotesPage() {
  const supabase = await createClient();
  const admin = createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  if (!(await userHasRole(user.id, "bidder"))) redirect("/login");

  const { data: quotes } = await admin
    .from("address_quotes")
    .select("*")
    .eq("contractor_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(100);

  const addressIds = Array.from(
    new Set((quotes || []).map((quote) => quote.property_address_id))
  );
  const { data: addresses } = addressIds.length
    ? await admin.from("property_addresses").select("*").in("id", addressIds)
    : { data: [] };
  const addressMap = new Map(
    ((addresses || []) as PropertyAddress[]).map((address) => [
      address.id,
      address,
    ])
  );

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            Address Quotes
          </h1>
          <p className="mt-1 text-text-secondary">
            Leave free, measured quotes on real addresses for homeowners to find.
          </p>
        </div>
        <Link
          href="/bidder/address-quotes/new"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-secondary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-secondary-dark"
        >
          <Plus className="h-4 w-4" />
          New Address Quote
        </Link>
      </div>

      <div className="mb-8 rounded-xl border-2 border-white bg-white p-5 shadow-lg">
        <div className="flex items-start gap-3">
          <Search className="mt-0.5 h-5 w-5 text-black" />
          <div>
            <h2 className="font-semibold text-black">
              First build slice
            </h2>
            <p className="mt-1 text-sm font-medium leading-6 text-black">
              This now supports saved map areas, length line items, proof
              screenshots, and manual pricing. Saved pricing rules can come
              next after the address quote layer is stable.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface shadow-sm">
        {(quotes || []).length === 0 ? (
          <div className="px-6 py-12 text-center">
            <MapPin className="mx-auto mb-4 h-10 w-10 text-text-muted" />
            <h2 className="text-lg font-semibold text-text-primary">
              No address quotes yet
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-text-secondary">
              Create your first public address quote for a simple exterior
              service like lawn care.
            </p>
            <Link
              href="/bidder/address-quotes/new"
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-secondary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-secondary-dark"
            >
              <Plus className="h-4 w-4" />
              Create Quote
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {((quotes || []) as AddressQuote[]).map((quote) => {
              const address = addressMap.get(quote.property_address_id);

              return (
                <div key={quote.id} className="px-6 py-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-secondary/10 px-3 py-1 text-xs font-semibold text-secondary">
                          {ADDRESS_QUOTE_SERVICE_LABELS[quote.service_vertical]}
                        </span>
                        <span className="rounded-full bg-surface-hover px-3 py-1 text-xs font-semibold capitalize text-text-secondary">
                          {quote.status}
                        </span>
                      </div>
                      <h2 className="mt-3 font-semibold text-text-primary">
                        {quote.title}
                      </h2>
                      <p className="mt-1 text-sm text-text-secondary">
                        {address?.display_address || "Address unavailable"}
                      </p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-lg font-bold text-text-primary">
                        {formatMoney(quote.quote_total_cents)}
                      </p>
                      <Link
                        href={`/address-quotes/${quote.property_address_id}`}
                        className="mt-1 inline-flex text-sm font-medium text-primary hover:text-primary-dark"
                      >
                        View public page
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
