// The native iOS shell (App Store PRD §3.1, §3.9 — Phase B1).
//
// THE ONE DECISION THIS FILE ENCODES: there is **no `server.url`**. The web build is served from the
// app bundle at `capacitor://localhost`, so `dist/` — which Vite fills from `public/`, i.e. including
// the 31 MB of prebaked narration under `sounds/tts/` — ships INSIDE the binary.
//
// Adding `server.url` would point the shell at the Vercel deployment and turn the app into a thin
// client for a website, which is Guideline 4.2.7(e) verbatim, and it would make every change a remote
// code load under 2.5.2. It is also what makes the games work with no network at all, which is the
// strongest available 4.2 argument ("elevate it beyond a repackaged website") and simply better for a
// child on an iPad. `src/config/capacitorConfig.test.ts` fails the build if it comes back.
//
// FOR THE SAME REASON: never add an OTA / live-update service (Capawesome Live Updates, Appflow, or
// similar). Every change ships as a new build through App Store review.

import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  // Registered in the Apple Developer portal with Sign in with Apple enabled and NO other
  // capabilities (PRD §4.0 C4). Permanent — a bundle ID cannot be renamed after an app record exists.
  appId: 'com.vraa.earlylearning',

  // The HOME-SCREEN name, which is not the App Store listing name. The store record is
  // "Børnelæring: ABC, tal, engelsk"; under an icon there is room for one word.
  appName: 'Børnelæring',

  // Vite's output. `public/` is copied here wholesale by the build, so `sounds/` (54 MB: tts, music,
  // mascots, ui) rides along with no extra copy step — pinned by `capacitorConfig.test.ts`, because a
  // publicDir change would otherwise silently ship a binary whose narration is all 404.
  webDir: 'dist',

  server: {
    // BOTH OF THESE ARE THE CAPACITOR DEFAULTS, and they are written out because one of them is
    // load-bearing for a feature. Capacitor's docs: keeping the hostname as `localhost` "allows the use
    // of Web APIs that would otherwise require a secure context such as navigator.geolocation and
    // MediaDevices.getUserMedia" — which is the only reason "Sig et Ord" works in the shell without a
    // native audio-capture rewrite (PRD §3.9 / B7). Changing either is a silent feature kill.
    iosScheme: 'capacitor',
    hostname: 'localhost',
  },

  ios: {
    // Matches `public/manifest.json`'s `background_color` and index.html's `theme-color`, so the gap
    // between the launch screen and first paint is the app's own purple rather than a white flash —
    // which reads as a stutter on a 2017 iPad. Keep the three in step.
    backgroundColor: '#8B5CF6',
    // No inset juggling — every game layout is full-viewport and handles safe areas in CSS.
    contentInset: 'never',
  },
}

export default config
