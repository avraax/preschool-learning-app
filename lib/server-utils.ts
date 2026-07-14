import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * Decide whether a request's Origin is allowed to call our TTS/STT endpoints.
 *
 * A cross-origin caller must come from localhost (dev) or the request's own host (the browser
 * app / installed PWA POST from the same deployment — prod and each preview both satisfy this
 * because the Origin matches the host they were served from). We deliberately DROPPED the old
 * blanket `*.vercel.app` allow (PRD-03 §P3) — anyone can deploy a `*.vercel.app` site and proxy
 * our paid endpoints. Requests with no Origin (server-to-server, curl, the /debug-report skill)
 * are still allowed here; the real billing/abuse guard for those is the per-IP rate limiter.
 * This is a light guard, not hard auth.
 */
export function isAllowedOrigin(req: VercelRequest): boolean {
  const origin = req.headers.origin
  if (!origin) return true
  try {
    const host = new URL(origin).hostname
    if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]') return true
    if (req.headers.host && host === req.headers.host.split(':')[0]) return true
    return false
  } catch {
    return false
  }
}

/** Best-effort client IP for rate limiting (Vercel sets x-forwarded-for). */
export function clientIp(req: VercelRequest): string {
  const fwd = req.headers['x-forwarded-for']
  const raw = Array.isArray(fwd) ? fwd[0] : fwd
  const first = raw?.split(',')[0]?.trim()
  return first || req.socket?.remoteAddress || 'unknown'
}

// Fixed-window per-IP counters. In-memory is fine: Fluid Compute reuses instances, and this is a
// billing GUARD, not a wall — state resetting on a cold start is acceptable (PRD-03 §5).
interface RateBucket {
  count: number
  resetAt: number
}
const rateBuckets = new Map<string, RateBucket>()

/**
 * Fixed-window rate limit. Returns true if the request is allowed; on refusal it has already
 * written a 429 (with Retry-After) to `res`, so the caller should just `return`.
 */
export function rateLimit(
  req: VercelRequest,
  res: VercelResponse,
  opts: { scope: string; limit: number; windowMs: number }
): boolean {
  const now = Date.now()
  const key = `${opts.scope}:${clientIp(req)}`

  // Opportunistic prune so the map can't grow unbounded across a long-lived instance.
  if (rateBuckets.size > 5000) {
    for (const [k, b] of rateBuckets) {
      if (b.resetAt <= now) rateBuckets.delete(k)
    }
  }

  let bucket = rateBuckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + opts.windowMs }
    rateBuckets.set(key, bucket)
  }
  bucket.count++

  if (bucket.count > opts.limit) {
    const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))
    res.setHeader('Retry-After', String(retryAfter))
    res.status(429).json({ error: 'Too many requests' })
    return false
  }
  return true
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
