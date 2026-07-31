import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// SERVER-RENDERED HTML MUST BE SCRIPT-FREE.
//
// `vercel.json` applies its `/(.*)` header rule — which includes `Content-Security-Policy: … script-src
// 'self' …` — to EVERY path, API routes included. Verified against production:
//
//   curl -I https://…/api/auth/family/oauth/callback
//   → Content-Security-Policy: default-src 'self'; script-src 'self'; …
//
// So an inline `<script>` in a response our own functions generate is dead on arrival. That is not
// hypothetical: the Google OAuth callback page handed control back to the app with
// `<script>location.replace('/#bl_auth=1')</script>`, and W11 added the CSP afterwards. The automatic
// return silently stopped working and the adult had to notice the link and tap it — no error, nothing in
// a log, and only reachable through a real Google sign-in. The success path is a 302 now.
//
// Nothing here forbids server-rendered HTML. It forbids HTML that needs script to function: if a page
// must navigate, answer with a redirect, and if it must inform, give it a plain link.

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function serverSources(): string[] {
  const out: string[] = []
  for (const dir of ['lib', 'api', path.join('api', 'auth')]) {
    const abs = path.join(ROOT, dir)
    let entries: string[]
    try {
      entries = readdirSync(abs)
    } catch {
      continue
    }
    for (const name of entries) {
      if (!name.endsWith('.ts') || name.endsWith('.test.ts')) continue
      out.push(path.join(dir, name))
    }
  }
  return out
}

/**
 * Drop comments before scanning — the invariant is about HTML we GENERATE, not prose about it, and the
 * note explaining why the callback stopped using an inline script naturally quotes the tag.
 *
 * Deliberately conservative: block comments, plus lines that START with `//` or a block-comment
 * continuation `*`. A blanket `//` strip would also eat the tail of any line containing a URL, which
 * could hide a real offender further along it.
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*)/.test(line))
    .join('\n')
}

test('no server-generated HTML contains an inline <script> — the CSP blocks it', () => {
  const offenders: string[] = []
  for (const rel of serverSources()) {
    const src = stripComments(readFileSync(path.join(ROOT, rel), 'utf8'))
    // Only the tag itself.
    if (/<script[\s>]/i.test(src)) offenders.push(rel)
  }
  assert.deepEqual(
    offenders,
    [],
    `inline <script> in server HTML is blocked by the CSP (script-src 'self'): ${offenders.join(', ')}`,
  )
})

test('the OAuth callback hands back with a redirect, not a page that scripts itself', () => {
  const src = readFileSync(path.join(ROOT, 'lib', 'auth-family-plugin.ts'), 'utf8')
  assert.match(src, /status: 302/, 'the success path must be a redirect')
  assert.match(src, /location: RETURN_URL/, 'and it must point at the app return URL')
  // Belt and braces on the payload the fragment carries: a secret must never ride back in the URL.
  assert.match(src, /const RETURN_URL = '\/#bl_auth=1'/)
})
