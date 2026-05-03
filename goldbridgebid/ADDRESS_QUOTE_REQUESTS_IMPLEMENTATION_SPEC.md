# Address Quote Requests v1 Implementation Spec

This document turns the agreed customer-request side of Address Quotes into a codebase-specific build plan for `ProjectXBidX.com`.

It is intentionally additive. The goal is to complete the other half of the existing address quote layer in `goldbridgebid/` without breaking contractor-created public address quotes, customer project posting, sealed bidding, messaging, notifications, or admin review flows.

## 1. Vision Alignment

This implementation follows the product direction in `../project-vision.md`:

- ProjectXBidX.com connects customers who need work with qualified contractors who want to quote or bid.
- Customers should be able to express demand from their own property, not only wait for contractors to leave unsolicited quotes.
- Contractors should be able to browse nearby opportunities by address and service category.
- The address quote system stays practical, lightweight, and useful for fast exterior/property services.

Important wording decision:

- Use `address quote request`, `quick quote request`, and `My Address Requests`.
- Avoid making these feel like full construction projects. Larger, detailed scopes should still use the existing project posting flow.

## 2. Locked v1 Product Decisions

- A customer may intentionally expose an address when creating an address quote request.
- Address exposure is treated as customer consent because the customer is choosing to say, "This is my house, and this is what I need quoted."
- Implemented policy: customers can save one self-declared address for address quote requests without waiting for admin verification.
- The current code stores that saved customer address in `property_address_claims` and marks it usable immediately.
- A customer can have multiple open service requests on their saved address.
- Requests are visible to logged-in contractors/bidders.
- Contractors should see request locations on a map as red markers.
- Existing contractor-created public address quote markers should remain visually distinct from customer request markers.
- Quick quote requests are for simple, repeatable services first.
- Contractor responses to customer requests should be private to the requesting customer, not automatically published as public address quotes.
- Admin should be able to see, moderate, close, or remove quote requests.

## 3. Existing Code Surfaces To Extend

The current implementation already has the right foundation.

### Existing public address quote search

```txt
goldbridgebid/src/app/address-quotes/page.tsx
goldbridgebid/src/components/address-quotes/AddressQuoteDiscoveryMap.tsx
```

Current use:

- public search by address
- map of addresses with published contractor quotes
- numbered markers showing quote counts

Needed extension:

- optionally introduce a combined discovery map later, but keep v1 contractor request discovery inside the bidder dashboard first

### Existing address detail page

```txt
goldbridgebid/src/app/address-quotes/[addressId]/page.tsx
```

Current use:

- view public contractor quotes for one property address
- save one customer address
- saved address customers can request quote categories
- saved address customers can remove unwanted public quotes

Needed extension:

- improve the saved address request UI
- show richer request status and notes
- link customers toward `My Address Requests`

### Existing address quote actions

```txt
goldbridgebid/src/lib/address-quotes/actions.ts
```

Current use:

- create contractor address quote
- search and geocode addresses
- save property address
- insert `address_quote_requests`
- remove address quotes from saved addresses

Needed extension:

- add customer dashboard request actions
- add contractor response actions
- add close/remove actions for request owners and admins

### Existing address quote service catalog

```txt
goldbridgebid/src/lib/address-quotes/service-verticals.ts
```

Current use:

- shared address quote service identifiers and labels

Needed extension:

- expand simple customer-facing quick request labels
- keep stable enum-like string values for stored data

### Existing dashboard navigation

```txt
goldbridgebid/src/components/layout/DashboardNav.tsx
```

Current use:

- customer nav links to public `Address Quotes`
- bidder nav links to `/bidder/address-quotes`
- admin nav links to `/admin/address-quotes`

Needed extension:

- add customer `My Address Requests`
- add bidder `Open Address Requests`
- optionally keep both under the broader Address Quotes product area

### Existing database/types

```txt
goldbridgebid/supabase/migrations/050_public_address_quote_layer.sql
goldbridgebid/supabase/migrations/051_address_quote_measurement_proof.sql
goldbridgebid/supabase/migrations/052_address_quote_pricing_line_items.sql
goldbridgebid/supabase/migrations/055_address_quote_media.sql
goldbridgebid/src/types/database.ts
```

Current use:

- property addresses
- address claims
- public address quotes
- quote measurements, pricing line items, and media
- address quote requests
- address quote removal requests

Needed extension:

- add response table for contractor quick quotes against customer requests
- add request metadata fields for timing, expiry, photos, and optional lifecycle details

## 4. Architectural Strategy

Do not create a separate "customer quick jobs" system.

Use the existing address quote layer:

1. `property_addresses` remains the normalized address object.
2. `property_address_claims` remains the saved-address control gate, with one active customer address in v1.
3. `address_quote_requests` stores customer demand for quick quotes.
4. A new response table stores contractor quick quote responses.
5. Existing `address_quotes` remains the public contractor-created quote object.

This keeps the product understandable:

- contractor-created quote: "I can do this work at this address for this price"
- customer-created request: "I need this work quoted at my address"
- contractor response: "Here is my private quote for your request"

## 5. Proposed Database Additions

Create a new migration:

```txt
goldbridgebid/supabase/migrations/056_address_quote_requests_v1.sql
```

### Extend `address_quote_requests`

Purpose:

- represent customer-created demand for one saved customer address
- allow contractors to discover active nearby opportunities

Suggested new fields:

- `title`
- `desired_timing`
- `expires_at`
- `closed_at`
- `removed_at`
- `photo_urls`
- `visibility`
- `response_count`
- `selected_response_id`

Suggested values:

```ts
// goldbridgebid/src/types/database.ts
type AddressQuoteRequestTiming =
  | "asap"
  | "this_week"
  | "this_month"
  | "flexible";

type AddressQuoteRequestVisibility =
  | "contractors_only"
  | "public_preview";
```

V1 default:

- `desired_timing`: `flexible`
- `visibility`: `contractors_only`
- `expires_at`: 30 days after creation

### New table: `address_quote_request_responses`

Purpose:

- stores contractor responses to customer-created address quote requests
- keeps quick quote responses private to the requesting customer

Suggested fields:

- `id`
- `request_id`
- `property_address_id`
- `contractor_id`
- `quote_total_cents`
- `timeline`
- `message`
- `status`
- `created_at`
- `updated_at`
- `withdrawn_at`
- `selected_at`

Suggested statuses:

```ts
// goldbridgebid/src/types/database.ts
type AddressQuoteRequestResponseStatus =
  | "submitted"
  | "withdrawn"
  | "selected"
  | "declined";
```

Recommended constraints:

- one active response per contractor per request
- response must reference an open request
- response must reference the same `property_address_id` as the request

### Optional table: `address_quote_request_media`

Purpose:

- stores customer-uploaded photos for quick quote requests
- avoids overloading JSON arrays if request photos become important

Suggested fields:

- `id`
- `request_id`
- `requester_user_id`
- `url`
- `caption`
- `display_order`
- `created_at`

V1 shortcut:

- If we want faster implementation, use `photo_urls` JSON first and add this table later.

## 6. Service Catalog Expansion

Extend the current quick-service set.

Current file:

```txt
goldbridgebid/src/lib/address-quotes/service-verticals.ts
```

Recommended v1 service labels:

```ts
// goldbridgebid/src/lib/address-quotes/service-verticals.ts
export type AddressQuoteServiceVertical =
  | "lawn_mowing"
  | "gutter_cleaning"
  | "snow_removal"
  | "weed_pulling"
  | "leaf_raking"
  | "pressure_washing"
  | "window_washing"
  | "yard_debris_cleanup"
  | "fence_staining"
  | "exterior_painting";
```

Recommended UI labels:

- Lawn mowed
- Gutters cleaned
- Snow removed
- Weeds pulled
- Leaves raked
- Pressure washing
- Window washing
- Yard debris cleanup
- Fence staining
- Exterior house painting

Backward compatibility note:

- Existing `lawn_care` data should either continue to display as `Lawn Care` or be migrated to `lawn_mowing`.
- Prefer preserving existing values in v1 unless there is no production data to protect.

## 7. Customer UX

### New page: `My Address Requests`

Add:

```txt
goldbridgebid/src/app/(dashboard)/customer/address-requests/page.tsx
```

Purpose:

- show the customer's saved address
- show open/closed address quote requests
- create new quick quote requests from the saved address
- view contractor responses

Primary sections:

- `My customer address`
- `Open address requests`
- `Create quick quote request`
- `Contractor responses`

Empty state:

- If no saved address exists, direct the customer to look up and save one address.
- If a saved address exists but no requests exist, show the default quick service checklist.

### Request creation form

Required:

- saved customer address
- at least one requested service

Optional:

- notes
- desired timing
- photos

Simplified form shape:

```tsx
// goldbridgebid/src/app/(dashboard)/customer/address-requests/page.tsx
<form action={createCustomerAddressQuoteRequest}>
  <select name="propertyAddressId" required />
  <input type="checkbox" name="services" value="lawn_mowing" />
  <input type="checkbox" name="services" value="gutter_cleaning" />
  <input type="checkbox" name="services" value="snow_removal" />
  <textarea name="notes" />
  <button type="submit">Request Quick Quotes</button>
</form>
```

### Customer response review

For each request, show:

- requested services
- address
- notes
- desired timing
- status
- response count
- contractor responses

For each contractor response, show:

- contractor business name
- badge/credential summary if available
- quote price
- timeline
- message
- contact options
- select/close action

## 8. Contractor UX

### New page: `Open Address Requests`

Add:

```txt
goldbridgebid/src/app/(dashboard)/bidder/address-requests/page.tsx
```

Purpose:

- let contractors discover active customer address quote requests
- filter by service category
- view map/list of nearby request opportunities
- submit quick quote responses

Primary sections:

- request map
- service filters
- open request list
- submitted responses

List card should show:

- address
- requested services
- customer notes
- desired timing
- request age
- number of submitted responses if visible
- `Submit Quick Quote`

### Request map

Add a new component:

```txt
goldbridgebid/src/components/address-quotes/AddressQuoteRequestMap.tsx
```

Behavior:

- use the existing MapLibre pattern
- red markers represent customer requests
- existing public quote map markers remain separate
- marker popup links to the request detail/response form

Simplified marker model:

```ts
// goldbridgebid/src/components/address-quotes/AddressQuoteRequestMap.tsx
type RequestMapMarker = {
  requestId: string;
  propertyAddressId: string;
  displayAddress: string;
  latitude: number;
  longitude: number;
  requestedServices: string[];
  responseCount: number;
};
```

### Contractor response form

Add:

```txt
goldbridgebid/src/app/(dashboard)/bidder/address-requests/[requestId]/page.tsx
```

Required:

- quote amount
- timeline

Optional:

- message
- attachments later

Simplified form shape:

```tsx
// goldbridgebid/src/app/(dashboard)/bidder/address-requests/[requestId]/page.tsx
<form action={submitAddressQuoteRequestResponse}>
  <input type="hidden" name="requestId" value={request.id} />
  <input name="quoteTotalDollars" required />
  <input name="timeline" required />
  <textarea name="message" />
  <button type="submit">Submit Quick Quote</button>
</form>
```

## 9. Admin UX

Extend:

```txt
goldbridgebid/src/app/(dashboard)/admin/address-quotes/page.tsx
```

Add sections:

- open customer address requests
- recently closed requests
- removed requests
- request responses by contractor

Admin actions:

- close request
- remove request
- restore request if removed by mistake
- inspect responses
- revoke address claim if abuse is detected

Admin moderation note:

- Since customers intentionally expose addresses in this flow, admin moderation should focus on abuse, spam, bad actors, and obviously fake/unsafe content rather than hiding normal address visibility.

## 10. Server Actions

Extend:

```txt
goldbridgebid/src/lib/address-quotes/actions.ts
```

Add actions:

- `createCustomerAddressQuoteRequest`
- `closeCustomerAddressQuoteRequest`
- `removeCustomerAddressQuoteRequest`
- `submitAddressQuoteRequestResponse`
- `withdrawAddressQuoteRequestResponse`
- `selectAddressQuoteRequestResponse`
- `adminRemoveAddressQuoteRequest`
- `adminRestoreAddressQuoteRequest`

Important authorization rules:

- requester must be logged in
- requester must have the address saved as their one customer address
- contractor response requires bidder role
- contractor cannot respond to closed/removed requests
- contractor can only edit/withdraw their own response
- customer can only view responses to their own saved-address requests
- admin can view all requests and responses

## 11. Notifications

Add notification events:

- customer creates address quote request
- contractor submits quick quote response
- customer selects a response
- customer closes request
- admin removes request

Suggested notification copy:

- `New quick quote request near you`
- `A contractor responded to your address request`
- `Your quick quote was selected`
- `This address request has closed`

Notification implementation should reuse the existing notification table and dashboard notification surfaces rather than introduce a new notification system.

## 12. Route Plan

Customer:

```txt
goldbridgebid/src/app/(dashboard)/customer/address-requests/page.tsx
goldbridgebid/src/app/(dashboard)/customer/address-requests/[requestId]/page.tsx
```

Bidder:

```txt
goldbridgebid/src/app/(dashboard)/bidder/address-requests/page.tsx
goldbridgebid/src/app/(dashboard)/bidder/address-requests/[requestId]/page.tsx
```

Admin:

```txt
goldbridgebid/src/app/(dashboard)/admin/address-quotes/page.tsx
```

Shared components:

```txt
goldbridgebid/src/components/address-quotes/AddressQuoteRequestMap.tsx
goldbridgebid/src/components/address-quotes/AddressQuoteRequestCard.tsx
goldbridgebid/src/components/address-quotes/AddressQuoteRequestResponseCard.tsx
```

Shared helpers:

```txt
goldbridgebid/src/lib/address-quotes/actions.ts
goldbridgebid/src/lib/address-quotes/service-verticals.ts
```

## 13. Build Milestones

### Milestone 1: Customer request dashboard

- Add `My Address Requests` customer nav item.
- Add `/customer/address-requests`.
- Show the customer's saved address.
- Show existing `address_quote_requests`.
- Create requests from the saved address.
- Expand service labels.

Acceptance criteria:

- customer can create a request from their one saved address
- customer cannot create a request for a different address
- customer can see their open requests
- existing public address quote flow still works

### Milestone 2: Contractor request list

- Add `Open Address Requests` bidder nav item.
- Add `/bidder/address-requests`.
- List open requests.
- Filter by service.
- Link to response page.

Acceptance criteria:

- bidder can see open customer requests
- bidder can filter requests by requested service
- bidder cannot see removed/closed requests as active opportunities

### Milestone 3: Contractor responses

- Added `address_quote_request_responses`.
- Added response submission action.
- Added customer response review UI.
- Added select/close workflow.

Acceptance criteria:

- bidder can submit one active response per request
- customer can view responses to their own request
- customer can select a response
- selected response closes the request

### Milestone 4: Red-dot request map

- Add `AddressQuoteRequestMap`.
- Show open request markers as red dots.
- Add popup summary and response link.
- Keep public quote markers visually distinct.

Acceptance criteria:

- bidder sees red markers for open customer requests
- marker opens a request detail/response path
- map handles no-request empty state gracefully

### Milestone 5: Admin moderation and notifications

- Add admin request overview.
- Add request removal/restore actions.
- Add notifications for response and selection events.

Acceptance criteria:

- admin can review active and removed requests
- customer gets notified when a contractor responds
- bidder gets notified when their response is selected

## 14. Privacy and Consent Rule

V1 product rule:

Customer-created address quote requests intentionally expose the address to contractors because the customer is requesting quotes for that address.

This is different from accidentally leaking private data. The customer is taking a deliberate action:

```txt
This is my address. These are the quick services I want quoted.
```

Recommended UI confirmation:

```txt
Contractors will be able to see this address so they can prepare a quick quote.
```

No additional privacy gate is required in v1 beyond:

- logged-in customer
- one customer-owned/self-declared address
- explicit request submission

## 15. Open Questions

- Should contractors see exact address immediately, or only after opening the request detail page?
- Should the public `/address-quotes` map ever show customer requests, or should customer requests stay contractor-dashboard-only?
- Should customers be able to change their saved address later, and should that require admin review?
- Should a selected contractor response create a message thread automatically?
- Should closed requests remain visible to contractors who responded?

Recommended v1 answers:

- Show exact addresses to logged-in contractors.
- Keep customer request dots off the public page in v1.
- Use one self-declared customer address per account as the request gate.
- Create or link to a message thread after customer selection.
- Let responding contractors see closed requests they participated in.

## 16. Testing Plan

Manual test paths:

- customer with no saved address sees save-address guidance
- customer with one saved address can create request immediately
- customer cannot create requests for a second address
- customer can see created request in `My Address Requests`
- bidder can see open request in list
- bidder can see open request as red map marker
- bidder can submit quick quote response
- customer can review response
- customer can select response
- admin can remove request

Automated test targets if this repo adds route/action tests later:

- service validation rejects unknown service values
- request creation rejects an address that is not the customer's saved address
- response creation rejects non-bidder users
- response creation rejects closed requests
- duplicate active response is blocked

## 17. Recommended First Implementation Slice

Build the smallest useful vertical slice first:

1. Expand quick service labels.
2. Add `/customer/address-requests`.
3. Add customer nav item `My Address Requests`.
4. Reuse existing `address_quote_requests` insert behavior.
5. Add `/bidder/address-requests` list view.
6. Add red-dot map after the list view works.

This gives ProjectXBidX.com the full address quote loop quickly:

- contractors can leave unsolicited quotes
- customers can request quick quotes
- contractors can discover active customer demand
