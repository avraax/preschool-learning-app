// Opens the App Store's "Write a Review" sheet from the shell. See `src/config/storeReview.ts` for why
// this is a deep link rather than `requestReview()`.
//
// The import is dynamic for the same reason as `shellBrowser.ts`: a native SDK must not become a
// load-bearing dependency of the web build or the plain-Node tests.

import { isNativeShell } from '../config/runtimeTarget.ts'
import { WRITE_REVIEW_URL } from '../config/storeReview.ts'

type LauncherPlugin = { openUrl: (options: { url: string }) => Promise<{ completed: boolean }> }

/** Where the row is offered at all: the shell, plus DEV so the harness can see and click it. */
export const storeReviewAvailable = (): boolean => isNativeShell() || import.meta.env.DEV

/** @returns false when the App Store could not be opened, so the caller can say so. */
export async function openStoreReview(): Promise<boolean> {
  if (!isNativeShell()) {
    // DEV web: the product page in a tab is the nearest honest stand-in.
    return window.open(WRITE_REVIEW_URL, '_blank', 'noopener') !== null
  }
  // BOXED — a Capacitor plugin proxy is a thenable, so returning it bare from an async function
  // never settles (`.claude/rules/ios-shell.md`).
  let boxed: { plugin: LauncherPlugin } | null
  try {
    const mod = (await import('@capacitor/app-launcher')) as unknown as { AppLauncher?: LauncherPlugin }
    boxed = mod.AppLauncher ? { plugin: mod.AppLauncher } : null
  } catch {
    boxed = null
  }
  if (!boxed) return false
  try {
    const { completed } = await boxed.plugin.openUrl({ url: WRITE_REVIEW_URL })
    return completed
  } catch {
    return false
  }
}
