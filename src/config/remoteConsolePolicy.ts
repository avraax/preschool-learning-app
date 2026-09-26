// When may `remoteConsole` forward the page's console to `/api/log-error`? PURE, so a Node test can pin it.
//
// THE SHELL WAS ON BY ACCIDENT. The gate used to be "hostname is localhost", meant to catch the Vite dev
// server — but the native iOS shell is served from `capacitor://localhost`, whose hostname parses as
// `localhost` too. So every App Store build forwarded every console line to PRODUCTION `/api/log-error`
// (~100 Vercel invocations in the first 20 s of a launch, measured 2026-09-26), and when that POST failed
// (offline — which the shell is built to be) its catch handler logged through the patched console,
// which POSTed again: ~3,600 requests/second with the main thread pinned, measured.
//
// So: never in the shell, and on the web only in a DEV build served from a local host, or when an adult
// explicitly asks with `?enable-console=true`. `?disable-console=true` always wins.

export interface RemoteConsoleContext {
  /** `import.meta.env.DEV` — true only under the Vite dev server. */
  dev: boolean
  /** `location.protocol`, e.g. `http:` / `capacitor:`. */
  protocol: string
  hostname: string
  search: string
}

const SHELL_PROTOCOLS = ['capacitor:', 'ionic:']
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]']

export function remoteConsoleEnabled(ctx: RemoteConsoleContext): boolean {
  if (ctx.search.includes('disable-console=true')) return false
  if (SHELL_PROTOCOLS.includes(ctx.protocol)) return false
  if (ctx.search.includes('enable-console=true')) return true
  return ctx.dev && LOCAL_HOSTS.includes(ctx.hostname)
}
