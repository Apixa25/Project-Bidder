"use client";

import { useState, useRef, useEffect } from "react";
import { Lightbulb, X } from "lucide-react";
import Link from "next/link";

// HelpHint — small in-context "💡 What is this?" chip that opens a popover
// with an explanation. Designed to dramatically reduce the support load
// from "I don't know what this button does" questions without cluttering
// the UI for repeat users.
//
// Pass a stable `id` if you want the user to be able to permanently dismiss
// the chip ("Got it, don't show again"); without an id, the chip always
// shows. The dismissal is stored in localStorage with the key
// `help-hint:<id>` so it persists across sessions on this device.
//
// Two visual variants:
// - "chip" (default) — pill with the lightbulb icon + "What is this?" text
// - "icon" — just the lightbulb icon, for tight spaces (e.g., next to a
//   form label)

interface HelpHintProps {
  // Unique identifier used as the localStorage dismissal key. Keep these
  // namespaced (e.g. "expertise-level", "ai-scope-builder") so they stay
  // stable across UI refactors.
  id?: string;
  // Optional title rendered above the body text.
  title?: string;
  // Body content of the popover. Plain text or JSX both work.
  children: React.ReactNode;
  // Optional "learn more" link to a relevant /how-it-works section or
  // similar deep-dive. Closes the popover when clicked.
  learnMoreHref?: string;
  learnMoreLabel?: string;
  // Trigger label — only shown for variant="chip".
  label?: string;
  variant?: "chip" | "icon";
  // Where the popover should align relative to the trigger. "left" puts the
  // popover's left edge under the trigger (default). "right" puts the
  // popover's right edge under the trigger — useful when the trigger is
  // near the right edge of its container.
  align?: "left" | "right";
  className?: string;
}

export default function HelpHint({
  id,
  title,
  children,
  learnMoreHref,
  learnMoreLabel = "Learn more →",
  label = "What is this?",
  variant = "chip",
  align = "left",
  className = "",
}: HelpHintProps) {
  const [open, setOpen] = useState(false);
  const [permanentlyDismissed, setPermanentlyDismissed] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Read dismissal preference from localStorage on mount. We use an effect
  // (not a useState initializer) so SSR always renders the chip visible on
  // first paint — using a lazy initializer would read localStorage during
  // hydration and cause an SSR/CSR mismatch on pages where some users
  // have dismissed the hint and others haven't. The lint rule below flags
  // synchronous setState in effects as a perf concern, but it doesn't
  // apply here: this fires exactly once on mount, never reactively.
  useEffect(() => {
    if (!id) return;
    if (typeof window === "undefined") return;
    try {
      const dismissed =
        window.localStorage.getItem(`help-hint:${id}`) === "1";
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPermanentlyDismissed(dismissed);
    } catch {
      // localStorage can throw in incognito / blocked-storage contexts.
      // Silently keep the hint visible in that case.
    }
  }, [id]);

  // Close the popover on outside click or Escape key.
  useEffect(() => {
    if (!open) return;
    function handleMouseDown(e: MouseEvent) {
      const target = e.target as Node;
      if (popoverRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  function dismissForever() {
    if (id && typeof window !== "undefined") {
      try {
        window.localStorage.setItem(`help-hint:${id}`, "1");
      } catch {
        // Same reasoning as above — incognito etc.
      }
    }
    setPermanentlyDismissed(true);
    setOpen(false);
  }

  if (permanentlyDismissed) return null;

  const triggerClasses =
    variant === "icon"
      ? "inline-flex items-center justify-center rounded-full p-1 text-amber-600 hover:bg-amber-50 hover:text-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-400/40 transition-colors"
      : "inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-400/40 transition-colors";

  const popoverAlign = align === "right" ? "right-0" : "left-0";

  return (
    <span className={`relative inline-flex ${className}`.trim()}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={triggerClasses}
        aria-label={title || label}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Lightbulb
          className={variant === "icon" ? "h-4 w-4" : "h-3.5 w-3.5"}
          aria-hidden="true"
        />
        {variant !== "icon" && <span>{label}</span>}
      </button>

      {open && (
        <div
          ref={popoverRef}
          className={`absolute ${popoverAlign} top-full z-50 mt-2 w-72 rounded-lg border border-border bg-surface p-4 shadow-lg sm:w-80`}
          role="dialog"
          aria-label={title || label}
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute right-2 top-2 rounded p-1 text-text-muted hover:bg-surface-hover hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            aria-label="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>

          {title && (
            <p className="mb-2 pr-6 text-sm font-semibold text-text-primary">
              {title}
            </p>
          )}

          <div className="text-xs leading-relaxed text-text-secondary">
            {children}
          </div>

          {(learnMoreHref || id) && (
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
              {learnMoreHref ? (
                <Link
                  href={learnMoreHref}
                  className="text-xs font-medium text-primary hover:text-primary-dark hover:underline"
                  onClick={() => setOpen(false)}
                >
                  {learnMoreLabel}
                </Link>
              ) : (
                <span />
              )}
              {id && (
                <button
                  type="button"
                  onClick={dismissForever}
                  className="text-xs text-text-muted hover:text-text-secondary hover:underline"
                >
                  Got it, don&apos;t show again
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </span>
  );
}
