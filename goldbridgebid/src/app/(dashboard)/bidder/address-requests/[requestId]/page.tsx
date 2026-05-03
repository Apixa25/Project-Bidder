import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, BadgeDollarSign, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { userHasRole } from "@/lib/auth/roles";
import AddressWithMapPreview from "@/components/address-quotes/AddressWithMapPreview";
import { submitAddressQuoteRequestResponse } from "@/lib/address-quotes/actions";
import { formatAddressQuoteRequestServices } from "@/lib/address-quotes/service-verticals";
import type {
  AddressQuoteRequest,
  AddressQuoteRequestResponse,
  Profile,
  PropertyAddress,
} from "@/types/database";

interface BidderAddressRequestDetailPageProps {
  params: Promise<{ requestId: string }>;
  searchParams: Promise<{ error?: string; response?: string }>;
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

export default async function BidderAddressRequestDetailPage({
  params,
  searchParams,
}: BidderAddressRequestDetailPageProps) {
  const { requestId } = await params;
  const query = await searchParams;
  const supabase = await createClient();
  const admin = createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  if (!(await userHasRole(user.id, "bidder"))) redirect("/login");

  const { data: request } = await admin
    .from("address_quote_requests")
    .select("*")
    .eq("id", requestId)
    .eq("status", "open")
    .maybeSingle();

  if (!request) notFound();

  const typedRequest = request as AddressQuoteRequest;
  const [{ data: address }, { data: requesterProfile }] = await Promise.all([
    admin
      .from("property_addresses")
      .select("*")
      .eq("id", typedRequest.property_address_id)
      .maybeSingle(),
    admin
      .from("profiles")
      .select("*")
      .eq("user_id", typedRequest.requester_user_id)
      .maybeSingle(),
  ]);
  const typedAddress = address as PropertyAddress | null;
  const typedRequesterProfile = requesterProfile as Profile | null;

  const { data: existingResponse } = await admin
    .from("address_quote_request_responses")
    .select("*")
    .eq("request_id", requestId)
    .eq("contractor_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const typedExistingResponse =
    existingResponse as AddressQuoteRequestResponse | null;
  const feedback = query.response
    ? {
        tone: "success",
        message: "Quick quote response submitted. The customer can now review it.",
      }
    : query.error
      ? {
          tone: "error",
          message:
            query.error === "price"
              ? "Enter a valid quote amount."
              : query.error === "timeline"
                ? "Enter an estimated timeline."
                : query.error === "duplicate"
                  ? "You already have an active response for this request."
                  : "That response could not be submitted. Please try again.",
        }
      : null;

  return (
    <div>
      <div className="mb-8">
        <Link
          href="/bidder/address-requests"
          className="inline-flex items-center gap-2 text-sm font-semibold text-primary transition-colors hover:text-primary-dark"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Open Address Requests
        </Link>
        <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-red-700">
                Customer request
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                <Clock className="h-3.5 w-3.5" />
                {formatDate(typedRequest.created_at)}
              </span>
            </div>
            <h1 className="mt-3 text-2xl font-bold text-text-primary">
              {formatAddressQuoteRequestServices(
                typedRequest.requested_services_json
              )}
            </h1>
            <AddressWithMapPreview
              address={typedAddress?.display_address || "Address unavailable"}
              mapImageUrl={typedRequesterProfile?.exact_address_map_image_url}
              className="mt-3 text-text-secondary"
            />
          </div>
          <Link
            href={`/address-quotes/${typedRequest.property_address_id}`}
            className="inline-flex items-center justify-center rounded-lg border border-primary/20 bg-primary/5 px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/10"
          >
            View Public Address Page
          </Link>
        </div>
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

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <h2 className="font-semibold text-text-primary">Request Details</h2>
          <div className="mt-4 space-y-4">
            <div className="rounded-xl bg-bg-warm px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                Requested services
              </p>
              <p className="mt-1 font-semibold text-text-primary">
                {formatAddressQuoteRequestServices(
                  typedRequest.requested_services_json
                )}
              </p>
            </div>
            <div className="rounded-xl bg-bg-warm px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                Address
              </p>
              <AddressWithMapPreview
                address={typedAddress?.display_address || "Address unavailable"}
                mapImageUrl={typedRequesterProfile?.exact_address_map_image_url}
                className="mt-2 text-sm"
              />
            </div>
            <div className="rounded-xl bg-bg-warm px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                Customer notes
              </p>
              <p className="mt-1 text-sm leading-6 text-text-secondary">
                {typedRequest.notes || "No additional notes provided."}
              </p>
            </div>
          </div>
        </section>

        <aside className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <BadgeDollarSign className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-text-primary">
              Quick quote response
            </h2>
          </div>
          {typedExistingResponse?.status === "submitted" ? (
            <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
              <p className="font-semibold">Response submitted</p>
              <p className="mt-1">
                {formatMoney(typedExistingResponse.quote_total_cents)} •{" "}
                {typedExistingResponse.timeline}
              </p>
              {typedExistingResponse.message && (
                <p className="mt-2 leading-6">{typedExistingResponse.message}</p>
              )}
            </div>
          ) : typedExistingResponse ? (
            <div className="mt-4 rounded-lg border border-border bg-bg-warm px-4 py-3 text-sm text-text-secondary">
              Your latest response is {typedExistingResponse.status}.
            </div>
          ) : (
            <form
              action={submitAddressQuoteRequestResponse}
              className="mt-4 space-y-4"
            >
              <input type="hidden" name="requestId" value={typedRequest.id} />
              <div>
                <label
                  htmlFor="quoteTotalDollars"
                  className="block text-sm font-semibold text-text-primary"
                >
                  Quote amount
                </label>
                <input
                  id="quoteTotalDollars"
                  name="quoteTotalDollars"
                  type="text"
                  inputMode="decimal"
                  required
                  placeholder="Example: 125"
                  className="mt-2 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label
                  htmlFor="timeline"
                  className="block text-sm font-semibold text-text-primary"
                >
                  Timeline
                </label>
                <input
                  id="timeline"
                  name="timeline"
                  type="text"
                  required
                  placeholder="Example: This week, about 2 hours"
                  className="mt-2 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label
                  htmlFor="message"
                  className="block text-sm font-semibold text-text-primary"
                >
                  Message
                </label>
                <textarea
                  id="message"
                  name="message"
                  rows={4}
                  placeholder="Add anything the customer should know."
                  className="mt-2 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <button
                type="submit"
                className="w-full rounded-lg bg-secondary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-secondary-dark"
              >
                Submit Quick Quote
              </button>
            </form>
          )}
        </aside>
      </div>
    </div>
  );
}
