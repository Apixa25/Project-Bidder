import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BadgeDollarSign,
  Clock,
  ExternalLink,
  MapPin,
  Search,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { userHasRole } from "@/lib/auth/roles";
import AddressWithMapPreview from "@/components/address-quotes/AddressWithMapPreview";
import AdminSearchBar from "@/components/admin/AdminSearchBar";
import AdminFilterBar, { FilterDropdown } from "@/components/admin/AdminFilters";
import {
  ADDRESS_QUOTE_REQUEST_SERVICE_LABELS,
  ADDRESS_QUOTE_REQUEST_SERVICE_VERTICALS,
  formatAddressQuoteRequestServices,
  isAddressQuoteRequestServiceVertical,
} from "@/lib/address-quotes/service-verticals";
import type {
  AddressQuoteRequest,
  AddressQuoteRequestServiceVertical,
  Profile,
  PropertyAddress,
} from "@/types/database";

interface BidderAddressRequestsPageProps {
  searchParams: Promise<{ q?: string; service?: string }>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function servicesForSearch(services: unknown) {
  if (!Array.isArray(services)) return "";

  return services
    .filter((service): service is AddressQuoteRequestServiceVertical =>
      typeof service === "string" && isAddressQuoteRequestServiceVertical(service)
    )
    .map((service) => ADDRESS_QUOTE_REQUEST_SERVICE_LABELS[service])
    .join(" ");
}

export default async function BidderAddressRequestsPage({
  searchParams,
}: BidderAddressRequestsPageProps) {
  const params = await searchParams;
  const rawSelectedService = params.service || "";
  const selectedService: AddressQuoteRequestServiceVertical | "" =
    isAddressQuoteRequestServiceVertical(rawSelectedService)
      ? rawSelectedService
      : "";
  const searchTerm = (params.q || "").trim().toLowerCase();
  const supabase = await createClient();
  const admin = createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  if (!(await userHasRole(user.id, "bidder"))) redirect("/login");

  const { data: requestRows } = await admin
    .from("address_quote_requests")
    .select("*")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(200);

  const requests = (requestRows || []) as AddressQuoteRequest[];
  const addressIds = Array.from(
    new Set(requests.map((request) => request.property_address_id))
  );
  const requesterIds = Array.from(
    new Set(requests.map((request) => request.requester_user_id))
  );
  const [{ data: addressRows }, { data: requesterRows }] = await Promise.all([
    addressIds.length
      ? admin.from("property_addresses").select("*").in("id", addressIds)
      : Promise.resolve({ data: [] }),
    requesterIds.length
      ? admin.from("profiles").select("*").in("user_id", requesterIds)
      : Promise.resolve({ data: [] }),
  ]);
  const addressMap = new Map(
    ((addressRows || []) as PropertyAddress[]).map((address) => [
      address.id,
      address,
    ])
  );
  const requesterMap = new Map(
    ((requesterRows || []) as Profile[]).map((profile) => [
      profile.user_id,
      profile,
    ])
  );

  const filteredRequests = requests.filter((request) => {
    const services = Array.isArray(request.requested_services_json)
      ? request.requested_services_json
      : [];

    if (selectedService && !services.includes(selectedService)) {
      return false;
    }

    if (!searchTerm) return true;

    const address = addressMap.get(request.property_address_id);
    const searchable = [
      address?.display_address,
      address?.city,
      address?.state,
      request.notes,
      servicesForSearch(request.requested_services_json),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return searchable.includes(searchTerm);
  });
  const serviceOptions = ADDRESS_QUOTE_REQUEST_SERVICE_VERTICALS.map((service) => ({
    value: service,
    label: ADDRESS_QUOTE_REQUEST_SERVICE_LABELS[service],
  }));
  const hasActiveFilters = Boolean(searchTerm || selectedService);

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            Open Address Requests
          </h1>
          <p className="mt-1 text-text-secondary">
            Find customers asking for quick quotes at their address.
          </p>
        </div>
        <Link
          href="/bidder/address-quotes"
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-surface px-5 py-2.5 text-sm font-semibold text-text-primary shadow-sm transition-colors hover:bg-surface-hover"
        >
          <MapPin className="h-4 w-4" />
          My Address Quotes
        </Link>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <BadgeDollarSign className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-text-primary">
                {requests.length}
              </p>
              <p className="text-sm text-text-muted">Open Requests</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/10">
              <Search className="h-5 w-5 text-secondary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-text-primary">
                {filteredRequests.length}
              </p>
              <p className="text-sm text-text-muted">Matching Requests</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100">
              <MapPin className="h-5 w-5 text-red-700" />
            </div>
            <div>
              <p className="text-2xl font-bold text-text-primary">
                {addressMap.size}
              </p>
              <p className="text-sm text-text-muted">Request Addresses</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-border bg-surface p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <AdminSearchBar placeholder="Search by address, city, notes, or service..." />
          <AdminFilterBar>
            <FilterDropdown
              paramName="service"
              label="Service"
              options={serviceOptions}
            />
          </AdminFilterBar>
        </div>
        {hasActiveFilters && (
          <Link
            href="/bidder/address-requests"
            className="mt-3 inline-flex text-sm font-semibold text-primary hover:text-primary-dark"
          >
            Clear filters
          </Link>
        )}
      </div>

      <div className="rounded-xl border border-border bg-surface shadow-sm">
        {filteredRequests.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <MapPin className="mx-auto mb-4 h-10 w-10 text-text-muted" />
            <h2 className="text-lg font-semibold text-text-primary">
              No open address requests found
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-text-secondary">
              Customer quick quote requests will appear here when customers ask
              for simple address-based services like lawn mowing, gutters, snow,
              leaves, or pressure washing.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredRequests.map((request) => {
              const address = addressMap.get(request.property_address_id);
              const requester = requesterMap.get(request.requester_user_id);

              return (
                <article key={request.id} className="px-6 py-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-red-700">
                          Customer request
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                          <Clock className="h-3.5 w-3.5" />
                          {formatDate(request.created_at)}
                        </span>
                      </div>
                      <h2 className="mt-3 text-lg font-bold text-text-primary">
                        {formatAddressQuoteRequestServices(
                          request.requested_services_json
                        )}
                      </h2>
                      <AddressWithMapPreview
                        address={address?.display_address || "Address unavailable"}
                        mapImageUrl={requester?.exact_address_map_image_url}
                        className="mt-2 text-sm"
                      />
                      {request.notes && (
                        <p className="mt-3 rounded-lg bg-bg-warm px-3 py-2 text-sm leading-6 text-text-secondary">
                          {request.notes}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      <Link
                        href={`/bidder/address-requests/${request.id}`}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-secondary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-secondary-dark"
                      >
                        Review Request
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                      <Link
                        href={`/address-quotes/${request.property_address_id}`}
                        className="inline-flex items-center justify-center rounded-lg border border-primary/20 bg-primary/5 px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/10"
                      >
                        View Address
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
