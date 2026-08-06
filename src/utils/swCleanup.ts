// Legacy service-worker sweep (PRD-08 §P3).
//
// The app is network-only and registers NO service worker. But earlier builds shipped a real SW
// (and the vite-plugin-pwa era emitted one too), so some installed clients — especially the iPad
// home-screen PWA — may still have a SW controlling the page and serving stale, cached assets
// forever. On every boot we proactively unregister any surviving registration and drop its caches.
// This is idempotent and cheap: once a client is clean there's nothing left to unregister.

import { isNativeShell } from '../config/runtimeTarget.ts'

// A5/A4 note (App Store PRD §3.10): audited for the native shell and found SAFE but POINTLESS, so it is
// skipped there rather than left to run. Safe, because every access below is either feature-detected or
// inside the try/catch and both promises carry a `.catch` — a WKWebView that exposes
// `navigator.serviceWorker` and then rejects `getRegistrations()` on a `capacitor://` origin cannot take
// the app down. Pointless, because a bundled shell has never had a service worker to inherit: this sweep
// exists for clients installed from the WEB in an earlier SW era. Two async storage sweeps at every cold
// boot on a 2017 iPad is not free, and `caches.delete` over a scheme we do not control is a needless
// blast radius.
export function sweepLegacyServiceWorkers(): void {
  if (typeof navigator === 'undefined') return
  if (isNativeShell()) return
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
