// THE APP COMING BACK TO THE FRONT after a sign-in — the native half of W5 layer 1.
//
// The shell opens the authorize URL in `SFSafariViewController`, and nothing inside that sheet can reach
// the app: `/#bl_auth=1` boots the whole web app *in the sheet* (where, holding no flowId, it correctly
// says "Du er allerede logget ind"), and a root-relative link navigates the sheet rather than returning.
// A custom URL scheme is the one link iOS hands back to the app. `@capacitor/app` surfaces that as
// `appUrlOpen`, and the handler dismisses the sheet and claims immediately.
//
// IT IS A NUDGE, NOT THE GUARANTEE. `OAuthReturnHandler`'s poll still finishes the sign-in on its own —
// the session is claimed with the `flowId` this app holds locally, never with anything the return URL
// carries, and `?ok=1` is therefore not a credential. W5 layer 1 is what makes it feel instant; W4 is
// what makes it correct. If this whole module fails to load, sign-in still works.
//
// WHY THE CAPABILITY IS MEASURED RATHER THAN ASSUMED. A binary without `CFBundleURLTypes` cannot receive
// the redirect, and sending one anyway would end a SUCCESSFUL sign-in on Safari's "the address is
// invalid" — strictly worse than the terminal page it replaces. So `/oauth/start` is told
// `client: 'shell-scheme'` only once this listener is actually registered, which every already-installed
// binary will fail to do. The server picks WHICH scheme from its own tier-keyed table; nothing here
// names one.
//
// The import is DYNAMIC for the same reason as `shellBrowser.ts`: this graph is imported by plain-Node
// tests, and a static `@capacitor/app` would make a native SDK load-bearing for the web build too.

import { isNativeShell } from '../config/runtimeTarget.ts'
import { noteAuthStep } from './authDiagnostics.ts'

type AppPlugin = {
  addListener: (
    eventName: 'appUrlOpen',
    listenerFunc: (data: { url: string }) => void,
  ) => Promise<{ remove: () => Promise<void> }>
}

/**
 * NEVER RETURN A CAPACITOR PLUGIN PROXY FROM AN `async` FUNCTION — box it first.
 *
 * `registerPlugin` returns a Proxy whose `get` trap answers every property with a method wrapper,
 * `then` included, so the promise machinery tries to assimilate it and the outer promise NEVER SETTLES.
 * Report BV9DJ was exactly that with `@capacitor/browser`; `.claude/rules/ios-shell.md` carries it.
 */
const box = (plugin: AppPlugin | undefined): { plugin: AppPlugin } | null =>
  plugin ? { plugin } : null

let registered: Promise<boolean> | null = null

/**
 * Register the return listener, once. Resolves to whether this binary can actually be returned to.
 *
 * Idempotent: the sign-in button may be tapped several times, and a duplicate listener would claim
 * twice. The claim itself is single-flighted anyway (`OAuthReturnHandler`), but this keeps it cheap.
 */
export function ensureShellReturnListener(onReturn: () => void): Promise<boolean> {
  if (!isNativeShell()) return Promise.resolve(false)
  if (registered) return registered
  registered = (async () => {
    try {
      const mod = (await import('@capacitor/app')) as unknown as { App?: AppPlugin }
      const boxed = box(mod.App)
      if (!boxed) return false
      await boxed.plugin.addListener('appUrlOpen', (data) => {
        // The URL is a signal, not a credential — checked only so an unrelated deep link (a future
        // feature, or another app) does not fire the claim. Never logged: `sanitizeUrl` rules apply and
        // there is nothing here worth recording beyond "it fired".
        if (typeof data?.url !== 'string' || !data.url.includes('//auth')) return
        noteAuthStep('google-return', 'ok', { note: 'scheme-return' })
        onReturn()
      })
      return true
    } catch {
      // A shell build without the plugin is a packaging error, not a runtime state to recover from —
      // and the honest answer is simply "no, do not send me a scheme redirect".
      return false
    }
  })()
  return registered
}

/** Exported for `shellReturn.test.ts`, which proves a plugin-shaped thenable survives the boxing. */
export const boxAppPluginForTest = box

/** Reset between tests — the module-level promise is a cache, not state the app mutates. */
export const resetShellReturnForTest = (): void => {
  registered = null
}
