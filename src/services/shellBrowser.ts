// Opening a URL OUTSIDE the shell's own webview (App Store PRD §3.3 / B5).
//
// WHY THIS EXISTS AT ALL: Google blocks OAuth in embedded webviews. Its native-app OAuth doc defines
// `disallowed_useragent` as "the authorization endpoint is displayed inside an embedded user-agent
// disallowed by Google's OAuth 2.0 Policies", and the enforcement announcement names `WKWebView`
// explicitly. So `window.location.assign(authorizeUrl)` — correct and shipping on the web — becomes a
// 403 the adult cannot work around the moment the same code runs inside the shell. The required
// approach is the system browser, which is what `@capacitor/browser` gives us
// (`SFSafariViewController` / `ASWebAuthenticationSession`).
//
// WHY THE IMPORT IS DYNAMIC: `@capacitor/browser` pulls in `@capacitor/core`, and this repo's
// client-side auth graph is imported by plain-Node tests (`.claude/rules/auth.md`). A static import
// would make a native SDK a load-bearing dependency of the web build AND of the test suite, to answer a
// question the page's own origin already answers. Loaded only on the branch that uses it, it costs the
// web build nothing — Vite keeps it in a separate chunk that is never fetched there.

import { isNativeShell } from '../config/runtimeTarget.ts'

type BrowserPlugin = {
  open: (options: { url: string }) => Promise<void>
  close: () => Promise<void>
  addListener: (
    eventName: 'browserFinished',
    listenerFunc: () => void,
  ) => Promise<{ remove: () => Promise<void> }>
  removeAllListeners: () => Promise<void>
}

async function loadBrowser(): Promise<BrowserPlugin | null> {
  if (!isNativeShell()) return null
  try {
    const mod = (await import('@capacitor/browser')) as unknown as { Browser?: BrowserPlugin }
    return mod.Browser ?? null
  } catch {
    // A shell build with the plugin missing is a packaging error, not a runtime state we can recover
    // from — the caller turns this into an adult-facing message rather than a dead button.
    return null
  }
}

/**
 * Open `url` in the system browser and call `onReturn` when the adult comes back.
 *
 * `browserFinished` fires when the sheet is dismissed, which is THE RETURN SIGNAL — it is what a deep
 * link would have bought us, without registering a custom scheme with Google or changing the server's
 * redirect URI. It is deliberately only a *nudge*: `OAuthReturnHandler`'s poll is still what guarantees
 * the flow completes, because the session is claimed with the `flowId` this app holds locally, not with
 * anything the return URL carries. That design is why the shell needs no deep link at all.
 *
 * @returns false when the system browser could not be opened; the caller must then say so in Danish.
 */
export async function openExternalAuthUrl(url: string, onReturn: () => void): Promise<boolean> {
  const browser = await loadBrowser()
  if (!browser) return false
  try {
    // Listener BEFORE open: dismissal can be immediate if the adult taps Done straight away.
    await browser.addListener('browserFinished', onReturn)
    await browser.open({ url })
    return true
  } catch {
    return false
  }
}

/**
 * Dismiss the system browser once the session is in hand.
 *
 * Without this the adult is left staring at the return page — which, loaded in a context that never
 * started the flow, correctly renders `WrongContextNotice` ("Vend tilbage til Børnelæring-appen"). That
 * is the right message for Safari and a confusing one here, where the app behind the sheet is already
 * signed in. Never throws: closing an already-closed browser must not turn a successful sign-in into an
 * error.
 */
export async function closeExternalAuth(): Promise<void> {
  const browser = await loadBrowser()
  if (!browser) return
  try {
    await browser.close()
  } catch {
    /* already dismissed by the adult */
  }
  try {
    await browser.removeAllListeners()
  } catch {
    /* nothing registered */
  }
}
