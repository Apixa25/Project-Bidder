import Image from "next/image";
import Link from "next/link";

/**
 * Full projectxbidx.com wordmark (PNG) — replaces plain text + gradient CSS.
 */
export function BrandWordmark({
  className = "h-4 w-auto max-w-[min(100%,140px)] object-contain object-left sm:h-[18px]",
  priority = false,
  /** Set false when already wrapped in a parent `<Link>` (e.g. auth header). */
  asLink = true,
  /** Extra classes on the `<Link>` wrapper (e.g. `h-full items-center` for fixed-height headers). */
  linkClassName = "",
}: {
  className?: string;
  priority?: boolean;
  asLink?: boolean;
  linkClassName?: string;
}) {
  const img = (
    <Image
      src="/wordmark.png"
      alt="projectxbidx.com"
      width={1200}
      height={160}
      className={className}
      priority={priority}
    />
  );

  if (!asLink) {
    return (
      <span className={`inline-flex shrink-0 items-center ${linkClassName}`}>
        {img}
      </span>
    );
  }

  return (
    <Link
      href="/"
      className={`inline-flex shrink-0 items-center ${linkClassName}`.trim()}
    >
      {img}
    </Link>
  );
}
