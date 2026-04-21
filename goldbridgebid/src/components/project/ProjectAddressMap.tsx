"use client";

import { ExternalLink, MapPin } from "lucide-react";

/**
 * Props for {@link ProjectAddressMap}.
 *
 * The component takes the four loose address fields stored on a project
 * (`location_address`, `location_city`, `location_state`, `location_zip`) and
 * renders an interactive Google Maps embed pointing at that address, plus a
 * small "Open in Google Maps" link that launches the full Google Maps app /
 * site in a new tab.
 *
 * The embed uses Google Maps' free, no-API-key iframe endpoint
 * (`https://www.google.com/maps?q=…&output=embed`), so this component does NOT
 * require a Google Maps API key, billing setup, environment variables, or any
 * extra npm dependency. It's purely additive — drop it next to any address
 * block in the app.
 */
export interface ProjectAddressMapProps {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  /**
   * Height of the embedded map in pixels. Defaults to 180, which fits
   * comfortably in the sidebar layouts used across the bidder/customer/admin
   * project detail pages.
   */
  heightPx?: number;
  /**
   * Optional small heading rendered above the map. Defaults to "Project
   * Location". Pass an empty string to suppress.
   */
  heading?: string;
  /**
   * What clicking the "Open in Google Maps" link does:
   *  - "directions" — Opens turn-by-turn directions FROM the user's current
   *    location TO the project address (best for contractors driving to a job
   *    site — this is the default).
   *  - "view"       — Opens the location pin in Google Maps without a route.
   */
  linkBehavior?: "directions" | "view";
  /**
   * Optional extra class names for the outer container, useful when the
   * caller wants to tweak spacing.
   */
  className?: string;
  /**
   * Optional override for the link label. Defaults to "Get Directions" when
   * `linkBehavior` is "directions" and "Open in Google Maps" when it is
   * "view".
   */
  linkLabel?: string;
}

/**
 * Concatenate the loose address fields into a single, geocoder-friendly
 * string. Returns `null` if there's nothing meaningful to map.
 */
function buildFullAddress(
  address?: string | null,
  city?: string | null,
  state?: string | null,
  zip?: string | null
): string | null {
  const parts = [address, city, state, zip]
    .map((p) => (typeof p === "string" ? p.trim() : ""))
    .filter((p) => p.length > 0);
  if (parts.length === 0) return null;
  return parts.join(", ");
}

/**
 * Interactive Google Maps embed for a project address.
 *
 * Renders nothing (returns `null`) if the address is empty, so it's safe to
 * place unconditionally in any layout.
 */
export function ProjectAddressMap({
  address,
  city,
  state,
  zip,
  heightPx = 180,
  heading = "Project Location",
  linkBehavior = "directions",
  linkLabel,
  className = "",
}: ProjectAddressMapProps) {
  const fullAddress = buildFullAddress(address, city, state, zip);
  if (!fullAddress) return null;

  const encoded = encodeURIComponent(fullAddress);
  const embedUrl = `https://www.google.com/maps?q=${encoded}&output=embed`;
  const externalUrl =
    linkBehavior === "directions"
      ? `https://www.google.com/maps/dir/?api=1&destination=${encoded}`
      : `https://www.google.com/maps/search/?api=1&query=${encoded}`;

  const resolvedLinkLabel =
    linkLabel ??
    (linkBehavior === "directions" ? "Get Directions" : "Open in Google Maps");

  return (
    <div className={`space-y-2 ${className}`.trim()}>
      {heading && (
        <div className="flex items-center gap-1.5 text-xs font-medium text-text-muted">
          <MapPin className="h-3.5 w-3.5" />
          <span>{heading}</span>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-border bg-surface-hover shadow-sm">
        <iframe
          src={embedUrl}
          width="100%"
          height={heightPx}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          title={`Map of ${fullAddress}`}
          aria-label={`Interactive map showing the project location at ${fullAddress}. Click "${resolvedLinkLabel}" below to open this location in Google Maps.`}
          className="block w-full"
          style={{ border: 0 }}
        />
      </div>

      <a
        href={externalUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary-dark hover:underline"
        title={`Open ${fullAddress} in Google Maps`}
      >
        <ExternalLink className="h-3.5 w-3.5" />
        {resolvedLinkLabel}
      </a>
    </div>
  );
}

export default ProjectAddressMap;
