// Legacy service-worker sweep (PRD-08 §P3).
//
// The app is network-only and registers NO service worker. But earlier builds shipped a real SW
// (and the vite-plugin-pwa era emitted one too), so some installed clients — especially the iPad
// home-screen PWA — may still have a SW controlling the page and serving stale, cached assets
// forever. On every boot we proactively unregister any surviving registration and drop its caches.
// This is idempotent and cheap: once a client is clean there's nothing left to unregister.

export function sweepLegacyServiceWorkers(): void {
  if (typeof navigator === 'undefined') return
  try {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => regs.forEach((r) => r.unregister()))
        .catch(() => {})
    }
    if (typeof caches !== 'undefined' && caches.keys) {
      caches
        .keys()
        .then((keys) => keys.forEach((k) => caches.delete(k)))
        .catch(() => {})
    }
  } catch {
    /* a failed sweep must never take the app down */
  }
}

export default sweepLegacyServiceWorkers
