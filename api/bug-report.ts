import type { VercelRequest, VercelResponse } from '@vercel/node'
import { put, list } from '@vercel/blob'
import { applyCors, isAllowedOrigin, logServerError, rateLimit } from '../lib/server-utils.js'

// Bug report storage (Bug Report feature).
//
// POST  { report: <BugReportPayload>, screenshot?: <jpeg data URL> }
//       → Vercel Blob: bug-reports/<YYYY-MM-DD>/<ID>/report.json (+ screenshot.jpg)
//       → { ok, id, url, screenshotUrl }
// GET   ?id=R7K3F            → { id, uploadedAt, url, screenshotUrl, report }
// GET   ?list=10 (default 20) → { reports: [summaries, newest first], total }
//       &expand=1             → adds a per-report summary (type/category/route/note/error)
//                               for the 10 newest, so a list is readable without N lookups
//
// GETs (list + fetch reports, which include a SCREENSHOT of a child's screen, device fingerprint,
// timezone, progress and route history) REQUIRE the BUG_REPORT_READ_KEY env + a matching ?key=...
// This is fail-closed: if the env is unset the read endpoint returns 403 rather than exposing the
// data (PRD-03 §P3). Set BUG_REPORT_READ_KEY in the Vercel project env to enable reads.
// Requires a Vercel Blob store connected to the project (BLOB_READ_WRITE_TOKEN).

const PREFIX = 'bug-reports/'
// No I/L/O/0/1 — a code like "R7K3F" must be unambiguous when read off an iPad screen.
const ID_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const ID_LENGTH = 5
const MAX_BODY_BYTES = 4_400_000
const MAX_SCREENSHOT_CHARS = 3_000_000
// list() reads at most this many blobs; beyond that, lookups need cursor pagination.
// Two files per report → ~500 reports. Fine at family scale.
const LIST_LIMIT = 1000

function makeId(): string {
  let id = ''
  for (let i = 0; i < ID_LENGTH; i++) {
    id += ID_ALPHABET[Math.floor(Math.random() * ID_ALPHABET.length)]
  }
  return id
}

function queryParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCors(req, res)
  // applyCors advertises POST only — this endpoint also serves GET.
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }
  if (req.method === 'GET') {
    return handleGet(req, res)
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (!isAllowedOrigin(req)) {
    return res.status(403).json({ error: 'Forbidden origin' })
  }
  // Guard against a flood of uploads burning Blob storage/bandwidth.
  if (!rateLimit(req, res, { scope: 'bug-report', limit: 20, windowMs: 60_000 })) {
    return
  }

  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return res.status(500).json({
        error: 'Blob storage not configured (BLOB_READ_WRITE_TOKEN missing — create a Blob store in the Vercel dashboard)',
      })
    }
    const contentLength = Number(req.headers['content-length'] || 0)
    if (contentLength > MAX_BODY_BYTES) {
      return res.status(413).json({ error: 'Report too large' })
    }

    const { report, screenshot } = (req.body ?? {}) as { report?: unknown; screenshot?: unknown }
    if (!report || typeof report !== 'object') {
      return res.status(400).json({ error: 'report (object) is required' })
    }
    if (
      screenshot !== undefined &&
      (typeof screenshot !== 'string' ||
        !screenshot.startsWith('data:image/jpeg;base64,') ||
        screenshot.length > MAX_SCREENSHOT_CHARS)
    ) {
      return res.status(400).json({ error: 'screenshot must be a jpeg data URL under 3MB' })
    }

    const date = new Date().toISOString().slice(0, 10)

    // addRandomSuffix defaults to false, so put() throws if the pathname already exists —
    // that IS the collision check; retry with a fresh id.
    let id = makeId()
    let stored: { url: string } | null = null
    for (let attempt = 0; attempt < 3 && !stored; attempt++) {
      try {
        stored = await put(
          `${PREFIX}${date}/${id}/report.json`,
          JSON.stringify({ id, receivedAt: new Date().toISOString(), ...report }),
          { access: 'public', contentType: 'application/json' },
        )
      } catch (e) {
        if (attempt === 2) throw e
        id = makeId()
      }
    }

    let screenshotUrl: string | null = null
    if (typeof screenshot === 'string') {
      const jpeg = Buffer.from(screenshot.slice(screenshot.indexOf(',') + 1), 'base64')
      const shot = await put(`${PREFIX}${date}/${id}/screenshot.jpg`, jpeg, {
        access: 'public',
        contentType: 'image/jpeg',
      })
      screenshotUrl = shot.url
    }

    console.log(`[BUG REPORT] stored ${id} (${date}), screenshot: ${screenshotUrl ? 'yes' : 'no'}`)
    return res.status(200).json({ ok: true, id, url: stored!.url, screenshotUrl })
  } catch (error) {
    await logServerError(req, 'BugReport', error)
    return res.status(500).json({ error: 'Failed to store bug report' })
  }
}

async function handleGet(req: VercelRequest, res: VercelResponse) {
  if (!isAllowedOrigin(req)) {
    return res.status(403).json({ error: 'Forbidden origin' })
  }
  // Fail-closed: reads expose child screenshots + device/progress data, so they are DENIED unless
  // an admin read key is configured AND supplied. No env → no reads (PRD-03 §P3).
  const readKey = process.env.BUG_REPORT_READ_KEY
  if (!readKey) {
    return res.status(403).json({ error: 'Read access not configured' })
  }
  if (queryParam(req.query.key) !== readKey) {
    return res.status(401).json({ error: 'Invalid key' })
  }

  try {
    const { blobs } = await list({ prefix: PREFIX, limit: LIST_LIMIT })

    const id = queryParam(req.query.id)?.toUpperCase()
    if (id) {
      const reportBlob = blobs.find((b) => b.pathname.endsWith(`/${id}/report.json`))
      if (!reportBlob) {
        return res.status(404).json({ error: `No report ${id}` })
      }
      const screenshotBlob = blobs.find((b) => b.pathname.endsWith(`/${id}/screenshot.jpg`))
      const report = await (await fetch(reportBlob.url)).json()
      return res.status(200).json({
        id,
        uploadedAt: reportBlob.uploadedAt,
        url: reportBlob.url,
        screenshotUrl: screenshotBlob?.url ?? null,
        report,
      })
    }

    const n = Math.min(Math.max(parseInt(queryParam(req.query.list) ?? '20', 10) || 20, 1), 100)
    interface ReportSummary {
      id: string
      date: string
      uploadedAt: Date
      size: number
      url: string
      screenshotUrl: string | null
      summary?: {
        type?: string
        category?: string
        route?: string
        version?: string
        note?: string
        error?: string
      }
    }
    const reports: ReportSummary[] = blobs
      .filter((b) => b.pathname.endsWith('/report.json'))
      .sort((a, b) => +new Date(b.uploadedAt) - +new Date(a.uploadedAt))
      .slice(0, n)
      .map((b) => {
        const match = b.pathname.match(/^bug-reports\/([^/]+)\/([^/]+)\/report\.json$/)
        return {
          id: match?.[2] ?? '?',
          date: match?.[1] ?? '?',
          uploadedAt: b.uploadedAt,
          size: b.size,
          url: b.url,
          screenshotUrl:
            blobs.find((s) => s.pathname === b.pathname.replace('report.json', 'screenshot.jpg'))
              ?.url ?? null,
        }
      })

    if (queryParam(req.query.expand) === '1') {
      await Promise.all(
        reports.slice(0, 10).map(async (r) => {
          try {
            const full = await (await fetch(r.url)).json()
            r.summary = {
              type: full.type,
              category: full.category,
              route: full.app?.route,
              version: full.app?.version,
              note: typeof full.note === 'string' ? full.note.slice(0, 120) : undefined,
              error: typeof full.error?.message === 'string' ? full.error.message.slice(0, 160) : undefined,
            }
          } catch {
            /* summary is best-effort */
          }
        }),
      )
    }
    return res.status(200).json({ reports, total: reports.length })
  } catch (error) {
    await logServerError(req, 'BugReport', error)
    return res.status(500).json({ error: 'Failed to read bug reports' })
  }
}

export const config = {
  runtime: 'nodejs',
  maxDuration: 15,
}
