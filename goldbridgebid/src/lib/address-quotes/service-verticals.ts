export type AddressQuoteServiceVertical =
  | "lawn_care"
  | "exterior_painting"
  | "pressure_washing"
  | "gutter_cleaning"
  | "fence_staining"
  | "window_washing"
  | "yard_debris_cleanup";

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

export const ADDRESS_QUOTE_SERVICE_VERTICALS: AddressQuoteServiceVertical[] = [
  "lawn_care",
  "exterior_painting",
  "pressure_washing",
  "gutter_cleaning",
  "fence_staining",
  "window_washing",
  "yard_debris_cleanup",
];

export function isAddressQuoteServiceVertical(
  value: string
): value is AddressQuoteServiceVertical {
  return ADDRESS_QUOTE_SERVICE_VERTICALS.includes(
    value as AddressQuoteServiceVertical
  );
}
