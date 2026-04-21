"use client";

import { useEffect } from "react";

/**
 * Registers the ProjectXBidX service worker and listens for stale-build
 * recovery messages from it.
 *
 * Why the recovery listener exists:
 * Each Vercel deploy ships JS chunks under `/_next/static/` with new
 * hashed filenames. If a returning visitor has stale HTML in their browser
 * disk cache (referencing chunks from a previous deploy), those chunk
 * requests will 404 against the new build. React then can't hydrate, the
 * route loading splash never resolves, the page looks dark, and nothing is
 * clickable.
 *
 * The service worker watches for those 404s on `/_next/static/` and posts a
 * `PXB_RELOAD_REQUIRED` message back to every controlled tab. We listen for
 * that message here and trigger a single soft-reload, which fetches the
 * fresh HTML + the correct chunk URLs and recovers the page automatically.
 *
 * The `alreadyReloaded` guard prevents tight loops in the (very unlikely)
 * case that a deploy is genuinely broken — we'll only auto-reload at most
 * once per page lifetime.
 */
export default function PwaRegistration() {
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.warn("Service worker registration failed:", err);
    });

    let alreadyReloaded = false;

    const onMessage = (event: MessageEvent) => {
      const data = event.data as
        | { type?: string; reason?: string; chunk?: string | null }
        | undefined;
      if (!data || data.type !== "PXB_RELOAD_REQUIRED") return;
      if (alreadyReloaded) return;
      alreadyReloaded = true;

      console.warn(
        `[pxb] Detected stale build (reason: ${
          data.reason ?? "unknown"
        }${data.chunk ? `, chunk: ${data.chunk}` : ""}). Reloading to pick up the latest deploy.`
      );

      window.location.reload();
    };

    navigator.serviceWorker.addEventListener("message", onMessage);

    return () => {
      navigator.serviceWorker.removeEventListener("message", onMessage);
    };
  }, []);

  return null;
}
