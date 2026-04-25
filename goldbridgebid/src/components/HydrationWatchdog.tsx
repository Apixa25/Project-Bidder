/**
 * Inline <script> that runs before React boots.
 *
 * Purpose: catch the "dark page, nothing clickable" failure mode that
 * happens when a stale browser state (old service worker, cached HTML
 * referencing missing JS chunks, etc.) prevents React from hydrating.
 *
 * How it works:
 *   1. After window 'load' fires (all assets requested), we start a
 *      short timer (~5 seconds).
 *   2. PwaRegistration sets `document.documentElement.dataset.pxbHydrated`
 *      to "1" inside its useEffect — that's our "page is alive" signal.
 *   3. When the timer fires, if the flag isn't set, we treat the page
 *      as broken: best-effort unregister all service workers, clear all
 *      caches, then reload exactly once.
 *   4. A `_pxbRecovered=1` URL marker prevents reload loops on a
 *      genuinely broken deploy. PwaRegistration scrubs it from the URL
 *      after a successful hydration so users never see it.
 *
 * This is purely defensive — happy-path users never notice it. It costs
 * one short-lived setTimeout and no network requests.
 */

const HYDRATION_WATCHDOG_SCRIPT = `
(function() {
  try {
    if (window.__pxbWatchdogInstalled) return;
    window.__pxbWatchdogInstalled = true;

    // If we already attempted recovery on this page load, don't retry —
    // some deploys are genuinely broken and we don't want to loop.
    var search = window.location.search || "";
    if (search.indexOf("_pxbRecovered=1") !== -1) return;

    var WATCHDOG_DELAY_MS = 5000;

    function isHydrated() {
      try {
        return document.documentElement.getAttribute("data-pxb-hydrated") === "1";
      } catch (e) {
        return false;
      }
    }

    function attemptRecovery() {
      if (isHydrated()) return;

      try {
        console.warn(
          "[pxb] Hydration watchdog tripped after " +
            WATCHDOG_DELAY_MS +
            "ms — clearing service workers + caches and reloading."
        );
      } catch (e) {}

      var unregisterPromise = Promise.resolve();
      try {
        if ("serviceWorker" in navigator && navigator.serviceWorker.getRegistrations) {
          unregisterPromise = navigator.serviceWorker
            .getRegistrations()
            .then(function (regs) {
              return Promise.all(
                regs.map(function (reg) {
                  return reg.unregister().catch(function () {});
                })
              );
            })
            .catch(function () {});
        }
      } catch (e) {}

      var cachePromise = unregisterPromise.then(function () {
        try {
          if (window.caches && caches.keys) {
            return caches
              .keys()
              .then(function (keys) {
                return Promise.all(
                  keys.map(function (key) {
                    return caches.delete(key).catch(function () {});
                  })
                );
              })
              .catch(function () {});
          }
        } catch (e) {}
      });

      cachePromise.then(function () {
        try {
          var url = new URL(window.location.href);
          url.searchParams.set("_pxbRecovered", "1");
          window.location.replace(url.toString());
        } catch (e) {
          window.location.reload();
        }
      });
    }

    function startWatchdog() {
      setTimeout(function () {
        if (!isHydrated()) {
          attemptRecovery();
        }
      }, WATCHDOG_DELAY_MS);
    }

    if (document.readyState === "complete") {
      startWatchdog();
    } else {
      window.addEventListener("load", startWatchdog, { once: true });
    }
  } catch (e) {
    // Never let the watchdog itself break the page.
    try {
      console.warn("[pxb] Hydration watchdog install failed:", e);
    } catch (ignore) {}
  }
})();
`;

export default function HydrationWatchdog() {
  return (
    <script
      // Inline, intentionally synchronous — this needs to run before the
      // React tree mounts so the watchdog timer is armed even if hydration
      // never starts.
      dangerouslySetInnerHTML={{ __html: HYDRATION_WATCHDOG_SCRIPT }}
    />
  );
}
