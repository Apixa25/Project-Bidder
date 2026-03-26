import Image from "next/image";
import Link from "next/link";

/**
 * Full projectxbidx.com wordmark (PNG) — replaces plain text + gradient CSS.
 */
export function BrandWordmark({
  className = "h-8 w-auto max-w-[min(100%,280px)] object-contain object-left sm:h-9",
  priority = false,
  /** Set false when already wrapped in a parent `<Link>` (e.g. auth header). */
  asLink = true,
}: {
  className?: string;
  priority?: boolean;
  asLink?: boolean;
}) {
  const img = (
    <Image
      src="/wordmark.png"
      alt="projectxbidx.com"
      width={480}
      height={120}
      className={className}
      priority={priority}
    />
  );

  if (!asLink) {
    return <span className="inline-flex shrink-0 items-center">{img}</span>;
  }

  return (
    <Link href="/" className="inline-flex shrink-0 items-center">
      {img}
    </Link>
  );
}
