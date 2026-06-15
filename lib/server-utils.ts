import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * Decide whether a request's Origin is allowed to call our TTS/STT endpoints.
 * Same-origin browser fetches and the native PWA send no Origin → allowed. A cross-origin
 * caller must come from localhost (dev) or one of our own hosts (the request host or any
 * *.vercel.app preview/prod). This is a light billing-abuse guard, not hard auth (PRD §9.1).
 */
export function isAllowedOrigin(req: VercelRequest): boolean {
  const origin = req.headers.origin
  if (!origin) return true
  try {
    const host = new URL(origin).hostname
    if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]') return true
    if (host.endsWith('.vercel.app')) return true
    if (req.headers.host && host === req.headers.host.split(':')[0]) return true
    return false
  } catch {
    return false
  }
}

/** CORS headers scoped to the caller's own origin (not a blanket '*'). */
export function applyCors(req: VercelRequest, res: VercelResponse): void {
  const origin = req.headers.origin
  res.setHeader('Access-Control-Allow-Origin', origin && isAllowedOrigin(req) ? origin : 'null')
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

/**
 * Record a server-side error. Always writes to the Vercel function log (console.error, the
 * primary record) and, best-effort, POSTs to /api/log-error using an ABSOLUTE URL derived from
 * the request host. The previous code used a relative URL, which throws `TypeError: Failed to
 * parse URL` in a serverless function (no origin) — silently dropping every server error for a
 * year (PRD §1.1). This never throws.
 */
export async function logServerError(req: VercelRequest, scope: string, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`[${scope}] server error:`, error)

  try {
    const host = req.headers.host
    if (!host) return
    const proto = (req.headers['x-forwarded-proto'] as string) || 'https'
    await fetch(`${proto}://${host}/api/log-error`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        level: 'error',
        message: `${scope} API Error: ${message}`,
        data: { stack: error instanceof Error ? error.stack : undefined },
        device: 'Server API',
        url: req.url || `/api/${scope.toLowerCase()}`,
        timestamp: new Date().toISOString(),
      }),
    })
  } catch {
    // Never let logging failures affect the response.
  }
}
