// WHERE IS THIS BUILD RUNNING — the Vercel deployment, or bundled inside a native shell?
//
// App Store PRD §3.10 (Phase A4). Four things in this app currently assume a network-served SPA, and a
// bundled Capacitor shell changes what each of them MEANS. This module is the one place that question is
// answered, so those four don't each grow their own sniff.
//
// **NO CAPACITOR DEPENDENCY, and that is deliberate.** Nothing native exists in this repo yet (Phase B),
// and importing `@capacitor/core` to ask "am I native?" would make a web build depend on a native SDK to
// answer a question the ORIGIN already answers. Capacitor serves the bundled web build from
// `capacitor://localhost` (`iosScheme: 'capacitor'`, kept as the default precisely because `localhost`
// is what grants the secure context `getUserMedia` needs — PRD §3.9). So the protocol IS the signal, it
// costs nothing, and it is testable as a pure function.
//
// ONE DELIBERATE INVERSION, recorded here because a later session will otherwise "fix" it back:
// `CLAUDE.md` says never design a feature around "works offline", and that stays true for the WEB
// deployment, which is network-only with no service worker. The SHELL is the opposite — every asset
// ships inside the binary, so it genuinely works offline (PRD §3.1, and it is the strongest available
// Guideline 4.2 argument). Two delivery targets, two rules.
//
// AND ONE PROHIBITION: never add an OTA / live-update service (Capawesome Live Updates, Appflow, or
// similar) to the shell. Guideline 2.5.2 forbids downloading "code which introduces or changes features
// or functionality of the app". Every change ships as a new build through review.

export type RuntimeTarget = 'web' | 'shell'

/**
 * Pure over the page's protocol, so it can be unit-tested without a browser.
 *
 * `capacitor:` is the iOS scheme; `ionic:` is the legacy one and `http://localhost` on Android. Only the
 * first two are claimed here — a plain `http://localhost` is ALSO the dev server, and treating that as
 * "shell" would disable the update banner and the stale-chunk reload in exactly the environment where
 * they are developed. iOS is the only target in scope (PRD §0), so this is not a gap.
 */
export function runtimeTargetFor(protocol: string | undefined | null): RuntimeTarget {
  const p = (protocol ?? '').toLowerCase()
  return p === 'capacitor:' || p === 'ionic:' ? 'shell' : 'web'
}

/** The live answer for this page. Safe outside a browser (Node tests, build scripts) → `'web'`. */
export function runtimeTarget(): RuntimeTarget {
  if (typeof window === 'undefined' || !window.location) return 'web'
  return runtimeTargetFor(window.location.protocol)
}

/** True inside a bundled native shell. */
export const isNativeShell = (): boolean => runtimeTarget() === 'shell'
