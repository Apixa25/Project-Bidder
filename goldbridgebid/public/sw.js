// Service worker for ProjectXBidX.
//
// Responsibilities:
//   1. Push notifications (existing — unchanged behavior).
//   2. Stale-chunk recovery — automatically reload the page when we detect
//      a returning visitor is running cached HTML that references JS chunks
//      from an older deploy (those chunks 404 on the new build, React can't
//      hydrate, the loading splash gets stuck, and the page becomes
//      unclickable). This is the "dark page, nothing clickable" bug.
//   3. Cache hygiene — on activate, nuke any old caches the SW left behind.
//
// IMPORTANT: this SW intentionally does NOT pre-cache pages or assets. It
// only watches network responses and recovers from a specific failure mode.
// That keeps it safe (no surprise offline behavior, no risk of the SW itself
// becoming the source of stale content).

// Bump this when you ship a SW change that needs old caches purged.
const CACHE_VERSION = "pxb-sw-v2";

self.addEventListener("install", () => {
  // Activate this new SW immediately, don't wait for old tabs to close.
  self.skipWaiting();
});

// PwaRegistration posts this message when it spots a waiting SW (a new
// version installed while an old one was still controlling the page). This
// gives the new SW a chance to take over even if its install handler
// somehow didn't call skipWaiting.
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "PXB_SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Take control of all open tabs immediately so they get the new SW
      // (including the new fetch handler below) without needing a refresh.
      await self.clients.claim();

      // Nuke any caches that don't belong to this SW version. We don't
      // actively populate caches in this SW today, but this keeps things
      // tidy if a previous version (or future version) ever does.
      try {
        const keys = await caches.keys();
        await Promise.all(
          keys
            .filter((key) => !key.startsWith(CACHE_VERSION))
            .map((key) => caches.delete(key))
        );
      } catch (err) {
        // Cache API can be unavailable in some private-browsing modes; not
        // worth blocking activation over.
        console.warn("[sw] cache cleanup skipped:", err);
      }
    })()
  );
});

// ---- Stale-chunk recovery --------------------------------------------------
//
// When Vercel deploys a new build, every JS chunk under /_next/static/ gets
// a new hashed filename. If a returning visitor has stale HTML in their
// browser disk cache (referencing old chunk filenames), those requests will
// 404 against the new deploy. React then can't hydrate, the route loading
// splash never resolves, and the page looks dark and unclickable.
//
// To recover automatically: we watch fetch responses. If we see a 404 on a
// /_next/static/ chunk (a smoking-gun signal that this tab is running stale
// HTML), we tell every controlled tab to soft-reload itself, which fetches
// the new HTML + new chunk URLs.

self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Only intercept GET requests to OUR own static-chunk URLs. Anything else
  // (analytics, Supabase, third-party iframes, etc.) we let pass through
  // untouched — adding event.respondWith() to unrelated requests can break
  // streaming behavior.
  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  const isOwnOrigin = url.origin === self.location.origin;
  const isStaticChunk =
    isOwnOrigin && url.pathname.startsWith("/_next/static/");

  if (!isStaticChunk) return;

  event.respondWith(
    (async () => {
      try {
        const response = await fetch(request);
        if (response.status === 404) {
          // The HTML this tab is running references a chunk that no longer
          // exists. Tell every controlled tab to reload.
          notifyClientsToReload("stale_chunk", url.pathname);
        }
        return response;
      } catch (err) {
        // Network failure (offline, DNS, etc.) — let the browser handle it
        // normally. Don't trigger a reload loop on connectivity issues.
        throw err;
      }
    })()
  );
});

async function notifyClientsToReload(reason, chunk) {
  try {
    const all = await self.clients.matchAll({ type: "window" });
    for (const client of all) {
      client.postMessage({
        type: "PXB_RELOAD_REQUIRED",
        reason,
        chunk: chunk || null,
      });
    }
  } catch (err) {
    console.warn("[sw] failed to notify clients of reload:", err);
  }
}

// ---- Push notifications (unchanged) ---------------------------------------

self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || "ProjectXBidX";
  const options = {
    body: data.body || "You have a new notification.",
    icon: "/icon.png",
    badge: "/icon.png",
    data: {
      url: data.url || "/",
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(self.clients.openWindow(url));
});
