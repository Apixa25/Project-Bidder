# Public Address Quote Layer Design

## Product Decision

ProjectXBidX will add a separate product surface inside the current app: a public quote layer over real addresses.

The current marketplace in `project-vision.md` is customer-led: a customer posts a project, qualified contractors submit sealed bids, and the customer reviews those bids with trust signals, messaging, and history.

The public address quote layer is address-led: a real address becomes the opportunity container where contractors can leave free, measured quotes and where homeowners can search their address to find or request simple exterior-service quotes.

This supports the `PROJECT_PRODUCT_CHECKLIST.md` "Standard Automated Bid Verticals" direction:

- Start with repeatable services such as lawn mowing / lawn care.
- Use map-based measurements such as polygon area in square feet.
- Let contractors define standard pricing rules.
- Use AI to explain and assemble quote language, but keep measured quantities and contractor-approved rates as the pricing source of truth.

## Product Sentence

ProjectXBidX lets contractors leave free, measured quotes on real addresses, and lets homeowners search their address to find or request simple exterior-service quotes.

## Locked Product Rules

- The address is the anchor. Quotes, measurements, customer requests, removals, and future neighborhood campaigns attach to a normalized address record.
- Address quotes are public by default. Anyone who searches the address can see published quotes for that address.
- Address claiming is not required to search or view quotes.
- Address claiming is required to request quotes for an address or remove quotes from an address.
- A user can claim at most 3 addresses.
- Homeowners must have a simple way to claim their address and remove unwanted quotes.
- Contractors can create unsolicited quotes, including quote coverage across many houses in a neighborhood.
- Customer-requested quote categories should initially focus on exterior or easily observable services that do not require entering the home.
- Pricing must be backed by measured inputs and contractor-approved rules or contractor-entered values. AI must not invent price.
- The existing customer project / sealed-bid marketplace must continue working unchanged.

## Primary Users

### Contractor

The contractor uses the address quote layer as a prospecting and quoting tool.

Example:

1. A lawn and garden contractor drives through town.
2. They see an overgrown yard.
3. They open ProjectXBidX.
4. They enter the address.
5. They open a map and draw lawn polygons.
6. The app calculates measured square footage.
7. The contractor applies saved lawn pricing rules.
8. The contractor publishes a free quote on that address.
9. The contractor can optionally share a link, QR code, flyer, or postcard later.

### Homeowner / Customer

The homeowner uses the address quote layer as an address search and request surface.

Example:

1. The homeowner searches their address.
2. They see quotes contractors have left for that address.
3. They can compare prices, scope, measurements, contractor profiles, badges, and reviews.
4. They can claim the address if they want to control that address inside the app.
5. After claiming the address, they can request quote categories with simple checkboxes or remove quotes they do not want shown.

### Admin

The admin keeps the public layer healthy.

Admin should be able to:

- See every address quote.
- Moderate reported or removed quotes.
- See contractor quote volume and neighborhood campaign behavior.
- Hide abusive contractors or bad quotes.
- Audit pricing snapshots and measurement snapshots.

## MVP Service Verticals

The first service vertical should be lawn care / lawn mowing because it is repeatable, exterior, measurable from a map, and easy to explain.

Initial customer-requested categories can include:

- Lawn care.
- Exterior house painting.
- Pressure washing.
- Gutter cleaning.
- Fence staining.
- Window washing.
- Junk or yard debris cleanup.

These should be represented as stable service vertical keys so future code can branch safely by vertical.

```ts
// goldbridgebid/src/lib/address-quotes/service-verticals.ts
export type AddressQuoteServiceVertical =
  | "lawn_care"
  | "exterior_painting"
  | "pressure_washing"
  | "gutter_cleaning"
  | "fence_staining"
  | "window_washing"
  | "yard_debris_cleanup";
```

## First Build Slice

The first slice should prove the address anchor and the public quote loop without solving every future automation problem.

1. Add address quote database tables and RLS.
2. Add TypeScript domain types.
3. Add contractor dashboard routes for creating address quotes.
4. Add customer/public address search route.
5. Add manual quote entry plus manual measured square footage.
6. Add quote removal flow.
7. Add admin visibility.

Map polygon drawing and contractor pricing rules should come immediately after the manual MVP foundation, not before the address layer exists.

## Data Model

### `property_addresses`

The canonical address table. This is the source container for public quotes and customer requests.

Important fields:

- `id`
- `display_address`
- `normalized_address`
- `address_hash`
- `street`
- `city`
- `state`
- `zip`
- `latitude`
- `longitude`
- `geohash`
- `source`
- `confidence`
- `created_at`
- `updated_at`

Modeling rules:

- `normalized_address` is for deterministic matching.
- `address_hash` supports indexed lookup and helps avoid fragile string matching.
- Addresses should be created on demand when a contractor or customer searches.
- A full national address import is not required for MVP.

```sql
-- goldbridgebid/supabase/migrations/0xx_public_address_quote_layer.sql
CREATE TABLE property_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_address TEXT NOT NULL,
  normalized_address TEXT NOT NULL,
  address_hash TEXT NOT NULL UNIQUE,
  street TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  geohash TEXT,
  source TEXT NOT NULL DEFAULT 'user_search',
  confidence TEXT NOT NULL DEFAULT 'unverified',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### `address_quotes`

A public contractor quote attached to an address.

Important fields:

- `id`
- `property_address_id`
- `contractor_id`
- `service_vertical`
- `quote_source`
- `status`
- `title`
- `summary`
- `scope_notes`
- `quote_total_cents`
- `currency`
- `measurement_snapshot_json`
- `pricing_snapshot_json`
- `ai_explanation`
- `expires_at`
- `published_at`
- `removed_at`
- `created_at`
- `updated_at`

Modeling rules:

- Published quotes are visible to anyone who searches the address.
- Draft quotes are visible only to the contractor owner and admin.
- Removed quotes should stop showing publicly, but remain available to admin.
- `pricing_snapshot_json` records the exact pricing inputs used at publication time.
- `measurement_snapshot_json` records the measured area and geometry summary used at publication time.

```sql
-- goldbridgebid/supabase/migrations/0xx_public_address_quote_layer.sql
CREATE TABLE address_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_address_id UUID NOT NULL REFERENCES property_addresses(id) ON DELETE CASCADE,
  contractor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_vertical TEXT NOT NULL,
  quote_source TEXT NOT NULL DEFAULT 'contractor_unsolicited',
  status TEXT NOT NULL DEFAULT 'draft',
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  scope_notes TEXT,
  quote_total_cents INTEGER CHECK (quote_total_cents IS NULL OR quote_total_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'usd',
  measurement_snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  pricing_snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ai_explanation TEXT,
  expires_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  removed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### `address_quote_measurements`

Structured measurements for address quotes.

Important fields:

- `id`
- `address_quote_id`
- `measurement_type`
- `label`
- `geometry_geojson`
- `area_sqft`
- `source`
- `confidence`
- `created_at`

Modeling rules:

- For lawn care, polygon area in square feet is the key measurement.
- Geometry should be stored as GeoJSON in MVP to avoid requiring PostGIS immediately.
- PostGIS can be added later if neighborhood search and geospatial queries need it.

```sql
-- goldbridgebid/supabase/migrations/0xx_public_address_quote_layer.sql
CREATE TABLE address_quote_measurements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  address_quote_id UUID NOT NULL REFERENCES address_quotes(id) ON DELETE CASCADE,
  measurement_type TEXT NOT NULL,
  label TEXT,
  geometry_geojson JSONB,
  area_sqft NUMERIC(12, 2),
  source TEXT NOT NULL DEFAULT 'manual',
  confidence TEXT NOT NULL DEFAULT 'contractor_confirmed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### `address_quote_requests`

Customer-created request checkboxes for an address.

Important fields:

- `id`
- `property_address_id`
- `requester_user_id`
- `requester_email`
- `requested_services_json`
- `notes`
- `status`
- `created_at`
- `updated_at`

Modeling rules:

- A verified address claimant can attach a request to an address.
- Guest request capture should not create address-level quote requests.
- The server action must verify that `requester_user_id` owns a verified claim for `property_address_id`.
- Requested service keys should match the shared service vertical registry.

```sql
-- goldbridgebid/supabase/migrations/0xx_public_address_quote_layer.sql
CREATE TABLE address_quote_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_address_id UUID NOT NULL REFERENCES property_addresses(id) ON DELETE CASCADE,
  requester_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requester_email TEXT,
  requested_services_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### `property_address_claims`

Address control records. A claim does not affect public quote visibility; it only allows a user to request quotes for an address or remove quotes from that address.

Important fields:

- `id`
- `property_address_id`
- `user_id`
- `status`
- `verification_method`
- `evidence_notes`
- `verified_at`
- `created_at`
- `updated_at`

Modeling rules:

- A user can have at most 3 active verified or pending address claims.
- A claimed address becomes that user's address for quote-request and quote-removal controls.
- Claims should start as `pending` unless an admin or future automated verification method approves them.
- Public quote lookup never requires a claim.
- The 3-address limit should be enforced in the claim-request server action and backed by a database trigger or RPC before public launch.

```sql
-- goldbridgebid/supabase/migrations/0xx_public_address_quote_layer.sql
CREATE TABLE property_address_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_address_id UUID NOT NULL REFERENCES property_addresses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  verification_method TEXT NOT NULL DEFAULT 'admin_review',
  evidence_notes TEXT,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (property_address_id, user_id)
);
```

### `address_quote_removal_requests`

Verified address claimant quote removal requests.

Important fields:

- `id`
- `address_quote_id`
- `property_address_id`
- `requester_user_id`
- `requester_email`
- `reason`
- `status`
- `created_at`
- `resolved_at`

Product rule:

- Only a verified address claimant for the quote's address can request quote removal.
- The server action must verify that `requester_user_id` owns a verified claim for `property_address_id`.
- Removal should hide the quote publicly and leave a moderation record for admin.
- The contractor should be able to see that the quote was removed, but should not be able to republish the same quote without a new admin-visible record.

```sql
-- goldbridgebid/supabase/migrations/0xx_public_address_quote_layer.sql
CREATE TABLE address_quote_removal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  address_quote_id UUID NOT NULL REFERENCES address_quotes(id) ON DELETE CASCADE,
  property_address_id UUID NOT NULL REFERENCES property_addresses(id) ON DELETE CASCADE,
  requester_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requester_email TEXT,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'auto_hidden',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);
```

## Access Rules

RLS and server authorization should enforce:

- Anyone can read published, non-removed address quotes.
- Anyone can search or create address records through controlled server actions.
- Contractors can create and manage their own draft quotes.
- Contractors can publish their own quotes.
- Contractors can see removed status for their own quotes.
- Logged-in users can request to claim addresses, up to 3 active pending or verified claims.
- Verified address claimants can request quotes for their claimed addresses.
- Verified address claimants can remove quotes from their claimed addresses.
- Admins can see all addresses, quotes, requests, measurements, and removals.

Public access should be intentionally narrow:

- Public readers can see published quote details.
- Public readers should not see internal admin notes, requester emails, raw moderation metadata, or draft quotes.

## Address Search Strategy

Do not import a national property/address database for the first build.

MVP search flow:

1. User enters address text.
2. Server normalizes the address.
3. Server attempts to geocode it.
4. Server computes `address_hash`.
5. Server returns the existing `property_addresses` row or creates a new row.

Later:

- Add better address autocomplete.
- Add neighborhood/street search.
- Add bulk campaign address creation.
- Add public parcel/address datasets by region where useful.

## Contractor Flow

Initial route map:

```txt
// goldbridgebid/src/app/(dashboard)/bidder/address-quotes/page.tsx
Contractor address quote list.

// goldbridgebid/src/app/(dashboard)/bidder/address-quotes/new/page.tsx
Create a quote for one address.

// goldbridgebid/src/app/(dashboard)/bidder/address-quotes/[id]/page.tsx
Review, edit, publish, expire, or duplicate one quote.
```

MVP contractor steps:

1. Search or enter address.
2. Select service vertical.
3. Enter measured quantity manually.
4. Enter quote total manually.
5. Add scope notes and summary.
6. Publish.

Next contractor steps:

1. Draw map polygons.
2. Save measured area from map.
3. Apply saved pricing rules.
4. Generate AI explanation from the measurement and pricing snapshot.
5. Batch repeat across nearby addresses.

## Customer / Public Flow

Initial route map:

```txt
// goldbridgebid/src/app/address-quotes/page.tsx
Public address quote search.

// goldbridgebid/src/app/address-quotes/[addressId]/page.tsx
Public quote results for one address.

// goldbridgebid/src/app/address-quotes/[addressId]/request/page.tsx
Customer checkbox request flow.
```

Customer steps:

1. Search address.
2. See published quotes for that address.
3. Compare contractor names, business names, badges, reputation, scope, measured quantity, and price.
4. Log in to claim the address if they want to control it.
5. Once the claim is verified, request new quote categories with simple checkboxes.
6. Once the claim is verified, remove unwanted quotes from that address.
7. Log in when needed to message, save, or formally request contractor follow-up.

## Admin Flow

Initial route map:

```txt
// goldbridgebid/src/app/(dashboard)/admin/address-quotes/page.tsx
Admin list of address quotes.

// goldbridgebid/src/app/(dashboard)/admin/address-quotes/[id]/page.tsx
Admin quote detail and moderation.

// goldbridgebid/src/app/(dashboard)/admin/address-quotes/removals/page.tsx
Removal requests and moderation queue.
```

Admin should be able to:

- View all published, draft, removed, expired, and reported quotes.
- Filter by contractor, address, city, service vertical, status, and date.
- Hide/unhide quotes.
- Review removal patterns.
- Identify contractors creating abusive or low-quality quote campaigns.

## Lawn Care Pricing Model

The first automated pricing model should be contractor-owned.

Contractor rule fields:

- Minimum visit price.
- Rate per 1,000 square feet.
- Overgrowth multiplier.
- Edging add-on.
- Cleanup add-on.
- Recurring service discount.
- Optional notes and exclusions.

```ts
// goldbridgebid/src/lib/address-quotes/lawn-care-pricing.ts
export interface LawnCarePricingRule {
  minimumVisitCents: number;
  ratePerThousandSqftCents: number;
  overgrowthMultiplier: number;
  edgingCents: number;
  cleanupCents: number;
  recurringDiscountPercent: number;
}

export interface LawnCareQuoteInput {
  measuredAreaSqft: number;
  includesEdging: boolean;
  includesCleanup: boolean;
  isRecurring: boolean;
}
```

Pricing rule:

```ts
// goldbridgebid/src/lib/address-quotes/lawn-care-pricing.ts
const basePrice = Math.max(
  rule.minimumVisitCents,
  (input.measuredAreaSqft / 1000) * rule.ratePerThousandSqftCents
);
```

AI explanation can say what the quote includes and how the measurement was used. It must not invent the price.

## Map Measurement Strategy

MVP can begin with manual square footage so the address layer ships quickly.

Map measurement should follow as the second implementation slice.

Recommended approach:

- Use a client-side map component.
- Let contractors draw one or more polygons.
- Calculate area in square feet client-side.
- Store the polygon geometry as GeoJSON.
- Store the calculated area snapshot on the quote.

Candidate libraries:

- MapLibre GL for interactive maps.
- Turf.js for polygon area calculations.
- A tile provider or open map tiles depending on cost and terms.

Avoid binding the core schema to one map provider. Store provider-neutral GeoJSON and measured square footage.

## Removal Flow

Address claim verification is required to remove quotes.

MVP removal flow:

1. User searches the address and sees public quotes.
2. User logs in and claims the address if it is one of their addresses.
3. The claim is approved by admin review in the first build.
4. Verified claimant clicks "Remove this quote."
5. Quote status becomes `removed`.
6. Public address page stops showing the quote.
7. Admin gets a moderation record.
8. Contractor sees that the quote was removed.

This matches the product goal: estimates are public and easy to discover, while address-level control belongs only to the user who has claimed that address.

## Relationship To Existing Project/Bid Flow

The address quote layer should not replace `projects` or `bids`.

Instead:

- `address_quotes` are public, address-led prospect quotes.
- `projects` remain customer-posted work requests.
- `bids` remain sealed contractor submissions on customer projects.

Future conversion flow:

1. Homeowner finds an address quote.
2. Homeowner contacts contractor or requests updated quote.
3. If needed, the quote can become a normal ProjectXBidX project or message thread.
4. The existing trust, messaging, credentials, and review surfaces continue to matter.

## Build Milestones

### Milestone 1: Address Quote Foundation

- Add tables for addresses, address claims, quotes, measurements, customer requests, and removals.
- Add TypeScript types.
- Add service vertical registry.
- Add server actions for address normalization/search/create.
- Add public address quote search page.
- Add address claim request flow with a 3-address limit per user.
- Add contractor manual quote creation page.
- Add public quote detail cards.
- Add verified-claimant removal button and hide behavior.
- Add admin list/detail views.

### Milestone 2: Lawn Care Measurement

- Add map component for drawing lawn polygons.
- Store polygon GeoJSON and area square footage.
- Show measured area on contractor and public quote views.
- Add manual measurement fallback.

### Milestone 3: Contractor Pricing Rules

- Add contractor pricing settings for lawn care.
- Calculate quote totals from contractor rules plus measured area.
- Store pricing snapshots on published quotes.
- Keep manual override available with a reason/note.

### Milestone 4: Customer Quote Requests

- Add checkbox request flow for exterior service categories on verified claimed addresses.
- Show customer requests to contractors by address, city, and service vertical.
- Let contractors respond with address quotes.

### Milestone 5: Neighborhood Campaigns

- Let contractors create a neighborhood quote campaign.
- Add multiple addresses to a campaign.
- Duplicate quote settings across addresses.
- Track campaign progress.
- Add share links, QR codes, and printable flyers.

### Milestone 6: Conversion And Messaging

- Let customers message contractors from address quotes.
- Let a quote convert into a normal project or contractor engagement.
- Add notifications for quote interest, removals, and customer requests.

## Open Questions

- Should published address quotes expire by default after 30, 60, or 90 days?
- Should contractors be limited to specific service areas based on their profile radius?
- What evidence should a user provide when claiming an address in the first admin-reviewed version?
- Should public quote pages show exact dollar amounts before login?
- What should the first map provider be?
- How much admin moderation is needed before neighborhood-scale quoting goes live?

## Recommended First Implementation

Start with Milestone 1 using manual measured quantities and manual quote totals.

That creates the address database, public search surface, address claim controls, contractor quote creation flow, and verified-claimant removal behavior. Once the address anchor is real, map measurement and contractor pricing rules can be added cleanly without reworking the product model.
