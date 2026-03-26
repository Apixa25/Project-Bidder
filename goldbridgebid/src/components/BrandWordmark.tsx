/**
 * projectxbidx.com — "project" + gradient "x" + "bidx.com" (charcoal + brand gradient).
 */
export function BrandWordmark({
  className = "",
}: {
  className?: string;
}) {
  return (
    <span
      className={`font-bold tracking-tight text-text-primary lowercase ${className}`}
    >
      project
      <span className="bg-gradient-to-br from-primary-light via-secondary-light to-accent bg-clip-text text-transparent">
        x
      </span>
      bidx.com
    </span>
  );
}
