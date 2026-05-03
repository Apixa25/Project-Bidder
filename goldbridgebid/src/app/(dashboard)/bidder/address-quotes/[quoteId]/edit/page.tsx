import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { userHasRole } from "@/lib/auth/roles";
import {
  deleteContractorAddressQuote,
  updateContractorAddressQuote,
} from "@/lib/address-quotes/actions";
import AddressQuoteBidSheet from "@/components/address-quotes/AddressQuoteBidSheet";
import LawnAreaMeasurementMap, {
  type InitialAddressQuoteMeasurement,
} from "@/components/address-quotes/LawnAreaMeasurementMap";
import {
  ADDRESS_QUOTE_SERVICE_LABELS,
  ADDRESS_QUOTE_SERVICE_VERTICALS,
} from "@/lib/address-quotes/service-verticals";
import type {
  AddressQuote,
  AddressQuoteMedia,
  AddressQuoteMeasurement,
  AddressQuotePricingLineItem,
  PropertyAddress,
} from "@/types/database";
import type { LineString, Polygon } from "geojson";

export default async function EditBidderAddressQuotePage({
  params,
  searchParams,
}: {
  params: Promise<{ quoteId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { quoteId } = await params;
  const query = await searchParams;
  const supabase = await createClient();
  const admin = createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  if (!(await userHasRole(user.id, "bidder"))) redirect("/login");

  const { data: quote } = await admin
    .from("address_quotes")
    .select("*")
    .eq("id", quoteId)
    .eq("contractor_id", user.id)
    .is("removed_at", null)
    .maybeSingle();

  if (!quote) notFound();

  const typedQuote = quote as AddressQuote;
  const [
    { data: address },
    { data: measurements },
    { data: pricingLineItems },
    { data: quoteMedia },
  ] = await Promise.all([
    admin
      .from("property_addresses")
      .select("*")
      .eq("id", typedQuote.property_address_id)
      .maybeSingle(),
    admin
      .from("address_quote_measurements")
      .select("*")
      .eq("address_quote_id", typedQuote.id)
      .order("created_at", { ascending: true }),
    admin
      .from("address_quote_pricing_line_items")
      .select("*")
      .eq("address_quote_id", typedQuote.id)
      .order("display_order", { ascending: true }),
    admin
      .from("address_quote_media")
      .select("*")
      .eq("address_quote_id", typedQuote.id)
      .order("display_order", { ascending: true }),
  ]);

  const typedAddress = address as PropertyAddress | null;
  const typedMeasurements = (measurements || []) as AddressQuoteMeasurement[];
  const typedPricingLineItems = (pricingLineItems || []) as AddressQuotePricingLineItem[];
  const typedQuoteMedia = (quoteMedia || []) as AddressQuoteMedia[];
  const mapSnapshotUrls = typedQuoteMedia
    .filter((media) => media.media_type === "map_snapshot")
    .map((media) => media.url);
  const uploadedReferencePhotos = typedQuoteMedia.filter(
    (media) => media.media_type === "uploaded_photo"
  );
  const editableMapMeasurements: InitialAddressQuoteMeasurement[] =
    typedMeasurements
      .map((measurement): InitialAddressQuoteMeasurement | null => {
        if (
          measurement.measurement_type === "polygon_area" &&
          measurement.geometry_geojson?.type === "Polygon" &&
          measurement.area_sqft
        ) {
          return {
            id: measurement.id,
            measurementType: "polygon_area",
            label: measurement.label || "Area",
            areaSqft: measurement.area_sqft,
            geometryGeojson: measurement.geometry_geojson as unknown as Polygon,
          };
        }

        if (
          measurement.measurement_type === "linear_length" &&
          measurement.geometry_geojson?.type === "LineString" &&
          measurement.length_ft
        ) {
          return {
            id: measurement.id,
            measurementType: "linear_length",
            label: measurement.label || "Line",
            lengthFt: measurement.length_ft,
            geometryGeojson: measurement.geometry_geojson as unknown as LineString,
          };
        }

        return null;
      })
      .filter(
        (measurement): measurement is InitialAddressQuoteMeasurement =>
          measurement !== null
      );
  const pricingRowsForSheet =
    typedPricingLineItems.length > 0
      ? typedPricingLineItems
      : typedQuote.quote_total_cents && typedQuote.quote_total_cents > 0
        ? ([
            {
              id: `legacy_total_${typedQuote.id}`,
              address_quote_id: typedQuote.id,
              measurement_id: null,
              item_label: "Quote total",
              description:
                "Legacy total from before detailed address quote bid sheets.",
              unit: "each",
              quantity: 1,
              amount: typedQuote.quote_total_cents / 100,
              calc_mode: "add",
              line_total: typedQuote.quote_total_cents / 100,
              display_order: 0,
              is_custom: true,
              created_at: typedQuote.created_at,
              updated_at: typedQuote.updated_at,
            },
          ] satisfies AddressQuotePricingLineItem[])
        : [];

  return (
    <div>
      <div className="mb-8">
        <Link
          href="/bidder/address-quotes"
          className="mb-4 inline-flex items-center gap-1 text-sm text-text-muted transition-colors hover:text-text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Address Quotes
        </Link>
        <h1 className="text-2xl font-bold text-text-primary">
          Edit Address Quote
        </h1>
        <p className="mt-1 text-text-secondary">
          Update quote details, map measurements, pricing, and publish status.
        </p>
      </div>

      {query.error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {query.error === "service"
            ? "Choose a valid service category."
            : query.error === "quote"
              ? "Add a title, summary, and valid quote total."
              : "This quote could not be updated. Please try again."}
        </div>
      )}

      <form
        action={updateContractorAddressQuote}
        className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]"
      >
        <input type="hidden" name="quoteId" value={typedQuote.id} />

        <div className="space-y-6">
          <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-text-primary">
              Address
            </h2>
            <p className="mt-2 text-sm leading-6 text-text-secondary">
              {typedAddress?.display_address || "Address unavailable"}
            </p>
            <p className="mt-3 text-xs text-text-muted">
              The address anchor stays locked to protect the public address
              history. Delete this quote and create a new one if the address is
              wrong.
            </p>
          </section>

          <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-text-primary">
              Quote Details
            </h2>
            <div className="mt-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-text-primary">
                  Service category *
                </label>
                <select
                  name="serviceVertical"
                  required
                  defaultValue={typedQuote.service_vertical}
                  className="mt-2 w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-text-primary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  {ADDRESS_QUOTE_SERVICE_VERTICALS.map((service) => (
                    <option key={service} value={service}>
                      {ADDRESS_QUOTE_SERVICE_LABELS[service]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-text-primary">
                  Quote title *
                </label>
                <input
                  name="title"
                  type="text"
                  required
                  defaultValue={typedQuote.title}
                  className="mt-2 w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-text-primary">
                  Public summary *
                </label>
                <textarea
                  name="summary"
                  required
                  rows={4}
                  defaultValue={typedQuote.summary}
                  className="mt-2 w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-text-primary">
                  Scope notes
                </label>
                <textarea
                  name="scopeNotes"
                  rows={4}
                  defaultValue={typedQuote.scope_notes || ""}
                  className="mt-2 w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
          </section>

          <LawnAreaMeasurementMap
            initialMeasurements={editableMapMeasurements}
            initialMapSnapshotUrl={typedQuote.map_snapshot_url}
            initialMapSnapshotUrls={mapSnapshotUrls}
            initialSearchAddress={typedAddress?.display_address}
          />

          <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
            <input
              type="hidden"
              name="existingQuoteMediaJson"
              value={JSON.stringify(typedQuoteMedia)}
            />
            <h2 className="text-lg font-semibold text-text-primary">
              Reference Photos
            </h2>
            <p className="mt-1 text-sm leading-6 text-text-secondary">
              Add more photos that help the customer understand exactly what
              property or work area this quote references.
            </p>
            {uploadedReferencePhotos.length > 0 && (
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {uploadedReferencePhotos.map((media) => (
                  <div
                    key={media.id}
                    className="overflow-hidden rounded-lg border border-border bg-bg-warm"
                  >
                    <img
                      src={media.url}
                      alt={media.caption || "Quote reference photo"}
                      className="aspect-video w-full object-cover"
                    />
                    {media.caption && (
                      <p className="px-3 py-2 text-xs font-medium text-text-secondary">
                        {media.caption}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
            <input
              name="quoteEvidenceImages"
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              multiple
              className="mt-4 w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-text-primary file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-slate-950"
            />
          </section>

          <AddressQuoteBidSheet
            initialLineItems={pricingRowsForSheet}
            syncMeasurements
          />
        </div>

        <aside className="space-y-6">
          <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-text-primary">
              Pricing
            </h2>
            <p className="mt-2 text-sm leading-6 text-text-secondary">
              Edit the bid sheet rows to update the quote total. You can price
              rows per unit with × or as flat amounts with +.
            </p>
          </section>

          <section className="rounded-xl border border-white/30 bg-primary/20 p-6">
            <h2 className="font-semibold text-white">Publish status</h2>
            <p className="mt-2 text-sm font-medium leading-6 text-white">
              Published quotes appear on the public address page. Drafts remain
              visible only in your contractor dashboard.
            </p>
            <div className="mt-5 space-y-3">
              <button
                type="submit"
                name="intent"
                value="publish"
                className="w-full rounded-lg bg-secondary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-secondary-dark"
              >
                Save and Publish
              </button>
              <button
                type="submit"
                name="intent"
                value="draft"
                className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-text-primary transition-colors hover:bg-white"
              >
                Save as Draft
              </button>
            </div>
          </section>
        </aside>
      </form>

      <section className="mt-6 rounded-xl border border-red-200 bg-red-50 p-6">
        <h2 className="font-semibold text-red-900">Delete quote</h2>
        <p className="mt-2 text-sm leading-6 text-red-800">
          Deleting removes this quote from your dashboard and from the public
          address page. Measurement history is preserved internally.
        </p>
        <form action={deleteContractorAddressQuote} className="mt-4">
          <input type="hidden" name="quoteId" value={typedQuote.id} />
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700"
          >
            <Trash2 className="h-4 w-4" />
            Delete This Quote
          </button>
        </form>
      </section>
    </div>
  );
}
