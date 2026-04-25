"use client";

import { useEffect } from "react";

/**
 * Registers the ProjectXBidX service worker and listens for stale-build
 * recovery messages from it.
 *
 * Three responsibilities:
 *
 *   1. Set `data-pxb-hydrated="1"` on <html> the moment React mounts. The
 *      inline HydrationWatchdog script in <head> watches this attribute as
 *      its "page is alive" signal — if we never set it, it self-recovers.
 *
 *   2. Scrub the `_pxbRecovered=1` URL marker after a successful recovery
 *      so users never see it in their address bar.
 *
 *   3. Register the SW and listen for two failure-mode messages:
 *
 *      a. `PXB_RELOAD_REQUIRED` — the SW saw a 404 on a `/_next/static/`
 *         chunk (stale HTML referencing a deleted chunk). We auto-reload.
 *
 *      b. `controllerchange` — a NEW SW just took control of this tab
 *         (because we shipped an update). We do one soft reload so the
 *         page is now serving fresh HTML under the new SW.
 *
 *   The `alreadyReloaded` guards prevent tight loops.
 *
 *   Why all three: each guards a different failure mode that can leave a
 *   user staring at a dark, unclickable page after a deploy.
 */
export default function PwaRegistration() {
  useEffect(() => {
    // ---- Signal liveness to the inline watchdog ---------------------------
    // We're inside a useEffect so React has definitely mounted by now. The
    // watchdog will read this attribute after window 'load' + 5s; if it
    // sees "1", it stays out of the way.
    try {
      document.documentElement.setAttribute("data-pxb-hydrated", "1");
    } catch {
      // ignore — never let this break a render
    }

    // ---- Clean up the recovery URL marker --------------------------------
    // If we got here via the watchdog's auto-reload, the URL contains
    // `_pxbRecovered=1`. Now that hydration succeeded, strip it so the
    // user never sees it.
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has("_pxbRecovered")) {
        url.searchParams.delete("_pxbRecovered");
        window.history.replaceState({}, "", url.toString());
      }
    } catch {
      // ignore
    }

    if (typeof navigator === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    let alreadyReloaded = false;

    function reloadOnce(reason: string) {
      if (alreadyReloaded) return;
      alreadyReloaded = true;
      console.warn(`[pxb] Reloading to recover (reason: ${reason}).`);
      window.location.reload();
    }

    // Track whether a SW was already controlling this tab BEFORE we
    // registered. If yes, then `controllerchange` later means an update
    // took over an old tab — reload to swap to fresh HTML. If no, this
    // is a first-visit install and we must NOT reload (would cause an
    // unnecessary refresh on every brand-new visitor).
    const initialControllerExisted = !!navigator.serviceWorker.controller;

    navigator.serviceWorker.register("/sw.js").then(
      (registration) => {
        // When a new SW is found while one is already in control, ask it
        // to skip waiting so it activates immediately instead of waiting
        // for every tab to close. This pairs with the SKIP_WAITING handler
        // in sw.js.
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (
              newWorker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              try {
                newWorker.postMessage({ type: "PXB_SKIP_WAITING" });
              } catch (err) {
                console.warn("[pxb] failed to post SKIP_WAITING:", err);
              }
            }
          });
        });
      },
      (err) => {
        console.warn("Service worker registration failed:", err);
      }
    );

    const onMessage = (event: MessageEvent) => {
      const data = event.data as
        | { type?: string; reason?: string; chunk?: string | null }
        | undefined;
      if (!data || data.type !== "PXB_RELOAD_REQUIRED") return;
      reloadOnce(
        `${data.reason ?? "unknown"}${data.chunk ? `, chunk: ${data.chunk}` : ""}`
      );
    };

    const onControllerChange = () => {
      // Only reload when an EXISTING controller was swapped out — not on
      // first install of a brand-new SW (which would cause an unnecessary
      // refresh for every first-time visitor).
      if (!initialControllerExisted) return;
      reloadOnce("controllerchange (new service worker took over)");
    };

    navigator.serviceWorker.addEventListener("message", onMessage);
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      onControllerChange
    );

    return () => {
      navigator.serviceWorker.removeEventListener("message", onMessage);
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange
      );
    };
  }, []);

  return null;
}
