import { MapPin } from "lucide-react";

interface AddressWithMapPreviewProps {
  address: string;
  mapImageUrl?: string | null;
  label?: string;
  className?: string;
  addressClassName?: string;
  imageClassName?: string;
}

export default function AddressWithMapPreview({
  address,
  mapImageUrl,
  label,
  className = "",
  addressClassName = "font-medium text-text-primary",
  imageClassName = "h-16 w-24",
}: AddressWithMapPreviewProps) {
  return (
    <div className={`flex items-start gap-3 ${className}`}>
      {mapImageUrl ? (
        <img
          src={mapImageUrl}
          alt={label ? `${label} map preview` : "Saved address map preview"}
          className={`${imageClassName} shrink-0 rounded-lg border border-border bg-bg-warm object-cover`}
        />
      ) : (
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-bg-warm text-text-muted">
          <MapPin className="h-4 w-4" />
        </span>
      )}
      <span className="min-w-0">
        {label && (
          <span className="block text-xs font-semibold uppercase tracking-wide text-text-muted">
            {label}
          </span>
        )}
        <span className={`block ${addressClassName}`}>{address}</span>
        {mapImageUrl && (
          <span className="mt-1 block text-xs text-text-muted">
            Saved exact pin preview
          </span>
        )}
      </span>
    </div>
  );
}
