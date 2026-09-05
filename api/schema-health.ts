// "Is this deployment's DATABASE in sync with the CODE it is running?"
//
// WHY THIS EXISTS, and why it is a server endpoint rather than a script. On 2026-09-05 sign-in was
// dead on production — 500 on `/api/auth/family/oauth/start` for BOTH providers, on the web and in
// the shell — because the code had shipped four columns (`client`, `failureCode`, `failureMessage`,
// `failedAt` on `oauthFlow`) that `npm run auth:migrate` had only ever been run against the STAGING
// database. Nothing connected the deploy to the migration, and nothing could notice: every other
// route was fine, `/api/auth/family/providers` answered 200, and the failing INSERT returned an empty
// 500 body by design (`api-endpoints.md`: no error-detail leaks).
//
// A local script could not be the answer, because a local script is exactly what nobody ran. It needs
// the production DATABASE_URL plus the signing secrets, and Vercel refuses to hand back a
// SENSITIVE-flagged value at all — so checking production meant assembling an env by hand. That
// friction IS the root cause. Here the credentials are already present, so the check is one GET.
//
// WHAT IT DELIBERATELY DOES NOT RETURN: table or column names. `inSync` plus counts is everything a
// release gate needs, and naming the drift would describe this app's schema to anyone who asks. No
// key is required precisely so the check is frictionless; a boolean is not worth protecting.
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getMigrations } from 'better-auth/db/migration'
// `.js`, NOT `.ts` — Vercel compiles each file to a sibling `.js` and rewrites no specifiers, so a
// `.ts` here is a production-only ERR_MODULE_NOT_FOUND. See CLAUDE.md / api-endpoints.md.
import { auth } from '../lib/auth.js'
import { tier } from '../lib/env.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
  if (req.method === 'OPTIONS') return void res.status(200).end()
  if (req.method !== 'GET') return void res.status(405).json({ error: 'Method not allowed' })

  try {
    const { toBeCreated, toBeAdded } = await getMigrations(auth.options)
    const tables = toBeCreated.length
    const columns = toBeAdded.reduce((n: number, t: { fields: object }) => n + Object.keys(t.fields).length, 0)
    const inSync = tables === 0 && columns === 0
    // 200 either way: this reports a FACT, and a non-200 would make the row indistinguishable from a
    // dead deployment in any checklist that only reads status codes.
    res.status(200).json({ tier: tier(), inSync, missing: { tables, columns } })
  } catch {
    // Never leak the driver's error text — it carries the connection string's host and user.
    res.status(500).json({ error: 'schema check failed' })
  }
}
