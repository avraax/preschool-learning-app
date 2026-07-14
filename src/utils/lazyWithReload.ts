import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

// Stale-chunk recovery for lazy() routes (PRD-08 §P1).
//
// Every route component is code-split. Vercel replaces the deployment on each push, so a client
// that was opened BEFORE a deploy will 404 on the old hashed chunk the moment the child navigates
// to a not-yet-loaded section. Left alone, that dynamic-import rejection bubbles to
// AppErrorBoundary → the child sees "Ups! Noget gik galt" AND an automatic crash report is burned.
//
// Instead: catch a chunk/dynamic-import failure and reload ONCE (a fresh page load pulls the new
// index.html + new chunk hashes). A sessionStorage flag guards against a reload loop if the reload
// itself can't fetch the chunk (genuinely broken deploy / offline) — after one failed retry we
// rethrow so the error boundary handles it normally. The flag is cleared on any successful load,
// so a later deploy can recover again within the same session.

const RELOAD_FLAG = 'bl-chunk-reload'

// Match the various shapes browsers/bundlers use for "couldn't load the JS chunk".
export function isChunkLoadError(err: unknown): boolean {
  if (!err) return false
  const e = err as { name?: unknown; message?: unknown }
  const name = typeof e.name === 'string' ? e.name : ''
  const msg = typeof e.message === 'string' ? e.message : ''
  return (
    name === 'ChunkLoadError' ||
    /Loading chunk \d+ failed/i.test(msg) ||
    /Loading CSS chunk/i.test(msg) ||
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg)
  )
}

function readFlag(): boolean {
  try {
    return sessionStorage.getItem(RELOAD_FLAG) === '1'
  } catch {
    return false
  }
}
function writeFlag(v: boolean): void {
  try {
    if (v) sessionStorage.setItem(RELOAD_FLAG, '1')
    else sessionStorage.removeItem(RELOAD_FLAG)
  } catch {
    /* private mode — reload guard degrades to "reload every time", still bounded by real navigation */
  }
}

// The recovery core, factored out so it's independently testable (the lazy() wrapper below only
// defers WHEN this runs). Resolves the module on success; on a chunk failure reloads once and
// returns a never-resolving promise (keeps Suspense up until the document is replaced); otherwise
// (non-chunk error, or a reload already tried this session) rethrows.
// `doReload` is injectable purely so the recovery path is testable without navigating the harness;
// production always uses the default full-page reload.
export function importWithReload<T>(
  factory: () => Promise<T>,
  doReload: () => void = () => window.location.reload(),
): Promise<T> {
  return factory()
    .then((mod) => {
      // Chunks are healthy again → allow a future deploy to trigger a fresh recovery reload.
      writeFlag(false)
      return mod
    })
    .catch((err) => {
      if (isChunkLoadError(err) && typeof window !== 'undefined' && !readFlag()) {
        writeFlag(true)
        doReload()
        // Never resolve: keep the Suspense fallback up until the reload swaps the document,
        // so React never renders the error boundary for this (recoverable) failure.
        return new Promise<T>(() => {})
      }
      throw err
    })
}

// Drop-in replacement for React.lazy that adds the reload-once recovery. Used for every route.
// Bound mirrors React.lazy's own (`ComponentType<any>`) so route components with required props
// (e.g. MathOperationGame's `operation`) keep typechecking through the wrapper.
export function lazyWithReload<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
): LazyExoticComponent<T> {
  return lazy(() => importWithReload(factory))
}

export default lazyWithReload
