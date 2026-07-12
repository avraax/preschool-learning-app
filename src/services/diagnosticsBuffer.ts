// Always-on diagnostics ring buffers (Bug Report feature).
//
// Unlike remoteConsole (dev-only, POSTs each event), this module quietly RECORDS the last
// N console lines / network calls / breadcrumbs in memory so a bug report can snapshot
// "what just happened" on demand — in production too. It never phones home by itself;
// the only network side effect is the crash hook, which hands off to bugReporter
// (deduped + capped there).
//
// MUST be the FIRST import in main.tsx: App.tsx transitively pulls in remoteConsole, and
// both patch console/fetch. Each wrapper preserves and calls the original, so the chain
// works in any order — but installing this one first keeps its entries complete.
//
// No app imports here (keeps the module evaluable before everything else and avoids
// import cycles — bugReporter is reached via dynamic import from the crash hook only).

export type ConsoleLevel = 'log' | 'warn' | 'error' | 'info'

export interface ConsoleEntry {
  t: number
  level: ConsoleLevel
  msg: string
}

export interface NetworkEntry {
  t: number
  method: string
  url: string
  status: number // 0 = network error (fetch threw)
  ok: boolean
  durationMs: number
  error?: string
  responseSnippet?: string
}

export interface Breadcrumb {
  t: number
  type: 'route' | 'tap'
  detail: string
}

export interface CrashEvent {
  message: string
  stack?: string
  source: 'window-error' | 'unhandled-rejection'
}

export interface DiagnosticsSnapshot {
  sessionId: string
  startedAt: number
  capturedAt: number
  console: ConsoleEntry[]
  network: NetworkEntry[]
  breadcrumbs: Breadcrumb[]
}

const CONSOLE_MAX = 300
const NETWORK_MAX = 100
const BREADCRUMB_MAX = 60
const MSG_MAX_CHARS = 2000
const URL_MAX_CHARS = 200
const SNIPPET_MAX_CHARS = 500

// Same key remoteConsole uses, so dev logs and bug reports correlate on one session id.
const SESSION_KEY = 'børnelæring-session-id'

const startedAt = Date.now()
const consoleRing: ConsoleEntry[] = []
const networkRing: NetworkEntry[] = []
const breadcrumbRing: Breadcrumb[] = []

function pushRing<T>(ring: T[], entry: T, max: number): void {
  ring.push(entry)
  if (ring.length > max) ring.splice(0, ring.length - max)
}

function formatArg(arg: unknown): string {
  if (typeof arg === 'string') return arg
  if (arg instanceof Error) return `${arg.name}: ${arg.message}${arg.stack ? `\n${arg.stack.split('\n').slice(0, 4).join('\n')}` : ''}`
  try {
    return JSON.stringify(arg)
  } catch {
    return String(arg)
  }
}

function pushConsole(level: ConsoleLevel, args: unknown[]): void {
  try {
    const msg = args.map(formatArg).join(' ').slice(0, MSG_MAX_CHARS)
    pushRing(consoleRing, { t: Date.now(), level, msg }, CONSOLE_MAX)
  } catch {
    /* recording must never break the app */
  }
}

function trimUrl(url: string): string {
  try {
    if (url.startsWith(window.location.origin)) url = url.slice(window.location.origin.length)
  } catch {
    /* ignore */
  }
  return url.slice(0, URL_MAX_CHARS)
}

export function getSessionId(): string {
  try {
    let id = sessionStorage.getItem(SESSION_KEY)
    if (!id) {
      id = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
      sessionStorage.setItem(SESSION_KEY, id)
    }
    return id
  } catch {
    return 'unknown'
  }
}

/** Called from the router listener (NavigationAudioCleanup) on every route change. */
export function recordRoute(path: string): void {
  pushRing(breadcrumbRing, { t: Date.now(), type: 'route', detail: path }, BREADCRUMB_MAX)
}

export function getDiagnosticsSnapshot(): DiagnosticsSnapshot {
  return {
    sessionId: getSessionId(),
    startedAt,
    capturedAt: Date.now(),
    console: [...consoleRing],
    network: [...networkRing],
    breadcrumbs: [...breadcrumbRing],
  }
}

// ===== install (idempotent — window flag survives HMR re-evaluation) =====

declare global {
  interface Window {
    __BL_DIAG_INSTALLED__?: boolean
  }
}

function interceptConsole(): void {
  const levels: ConsoleLevel[] = ['log', 'warn', 'error', 'info']
  for (const level of levels) {
    const original = console[level].bind(console)
    console[level] = (...args: unknown[]) => {
      original(...args)
      pushConsole(level, args)
    }
  }
}

function interceptFetch(): void {
  const originalFetch = window.fetch
  window.fetch = function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    let url = ''
    let method = 'GET'
    try {
      url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
    } catch {
      /* ignore */
    }
    // Skip the logging endpoints themselves: remoteConsole POSTs one log-error per console
    // line in dev (would flood the ring), and recording our own bug-report upload is noise.
    if (url.includes('/api/log-error') || url.includes('/api/bug-report')) {
      return originalFetch.call(window, input, init)
    }

    const t = Date.now()
    const startMark = performance.now()
    return originalFetch.call(window, input, init).then(
      (response) => {
        try {
          const entry: NetworkEntry = {
            t,
            method,
            url: trimUrl(url),
            status: response.status,
            ok: response.ok,
            durationMs: Math.round(performance.now() - startMark),
          }
          if (!response.ok && url.includes('/api/')) {
            // Body snippet only for our own failing API calls — that's where the diagnosis is.
            response
              .clone()
              .text()
              .then((text) => {
                entry.responseSnippet = text.slice(0, SNIPPET_MAX_CHARS)
              })
              .catch(() => {})
          }
          pushRing(networkRing, entry, NETWORK_MAX)
        } catch {
          /* recording must never break the request */
        }
        return response
      },
      (error: unknown) => {
        try {
          pushRing(
            networkRing,
            {
              t,
              method,
              url: trimUrl(url),
              status: 0,
              ok: false,
              durationMs: Math.round(performance.now() - startMark),
              error: error instanceof Error ? error.message : String(error),
            },
            NETWORK_MAX,
          )
        } catch {
          /* ignore */
        }
        throw error
      },
    )
  }
}

function interceptTaps(): void {
  document.addEventListener(
    'pointerdown',
    (ev) => {
      try {
        const target = ev.target
        if (!(target instanceof Element)) return
        // Prefer the nearest interactive/labelled ancestor — that's the child's intent.
        const interactive = target.closest('button, a, [role="button"], [aria-label]') ?? target
        const label =
          interactive.getAttribute('aria-label') ||
          interactive.textContent?.trim().replace(/\s+/g, ' ').slice(0, 60) ||
          ''
        pushRing(
          breadcrumbRing,
          { t: Date.now(), type: 'tap', detail: `${interactive.tagName.toLowerCase()} ${label}`.trim() },
          BREADCRUMB_MAX,
        )
      } catch {
        /* ignore */
      }
    },
    { capture: true, passive: true },
  )
}

function notifyCrash(crash: CrashEvent): void {
  pushConsole('error', [`[${crash.source}] ${crash.message}`])
  // Dynamic import breaks the module cycle (bugReporter statically imports this module)
  // and keeps this file dependency-free at evaluation time.
  import('./bugReporter')
    .then((m) => m.reportCrashEvent(crash))
    .catch(() => {})
}

function interceptCrashes(): void {
  window.addEventListener('error', (ev) => {
    notifyCrash({
      message: ev.message || (ev.error instanceof Error ? ev.error.message : 'Ukendt fejl'),
      stack: ev.error instanceof Error ? ev.error.stack : undefined,
      source: 'window-error',
    })
  })
  window.addEventListener('unhandledrejection', (ev) => {
    const reason: unknown = ev.reason
    notifyCrash({
      message: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
      source: 'unhandled-rejection',
    })
  })
}

if (typeof window !== 'undefined' && !window.__BL_DIAG_INSTALLED__) {
  window.__BL_DIAG_INSTALLED__ = true
  try {
    interceptConsole()
    interceptFetch()
    interceptTaps()
    interceptCrashes()
  } catch {
    /* a failed install must never take the app down */
  }
}
