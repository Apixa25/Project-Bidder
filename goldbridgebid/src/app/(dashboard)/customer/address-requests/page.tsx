import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BadgeDollarSign,
  CheckCircle2,
  Clock,
  Mail,
  MapPin,
  Phone,
  Plus,
  Search,
  ShieldCheck,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { userHasRole } from "@/lib/auth/roles";
import AddressWithMapPreview from "@/components/address-quotes/AddressWithMapPreview";
import {
  createCustomerAddressQuoteRequest,
  removeCustomerAddressQuoteRequest,
  selectAddressQuoteRequestResponse,
  updateCustomerAddressQuoteRequest,
} from "@/lib/address-quotes/actions";
import {
  ADDRESS_QUOTE_REQUEST_SERVICE_LABELS,
  ADDRESS_QUOTE_REQUEST_SERVICE_VERTICALS,
  formatAddressQuoteRequestServices,
} from "@/lib/address-quotes/service-verticals";
import type {
  AddressQuoteRequest,
  AddressQuoteRequestResponse,
  Profile,
  PropertyAddress,
  PropertyAddressClaim,
} from "@/types/database";

interface CustomerAddressRequestsPageProps {
  searchParams: Promise<{
    error?: string;
    request?: string;
    response?: string;
    address?: string;
  }>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function statusClasses(status: string) {
  switch (status) {
    case "verified":
      return "bg-green-100 text-green-800";
    case "pending":
      return "bg-amber-100 text-amber-900";
    case "open":
    case "submitted":
      return "bg-secondary/10 text-secondary";
    case "closed":
    case "selected":
      return "bg-slate-100 text-slate-700";
    case "removed":
    case "rejected":
    case "revoked":
    case "declined":
    case "withdrawn":
      return "bg-red-100 text-red-700";
    default:
      return "bg-bg-warm text-text-secondary";
  }
}

export default async function CustomerAddressRequestsPage({
  searchParams,
}: CustomerAddressRequestsPageProps) {
  const query = await searchParams;
  const supabase = await createClient();
  const admin = createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [hasRole, { data: profile }, { data: claimRows }, { data: requestRows }] =
    await Promise.all([
      userHasRole(user.id, "customer"),
      admin
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle(),
      admin
        .from("property_address_claims")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      admin
        .from("address_quote_requests")
        .select("*")
        .eq("requester_user_id", user.id)
        .order("created_at", { ascending: false }),
    ]);

  if (!hasRole) redirect("/login");

  const customerProfile = profile as Profile | null;
  const customerMapImageUrl = customerProfile?.exact_address_map_image_url || null;

  const claims = (claimRows || []) as PropertyAddressClaim[];
  const requests = (requestRows || []) as AddressQuoteRequest[];
  const addressIds = Array.from(
    new Set([
      ...claims.map((claim) => claim.property_address_id),
      ...requests.map((request) => request.property_address_id),
    ])
  );
  const requestIds = requests.map((request) => request.id);

  const [{ data: addressRows }, { data: responseRows }] = await Promise.all([
    addressIds.length
      ? admin.from("property_addresses").select("*").in("id", addressIds)
      : Promise.resolve({ data: [] }),
    requestIds.length
      ? admin
          .from("address_quote_request_responses")
          .select("*")
          .in("request_id", requestIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);
  const addressMap = new Map(
    ((addressRows || []) as PropertyAddress[]).map((address) => [
      address.id,
      address,
    ])
  );
  const responses = (responseRows || []) as AddressQuoteRequestResponse[];
  const contractorIds = Array.from(
    new Set(responses.map((response) => response.contractor_id))
  );
  const { data: contractorRows } = contractorIds.length
    ? await admin.from("profiles").select("*").in("user_id", contractorIds)
    : { data: [] };
  const contractorMap = new Map(
    ((contractorRows || []) as Profile[]).map((profile) => [
      profile.user_id,
      profile,
    ])
  );
  const responsesByRequest = new Map<string, AddressQuoteRequestResponse[]>();
  for (const response of responses) {
    const rows = responsesByRequest.get(response.request_id) || [];
    rows.push(response);
    responsesByRequest.set(response.request_id, rows);
  }
  const customerAddressClaims = claims.filter(
    (claim) => claim.status === "pending" || claim.status === "verified"
  );
  const activeRequests = requests.filter((request) => request.status === "open");

  const feedback = query.request
    ? {
        tone: "success",
        message:
          query.request === "updated"
            ? "Quick quote request updated."
            : query.request === "removed"
              ? "Quick quote request removed."
              : "Quick quote request created. Contractors can now find it from the address request list.",
      }
    : query.address === "saved"
      ? {
          tone: "success",
          message: "Customer address saved. You can create quick quote requests now.",
        }
    : query.response === "selected"
      ? {
          tone: "success",
          message: "Quick quote response selected. The request is now closed.",
        }
    : query.error
      ? {
          tone: "error",
          message:
            query.error === "address"
              ? "Enter a full address before saving or requesting quick quotes."
              : query.error === "services"
                ? "Choose at least one quick quote service."
                : query.error === "claim-required"
                  ? "Save one customer address before requesting quick quotes."
                  : query.error === "address-limit"
                    ? "You already have one saved customer address."
                  : query.error === "response"
                    ? "That contractor response could not be selected."
                  : "That request could not be created. Please try again.",
        }
      : null;

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            My Address Requests
          </h1>
          <p className="mt-1 text-text-secondary">
            Request quick quotes for simple services at your saved customer
            address.
          </p>
        </div>
        <Link
          href="/address-quotes"
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-surface px-5 py-2.5 text-sm font-semibold text-text-primary shadow-sm transition-colors hover:bg-surface-hover"
        >
          <Search className="h-4 w-4" />
          Look Up Your Address
        </Link>
      </div>

      {feedback && (
        <div
          className={`mb-6 rounded-xl border px-4 py-3 text-sm ${
            feedback.tone === "success"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {feedback.message}
        </div>
      )}

      <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/10">
              <ShieldCheck className="h-5 w-5 text-secondary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-text-primary">
                {customerAddressClaims.length}
              </p>
              <p className="text-sm text-text-muted">Saved Address</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
              <Clock className="h-5 w-5 text-amber-700" />
            </div>
            <div>
              <p className="text-2xl font-bold text-text-primary">
                {customerAddressClaims.length >= 1 ? 0 : 1}
              </p>
              <p className="text-sm text-text-muted">Address Slot Available</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <BadgeDollarSign className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-text-primary">
                {activeRequests.length}
              </p>
              <p className="text-sm text-text-muted">Open Requests</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="order-last space-y-6 lg:order-first">
          <section className="rounded-xl border border-border bg-surface shadow-sm">
            <div className="border-b border-border px-6 py-4">
              <h2 className="font-semibold text-text-primary">
                My Customer Address
              </h2>
              <p className="mt-1 text-sm text-text-secondary">
                Customers can use one saved address for quick quote requests.
              </p>
            </div>

            {claims.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <MapPin className="mx-auto mb-4 h-10 w-10 text-text-muted" />
                <h3 className="font-semibold text-text-primary">
                  No customer address saved yet
                </h3>
                <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-text-secondary">
                  Open your profile and save your exact address pin. That pin
                  becomes the location contractors use for quick quote requests.
                </p>
                <Link
                  href="/customer/profile"
                  className="mt-5 inline-flex items-center gap-2 rounded-lg bg-secondary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-secondary-dark"
                >
                  <Search className="h-4 w-4" />
                  Open Edit Profile
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {claims.map((claim) => {
                  const address = addressMap.get(claim.property_address_id);

                  return (
                    <div key={claim.id} className="px-6 py-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <AddressWithMapPreview
                            address={address?.display_address || "Address unavailable"}
                            mapImageUrl={customerMapImageUrl}
                            label="Saved customer address"
                          />
                          <p className="mt-1 text-sm text-text-secondary">
                            Saved {formatDate(claim.created_at)}
                          </p>
                          {claim.evidence_notes && (
                            <p className="mt-2 rounded-lg bg-bg-warm px-3 py-2 text-sm text-text-secondary">
                              {claim.evidence_notes}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2 sm:justify-end">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${statusClasses(
                              claim.status
                            )}`}
                          >
                            {claim.status}
                          </span>
                          <Link
                            href={`/address-quotes/${claim.property_address_id}`}
                            className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
                          >
                            View address page
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-border bg-surface shadow-sm">
            <div className="border-b border-border px-6 py-4">
              <h2 className="font-semibold text-text-primary">
                Existing Requests
              </h2>
              <p className="mt-1 text-sm text-text-secondary">
                These are the quick quote requests you have created from your
                saved customer address.
              </p>
            </div>

            {requests.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <BadgeDollarSign className="mx-auto mb-4 h-10 w-10 text-text-muted" />
                <h3 className="font-semibold text-text-primary">
                  No quick quote requests yet
                </h3>
                <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-text-secondary">
                  Use the form to ask contractors for quick pricing on lawn
                  mowing, gutters, leaves, snow removal, and other simple
                  property services.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {requests.map((request) => {
                  const address = addressMap.get(request.property_address_id);
                  const requestResponses =
                    responsesByRequest.get(request.id) || [];
                  const submittedResponses = requestResponses.filter(
                    (response) =>
                      response.status === "submitted" ||
                      response.status === "selected"
                  );
                  const selectedServices = Array.isArray(
                    request.requested_services_json
                  )
                    ? request.requested_services_json
                    : [];

                  return (
                    <div key={request.id} className="px-6 py-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${statusClasses(
                                request.status
                              )}`}
                            >
                              {request.status}
                            </span>
                            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                              {formatDate(request.created_at)}
                            </span>
                          </div>
                          <h3 className="mt-3 font-semibold text-text-primary">
                            {formatAddressQuoteRequestServices(
                              request.requested_services_json
                            )}
                          </h3>
                          <AddressWithMapPreview
                            address={address?.display_address || "Address unavailable"}
                            mapImageUrl={customerMapImageUrl}
                            className="mt-2 text-sm"
                          />
                          {request.notes && (
                            <p className="mt-2 rounded-lg bg-bg-warm px-3 py-2 text-sm leading-6 text-text-secondary">
                              {request.notes}
                            </p>
                          )}
                          <div className="mt-4 rounded-xl border border-border bg-bg-warm p-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-sm font-semibold text-text-primary">
                                Contractor responses
                              </p>
                              <span className="rounded-full bg-surface px-3 py-1 text-xs font-semibold text-text-secondary">
                                {submittedResponses.length} response
                                {submittedResponses.length === 1 ? "" : "s"}
                              </span>
                            </div>

                            {submittedResponses.length === 0 ? (
                              <p className="mt-2 text-sm text-text-secondary">
                                No contractor responses yet.
                              </p>
                            ) : (
                              <div className="mt-3 space-y-3">
                                {submittedResponses.map((response) => {
                                  const contractor = contractorMap.get(
                                    response.contractor_id
                                  );
                                  const contractorName =
                                    contractor?.business_name ||
                                    contractor?.full_name ||
                                    "Contractor";

                                  return (
                                    <div
                                      key={response.id}
                                      className="rounded-xl border border-border bg-surface p-4"
                                    >
                                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                        <div>
                                          <div className="flex flex-wrap items-center gap-2">
                                            <p className="font-semibold text-text-primary">
                                              {contractorName}
                                            </p>
                                            <span
                                              className={`rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${statusClasses(
                                                response.status
                                              )}`}
                                            >
                                              {response.status}
                                            </span>
                                          </div>
                                          <p className="mt-2 text-2xl font-bold text-text-primary">
                                            {formatMoney(response.quote_total_cents)}
                                          </p>
                                          <p className="mt-1 text-sm font-medium text-text-secondary">
                                            Timeline: {response.timeline}
                                          </p>
                                          {response.message && (
                                            <p className="mt-2 text-sm leading-6 text-text-secondary">
                                              {response.message}
                                            </p>
                                          )}
                                          <div className="mt-3 flex flex-wrap gap-3 text-sm">
                                            {contractor?.phone && (
                                              <a
                                                href={`tel:${contractor.phone}`}
                                                className="inline-flex items-center gap-1 font-semibold text-secondary hover:text-secondary-dark"
                                              >
                                                <Phone className="h-4 w-4" />
                                                {contractor.phone}
                                              </a>
                                            )}
                                            {contractor?.email && (
                                              <a
                                                href={`mailto:${contractor.email}`}
                                                className="inline-flex items-center gap-1 font-semibold text-primary hover:text-primary-dark"
                                              >
                                                <Mail className="h-4 w-4" />
                                                {contractor.email}
                                              </a>
                                            )}
                                          </div>
                                        </div>
                                        {request.status === "open" &&
                                          response.status === "submitted" && (
                                            <form
                                              action={
                                                selectAddressQuoteRequestResponse
                                              }
                                            >
                                              <input
                                                type="hidden"
                                                name="requestId"
                                                value={request.id}
                                              />
                                              <input
                                                type="hidden"
                                                name="responseId"
                                                value={response.id}
                                              />
                                              <button
                                                type="submit"
                                                className="rounded-lg bg-secondary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-secondary-dark"
                                              >
                                                Select Response
                                              </button>
                                            </form>
                                          )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 sm:items-end">
                          <Link
                            href={`/address-quotes/${request.property_address_id}`}
                            className="inline-flex items-center justify-center rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-text-primary transition-colors hover:bg-white"
                          >
                            View address
                          </Link>
                          {request.status === "open" && (
                            <form action={removeCustomerAddressQuoteRequest}>
                              <input
                                type="hidden"
                                name="requestId"
                                value={request.id}
                              />
                              <button
                                type="submit"
                                className="inline-flex items-center justify-center rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100"
                              >
                                Delete request
                              </button>
                            </form>
                          )}
                        </div>
                      </div>
                      {request.status === "open" && (
                        <details className="mt-4 rounded-xl border border-border bg-bg-warm p-4">
                          <summary className="cursor-pointer text-sm font-semibold text-text-primary">
                            Edit this request
                          </summary>
                          <form
                            action={updateCustomerAddressQuoteRequest}
                            className="mt-4 space-y-4"
                          >
                            <input
                              type="hidden"
                              name="requestId"
                              value={request.id}
                            />
                            <fieldset>
                              <legend className="text-sm font-semibold text-text-primary">
                                Services to quote
                              </legend>
                              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                {ADDRESS_QUOTE_REQUEST_SERVICE_VERTICALS.map(
                                  (service) => (
                                    <label
                                      key={service}
                                      className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary"
                                    >
                                      <input
                                        type="checkbox"
                                        name="services"
                                        value={service}
                                        defaultChecked={selectedServices.includes(
                                          service
                                        )}
                                        className="rounded border-border text-secondary"
                                      />
                                      {ADDRESS_QUOTE_REQUEST_SERVICE_LABELS[service]}
                                    </label>
                                  )
                                )}
                              </div>
                            </fieldset>
                            <div>
                              <label
                                htmlFor={`notes-${request.id}`}
                                className="block text-sm font-semibold text-text-primary"
                              >
                                Notes
                              </label>
                              <textarea
                                id={`notes-${request.id}`}
                                name="notes"
                                rows={3}
                                defaultValue={request.notes || ""}
                                placeholder="Add or update details contractors should know."
                                className="mt-2 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                              />
                            </div>
                            <button
                              type="submit"
                              className="rounded-lg bg-secondary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-secondary-dark"
                            >
                              Save Request Changes
                            </button>
                          </form>
                        </details>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <aside className="order-first lg:order-last">
          <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              <h2 className="font-semibold text-text-primary">
                Request Quick Quotes
              </h2>
            </div>
            <p className="mt-2 text-sm leading-6 text-text-secondary">
              Pick your saved customer address and the simple services you want
              quoted. Contractors will be able to see this address so they can
              prepare a quick quote.
            </p>

            {customerAddressClaims.length === 0 ? (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <div className="flex items-center gap-2 font-semibold">
                  <Clock className="h-4 w-4" />
                  Saved address required
                </div>
                <p className="mt-1">
                  Look up your address and save it before creating address quote
                  requests.
                </p>
              </div>
            ) : (
              <form
                action={createCustomerAddressQuoteRequest}
                className="mt-4 space-y-4"
              >
                <div>
                  <label
                    htmlFor="propertyAddressId"
                    className="block text-sm font-semibold text-text-primary"
                  >
                    Saved customer address
                  </label>
                  <select
                    id="propertyAddressId"
                    name="propertyAddressId"
                    required
                    className="mt-2 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    {customerAddressClaims.map((claim) => {
                      const address = addressMap.get(claim.property_address_id);

                      return (
                        <option
                          key={claim.id}
                          value={claim.property_address_id}
                        >
                          {address?.display_address || claim.property_address_id}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <fieldset>
                  <legend className="text-sm font-semibold text-text-primary">
                    What do you want quoted?
                  </legend>
                  <div className="mt-2 space-y-2">
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
                </fieldset>

                <div>
                  <label
                    htmlFor="notes"
                    className="block text-sm font-semibold text-text-primary"
                  >
                    Optional notes
                  </label>
                  <textarea
                    id="notes"
                    name="notes"
                    rows={4}
                    placeholder="Example: Front and back lawn, please quote weekly and one-time options."
                    className="mt-2 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-xs leading-5 text-text-secondary">
                  <div className="mb-1 flex items-center gap-2 font-semibold text-text-primary">
                    <CheckCircle2 className="h-4 w-4 text-secondary" />
                    Address visibility consent
                  </div>
                  Submitting means contractors can see this address and your
                  requested services so they can prepare a quick quote.
                </div>

                <button
                  type="submit"
                  className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-primary-dark hover:text-white"
                >
                  Request Quick Quotes
                </button>
              </form>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
