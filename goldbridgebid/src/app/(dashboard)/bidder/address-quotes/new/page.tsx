import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { userHasRole } from "@/lib/auth/roles";
import { createManualAddressQuote } from "@/lib/address-quotes/actions";
import AddressQuoteBidSheet from "@/components/address-quotes/AddressQuoteBidSheet";
import LawnAreaMeasurementMap from "@/components/address-quotes/LawnAreaMeasurementMap";
import {
  ADDRESS_QUOTE_SERVICE_LABELS,
  ADDRESS_QUOTE_SERVICE_VERTICALS,
} from "@/lib/address-quotes/service-verticals";

export default async function NewBidderAddressQuotePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const query = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  if (!(await userHasRole(user.id, "bidder"))) redirect("/login");

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
          Create Address Quote
        </h1>
        <p className="mt-1 text-text-secondary">
          Publish a free quote on a real address with map-measured areas,
          length line items, and a screenshot proof image.
        </p>
      </div>

      {query.error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {query.error === "address"
            ? "Enter a fuller address before saving this quote."
            : query.error === "service"
              ? "Choose a valid service category."
              : query.error === "quote"
                ? "Add a title, summary, and valid quote total."
                : "This quote could not be saved. Please try again."}
        </div>
      )}

      <form
        action={createManualAddressQuote}
        className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]"
      >
        <div className="space-y-6">
          <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-secondary" />
              <h2 className="text-lg font-semibold text-text-primary">
                Address
              </h2>
            </div>
            <div className="mt-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-text-primary">
                  Full address *
                </label>
                <input
                  name="displayAddress"
                  type="text"
                  required
                  placeholder="123 Front St, Crescent City, CA 95531"
                  className="mt-2 w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-6">
                <div className="sm:col-span-3">
                  <label className="block text-sm font-semibold text-text-primary">
                    Street
                  </label>
                  <input
                    name="street"
                    type="text"
                    placeholder="123 Front St"
                    className="mt-2 w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-sm font-semibold text-text-primary">
                    City
                  </label>
                  <input
                    name="city"
                    type="text"
                    placeholder="Crescent City"
                    className="mt-2 w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-semibold text-text-primary">
                    State
                  </label>
                  <input
                    name="state"
                    type="text"
                    placeholder="CA"
                    maxLength={2}
                    className="mt-2 w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-semibold text-text-primary">
                    ZIP
                  </label>
                  <input
                    name="zip"
                    type="text"
                    placeholder="95531"
                    className="mt-2 w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
            </div>
          </section>

          <LawnAreaMeasurementMap />

          <AddressQuoteBidSheet />

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
                  defaultValue="lawn_care"
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
                  placeholder="Lawn mowing and cleanup quote"
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
                  placeholder="Describe the work included in this public quote."
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
                  placeholder="Add exclusions, assumptions, or details the homeowner should know."
                  className="mt-2 w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-text-primary">
              Pricing
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              Use the bid sheet to price measured rows and hand-entered rows.
              The sheet total becomes the quote total.
            </p>
          </section>

          <section className="rounded-xl border border-white/30 bg-primary/20 p-6">
            <h2 className="font-semibold text-white">Publish status</h2>
            <p className="mt-2 text-sm font-medium leading-6 text-white">
              Drafts stay in your contractor dashboard. Published quotes become
              visible on the public address page.
            </p>
            <div className="mt-5 space-y-3">
              <button
                type="submit"
                name="intent"
                value="publish"
                className="w-full rounded-lg bg-secondary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-secondary-dark"
              >
                Publish Public Quote
              </button>
              <button
                type="submit"
                name="intent"
                value="draft"
                className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-text-primary transition-colors hover:bg-white"
              >
                Save Draft
              </button>
            </div>
          </section>
        </aside>
      </form>
    </div>
  );
}
