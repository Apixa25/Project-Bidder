import Link from "next/link";
import { redirect } from "next/navigation";
import { MapPin, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { userHasRole } from "@/lib/auth/roles";
import AddressWithMapPreview from "@/components/address-quotes/AddressWithMapPreview";
import {
  rejectPropertyAddressClaim,
  verifyPropertyAddressClaim,
} from "@/lib/address-quotes/actions";
import { ADDRESS_QUOTE_SERVICE_LABELS } from "@/lib/address-quotes/service-verticals";
import type {
  AddressQuote,
  Profile,
  PropertyAddress,
  PropertyAddressClaim,
} from "@/types/database";

function formatMoney(cents: number | null) {
  if (cents === null) return "No price";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export default async function AdminAddressQuotesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; claim?: string }>;
}) {
  const query = await searchParams;
  const supabase = await createClient();
  const admin = createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  if (!(await userHasRole(user.id, "admin"))) redirect("/login");

  const [
    { data: quotes },
    { count: publishedCount },
    { count: draftCount },
    { count: removedCount },
    { count: pendingClaimCount },
    { count: openRequestCount },
    { data: pendingClaims },
  ] = await Promise.all([
    admin
      .from("address_quotes")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(100),
    admin
      .from("address_quotes")
      .select("*", { count: "exact", head: true })
      .eq("status", "published"),
    admin
      .from("address_quotes")
      .select("*", { count: "exact", head: true })
      .eq("status", "draft"),
    admin
      .from("address_quotes")
      .select("*", { count: "exact", head: true })
      .eq("status", "removed"),
    admin
      .from("property_address_claims")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending"),
    admin
      .from("address_quote_requests")
      .select("*", { count: "exact", head: true })
      .eq("status", "open"),
    admin
      .from("property_address_claims")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(25),
  ]);

  const addressIds = Array.from(
    new Set((quotes || []).map((quote) => quote.property_address_id))
  );
  const contractorIds = Array.from(
    new Set((quotes || []).map((quote) => quote.contractor_id))
  );
  const claimAddressIds = Array.from(
    new Set((pendingClaims || []).map((claim) => claim.property_address_id))
  );
  const claimUserIds = Array.from(
    new Set((pendingClaims || []).map((claim) => claim.user_id))
  );

  const [{ data: addresses }, { data: contractors }, { data: claimAddresses }, { data: claimProfiles }] =
    await Promise.all([
      addressIds.length
      ? admin.from("property_addresses").select("*").in("id", addressIds)
      : Promise.resolve({ data: [] }),
      contractorIds.length
      ? admin.from("profiles").select("*").in("user_id", contractorIds)
      : Promise.resolve({ data: [] }),
      claimAddressIds.length
        ? admin.from("property_addresses").select("*").in("id", claimAddressIds)
        : Promise.resolve({ data: [] }),
      claimUserIds.length
        ? admin.from("profiles").select("*").in("user_id", claimUserIds)
        : Promise.resolve({ data: [] }),
    ]);

  const addressMap = new Map(
    ((addresses || []) as PropertyAddress[]).map((address) => [
      address.id,
      address,
    ])
  );
  const contractorMap = new Map(
    ((contractors || []) as Profile[]).map((profile) => [
      profile.user_id,
      profile,
    ])
  );
  const claimAddressMap = new Map(
    ((claimAddresses || []) as PropertyAddress[]).map((address) => [
      address.id,
      address,
    ])
  );
  const claimProfileMap = new Map(
    ((claimProfiles || []) as Profile[]).map((profile) => [
      profile.user_id,
      profile,
    ])
  );

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">
          Address Quotes
        </h1>
        <p className="mt-1 text-text-secondary">
          Admin visibility into the public quote layer over real addresses.
        </p>
      </div>

      {(query.claim || query.error) && (
        <div
          className={`mb-6 rounded-xl border px-4 py-3 text-sm ${
            query.claim
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {query.claim === "verified"
            ? "Address claim verified."
            : query.claim === "rejected"
              ? "Address claim rejected."
              : "Address claim action could not be completed."}
        </div>
      )}

      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ["Published", publishedCount || 0],
          ["Drafts", draftCount || 0],
          ["Removed", removedCount || 0],
          ["Pending Claims", pendingClaimCount || 0],
          ["Open Requests", openRequestCount || 0],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-xl border border-border bg-surface p-5 shadow-sm"
          >
            <p className="text-2xl font-bold text-text-primary">{value}</p>
            <p className="mt-1 text-sm text-text-muted">{label}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-surface shadow-sm">
        {(quotes || []).length === 0 ? (
          <div className="px-6 py-12 text-center">
            <MapPin className="mx-auto mb-4 h-10 w-10 text-text-muted" />
            <h2 className="text-lg font-semibold text-text-primary">
              No address quotes yet
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-text-secondary">
              Contractor-created public address quotes will appear here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {((quotes || []) as AddressQuote[]).map((quote) => {
              const address = addressMap.get(quote.property_address_id);
              const contractor = contractorMap.get(quote.contractor_id);

              return (
                <div key={quote.id} className="px-6 py-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-secondary/10 px-3 py-1 text-xs font-semibold text-secondary">
                          {ADDRESS_QUOTE_SERVICE_LABELS[quote.service_vertical]}
                        </span>
                        <span className="rounded-full bg-surface-hover px-3 py-1 text-xs font-semibold capitalize text-text-secondary">
                          {quote.status}
                        </span>
                        {quote.removed_at && (
                          <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
                            Removed
                          </span>
                        )}
                      </div>
                      <h2 className="mt-3 font-semibold text-text-primary">
                        {quote.title}
                      </h2>
                      <p className="mt-1 text-sm text-text-secondary">
                        {address?.display_address || "Address unavailable"}
                      </p>
                      <p className="mt-1 text-sm text-text-muted">
                        Contractor:{" "}
                        {contractor?.business_name ||
                          contractor?.full_name ||
                          quote.contractor_id}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 lg:items-end">
                      <p className="text-xl font-bold text-text-primary">
                        {formatMoney(quote.quote_total_cents)}
                      </p>
                      <Link
                        href={`/address-quotes/${quote.property_address_id}`}
                        className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary-dark"
                      >
                        <ShieldCheck className="h-4 w-4" />
                        Public page
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-8 rounded-xl border border-border bg-surface shadow-sm">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-text-primary">
            Pending Address Claims
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            Approving a claim lets that user request quotes and remove quotes
            from the address.
          </p>
        </div>
        {(pendingClaims || []).length === 0 ? (
          <div className="px-6 py-8 text-sm text-text-secondary">
            No pending address claims.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {((pendingClaims || []) as PropertyAddressClaim[]).map((claim) => {
              const address = claimAddressMap.get(claim.property_address_id);
              const profile = claimProfileMap.get(claim.user_id);

              return (
                <div
                  key={claim.id}
                  className="flex flex-col gap-4 px-6 py-4 lg:flex-row lg:items-start lg:justify-between"
                >
                  <div>
                    <AddressWithMapPreview
                      address={address?.display_address || claim.property_address_id}
                      mapImageUrl={profile?.exact_address_map_image_url}
                      label="Claimed customer address"
                    />
                    <p className="mt-1 text-sm text-text-secondary">
                      Requested by{" "}
                      {profile?.full_name || profile?.email || claim.user_id}
                    </p>
                    {claim.evidence_notes && (
                      <p className="mt-2 rounded-lg bg-bg-warm px-3 py-2 text-sm text-text-secondary">
                        {claim.evidence_notes}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <form action={verifyPropertyAddressClaim}>
                      <input type="hidden" name="claimId" value={claim.id} />
                      <input
                        type="hidden"
                        name="propertyAddressId"
                        value={claim.property_address_id}
                      />
                      <button
                        type="submit"
                        className="rounded-lg bg-secondary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-secondary-dark"
                      >
                        Verify
                      </button>
                    </form>
                    <form action={rejectPropertyAddressClaim}>
                      <input type="hidden" name="claimId" value={claim.id} />
                      <input
                        type="hidden"
                        name="propertyAddressId"
                        value={claim.property_address_id}
                      />
                      <button
                        type="submit"
                        className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-text-primary transition-colors hover:bg-white"
                      >
                        Reject
                      </button>
                    </form>
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
