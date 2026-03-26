import { ChevronDown } from "lucide-react";

type ScrollMoreCueProps = {
  href: string;
  ariaLabel: string;
  /** Hero / orange CTA backgrounds vs light sections */
  variant?: "on-dark" | "on-light";
};

export function ScrollMoreCue({
  href,
  ariaLabel,
  variant = "on-light",
}: ScrollMoreCueProps) {
  const onDark = variant === "on-dark";

  return (
    <a
      href={href}
      className={
        onDark
          ? "inline-flex flex-col items-center gap-2 text-zinc-200/90 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/80"
          : "inline-flex flex-col items-center gap-2 text-text-secondary/90 transition-colors hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary/40"
      }
      aria-label={ariaLabel}
    >
      <span className="text-xs font-semibold uppercase tracking-[0.22em]">
        More below
      </span>
      <ChevronDown
        className={
          onDark
            ? "h-11 w-11 text-primary-light drop-shadow-md motion-safe:animate-bounce"
            : "h-11 w-11 text-primary drop-shadow-sm motion-safe:animate-bounce"
        }
        strokeWidth={2.25}
        aria-hidden
      />
    </a>
  );
}
