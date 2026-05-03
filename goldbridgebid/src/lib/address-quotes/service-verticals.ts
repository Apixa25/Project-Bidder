export type AddressQuoteServiceVertical =
  | "lawn_care"
  | "exterior_painting"
  | "pressure_washing"
  | "gutter_cleaning"
  | "fence_staining"
  | "window_washing"
  | "yard_debris_cleanup";

export type AddressQuoteRequestServiceVertical =
  | AddressQuoteServiceVertical
  | "lawn_mowing"
  | "snow_removal"
  | "weed_pulling"
  | "leaf_raking";

export const ADDRESS_QUOTE_SERVICE_LABELS: Record<
  AddressQuoteServiceVertical,
  string
> = {
  lawn_care: "Lawn Care",
  exterior_painting: "Exterior House Painting",
  pressure_washing: "Pressure Washing",
  gutter_cleaning: "Gutter Cleaning",
  fence_staining: "Fence Staining",
  window_washing: "Window Washing",
  yard_debris_cleanup: "Junk / Yard Debris Cleanup",
};

export const ADDRESS_QUOTE_REQUEST_SERVICE_LABELS: Record<
  AddressQuoteRequestServiceVertical,
  string
> = {
  ...ADDRESS_QUOTE_SERVICE_LABELS,
  lawn_care: "General Lawn Care",
  lawn_mowing: "Lawn Mowed",
  gutter_cleaning: "Gutters Cleaned",
  snow_removal: "Snow Removed",
  weed_pulling: "Weeds Pulled",
  leaf_raking: "Leaves Raked",
  pressure_washing: "Pressure Washing",
  window_washing: "Window Washing",
  yard_debris_cleanup: "Yard Debris Cleanup",
  fence_staining: "Fence Staining",
  exterior_painting: "Exterior House Painting",
};

export const ADDRESS_QUOTE_SERVICE_VERTICALS: AddressQuoteServiceVertical[] = [
  "lawn_care",
  "exterior_painting",
  "pressure_washing",
  "gutter_cleaning",
  "fence_staining",
  "window_washing",
  "yard_debris_cleanup",
];

export const ADDRESS_QUOTE_REQUEST_SERVICE_VERTICALS: AddressQuoteRequestServiceVertical[] =
  [
    "lawn_mowing",
    "gutter_cleaning",
    "snow_removal",
    "weed_pulling",
    "leaf_raking",
    "pressure_washing",
    "window_washing",
    "yard_debris_cleanup",
    "fence_staining",
    "exterior_painting",
  ];

export function isAddressQuoteServiceVertical(
  value: string
): value is AddressQuoteServiceVertical {
  return ADDRESS_QUOTE_SERVICE_VERTICALS.includes(
    value as AddressQuoteServiceVertical
  );
}

export function isAddressQuoteRequestServiceVertical(
  value: string
): value is AddressQuoteRequestServiceVertical {
  return ADDRESS_QUOTE_REQUEST_SERVICE_VERTICALS.includes(
    value as AddressQuoteRequestServiceVertical
  );
}

export function formatAddressQuoteRequestServices(services: unknown) {
  if (!Array.isArray(services)) return "Requested services";

  const labels = services
    .filter((service): service is AddressQuoteRequestServiceVertical =>
      typeof service === "string" && isAddressQuoteRequestServiceVertical(service)
    )
    .map((service) => ADDRESS_QUOTE_REQUEST_SERVICE_LABELS[service]);

  return labels.length > 0 ? labels.join(", ") : "Requested services";
}
