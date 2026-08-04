---
paths:
  - "api/*.ts"
  - "dev-server.js"
  - "lib/server-utils.ts"
  - "lib/session.ts"
  - "api/auth/**"
  - "vercel.json"
---

# Serverless API endpoints (`api/*.ts`)

The Vercel functions in `api/` proxy paid services (Azure TTS, Google STT) and store bug reports.
Treat them as a trust boundary. Shared helpers live in `lib/server-utils.ts`.

## Mandatory for every endpoint

- Route through `lib/server-utils.ts`: `applyCors` + `isAllowedOrigin` (origin allow-list =
  localhost or the request's **own host** — there is **no** blanket `*.vercel.app` allow),
  `rateLimit` (in-memory per-IP guard; state resets on a cold start — it's a billing guard, not a
  wall), and `logServerError`.
- **Never leak internals**: 500s return a generic message only. Full detail (message/stack) goes to
  `logServerError` — never in the client response body (no `details: error.message`).
- **CORS lives in the functions, not `vercel.json`.** The blanket `Access-Control-Allow-Origin: *`
  was removed; `applyCors` sets a scoped origin. Don't reintroduce a `/api` header block.
- **`tsconfig.json` includes only `src`, so `api/` and `lib/` are NOT type-checked by `npm run build`.**
  Server-side type errors stay invisible until runtime — check them explicitly (a `noEmit` tsconfig
  covering `api`/`lib`) before trusting a green build. `tsconfig.server.json` now does this, but note
  its `moduleResolution: "bundler"` + `allowImportingTsExtensions` describe a bundler that **does not
  exist at deploy time** — so it type-checks a `.ts` specifier that cannot resolve in production. A
  green `typecheck:server` is not evidence the function loads; see the section below for what is.

## The auth surface is different — do NOT wrap it in the helpers above

`api/auth/[...all].ts` is a Web-standard **`fetch` export** (@vercel/node routes it through
`createWebHandler`, which builds the Request from the raw unconsumed stream). It must NOT go through
`applyCors`/`isAllowedOrigin`/`rateLimit` — those are `VercelRequest`-shaped, and better-auth already
owns origin validation (`trustedOrigins`) and DB-backed rate limiting for its paths. Its own
`try/catch` is required: the runtime's catch is a bare **unlogged** 500.

`vercel.json` `functions` keys are **globs**, so a `api/auth/[...all].ts` key parses `[...all]` as a
character class and silently matches nothing — use `"api/auth/**"`.

`/api/profiles` and `/api/progress` are ordinary functions but resolve the bearer session through
`lib/session.ts` (better-auth's own `getSession`), so they can never disagree with `/api/auth` about
what a valid session is. They live OUTSIDE `/api/auth` on purpose: `redact.sanitizeUrl` strips the
entire query+fragment from auth paths, so keeping these separate leaves them diagnosable.

## The CSP reaches API responses too — server-rendered HTML must be script-free

`vercel.json`'s `/(.*)` header rule is not "the app": it applies `Content-Security-Policy` (including
`script-src 'self'`) to **every** path, `/api/**` included. Confirm with `curl -I` against the deployed
function, never local dev.

So an inline `<script>` in HTML a function generates is dead on arrival — silently, with no error
anywhere. The Google OAuth callback handed control back via
`<script>location.replace('/#bl_auth=1')</script>` and the CSP shipped a workstream later; the automatic
return just stopped working and the adult had to notice the link and tap it. **If a page must navigate,
answer with a redirect** (a 302 returned from inside a better-auth `createAuthEndpoint` handler passes
through its router untouched); if it must inform, give it a plain link. Guarded by
`lib/server-html-csp.test.ts`.

## The deployed function is NOT what `dev-server.js` runs

Vercel compiles each `api/**` + `lib/**` file to a **sibling `.js`** and copies the tree into the
function. It does **not** bundle and it does **not** rewrite import specifiers. Two consequences, and
the accounts release shipped straight into both — every auth/profiles/progress/tts/stt endpoint was a
500 from the day it landed:

- **Relative imports in the server-reachable graph must end in `.js`** (`'../lib/session.js'`), and
  that graph includes the `src/config` modules a function imports. A `.ts` specifier ships verbatim
  and dies at import with `ERR_MODULE_NOT_FOUND` for a path ending `.ts`. Plain-node entries then need
  `--import ./scripts/js-to-ts-resolve.mjs` (already wired into every relevant npm script) — see that
  file for why an in-entry `register()` cannot work.
  **Now enforced by `lib/serverImports.test.ts`** — after this shipped a SECOND time: one dynamic
  `await import('./auth.ts')` in the OAuth callback took Google sign-in down in production, failing only
  after a real round trip to Google, and was invisible to everything local. The guard matches
  `import(...)` as well as `from '…'` for exactly that reason, and also rejects extensionless specifiers.
  Note `typecheck:server` structurally CANNOT catch this class: `allowImportingTsExtensions` resolves
  `.ts` happily and tsc only permits that flag under `noEmit`, so it type-checks a bundler that does not
  exist at deploy time.
- **`dev-server.js` cannot catch this class of bug** — it runs the real `.ts` files off disk under
  Node's type stripping, so the local mirror is green while production is uniformly broken. The
  mirror rule below protects against divergence in BEHAVIOUR; it says nothing about deployability.

### Verify a function without deploying

`npx vercel build --prod` produces the real artifact under `.vercel/output/`, and both halves of the
above are checkable there in seconds:

```bash
d=".vercel/output/functions/api/profiles.func"
( cd "$d" && node --env-file=/path/to/.env.local -e "import('./api/profiles.js')" )   # module resolution
node -e "const c=require('./.vercel/output/config.json'); console.log(c.routes)"       # the REAL route table
```

A missing env var (`[env] missing required …`) means it loaded — that is a pass for this check.

**Without the Vercel CLI** (it is not installed here by default), compile the server graph yourself and
read the OUTPUT — enough to settle any `.ts`/`.js` specifier question in seconds:

```bash
npx tsc -p tsconfig.server.json --noEmit false --outDir /tmp/srvbuild   # emits despite the TS5096 warning
grep -o "import('\./[^']*')" /tmp/srvbuild/lib/auth-family-plugin.js    # the specifier that will SHIP
test -f /tmp/srvbuild/lib/auth.js && echo "sibling exists"              # …and whether it resolves
```

That is how the `import('./auth.ts')` fix was confirmed: the emitted file must name a `.js` sibling that
is actually emitted beside it.
`.vercel/output/config.json` is the routing that ships, so read the post-`filesystem` phase there
rather than reasoning about `vercel.json`: user `rewrites` precede the generated dynamic routes, and
the generated catch-all for `api/auth/[...all]` matched only ONE path segment, so multi-segment
better-auth paths need the explicit rewrite that is now in `vercel.json`.

**Two rungs that look available and are not:** a preview deployment sits behind Vercel's SSO wall, so
every `curl` 302s to a login page (the API is unreachable, not broken), and `vercel dev` runs the
package.json `dev` script, so it fails outright when port 5173 is already taken. When only production
can answer, deploy and `curl` — and say that is the rung you used. `npx vercel logs <url> --json`
gives the full stack that the truncated table view hides.

## Two sources that MUST stay in sync

Each `api/*.ts` is mirrored in `dev-server.js` (Express, port 3001) for local dev. Change one →
change both, or dev and prod drift. `dev-server.js` reads a bit looser (e.g. bug-report GET is open
unless `BUG_REPORT_READ_KEY` is set locally; prod is fail-closed).

The full mirror list is now: tts-azure, stt, log-error, bug-report, audit-save, version, **the whole
better-auth handler** (`toNodeHandler`), **`/api/profiles`** and **`/api/progress`**. A missing mirror
shows up as a 404 only in dev — that is exactly how profile creation silently failed once.

**`dev-server.js` is Express 5, which rejects bare wildcards** — `app.all('/x/*', …)` throws a
path-to-regexp "Missing parameter name". Name the wildcard: `app.all('/x/*splat', …)`.

## Per-endpoint specifics

- `bug-report` GET is **fail-closed** on `BUG_REPORT_READ_KEY` (prod: 403 until the env is set,
  since reports contain child screenshots; then every GET needs `&key=`).
- `stt` sets `features.profanityFilter` on the recognizer + caps the base64 audio size. **The filter is
  requested but NOT sufficient**: measured, `chirp_3` masks English profanity and passes Danish through in
  the clear, so the real protection is the blocklist in `normalizeSpokenWord` (the game spells aloud what
  it hears). Model/region choice and the guard that pins them: `.claude/rules/audio-system.md`.

## Verify locally

Curl `http://127.0.0.1:3001` with/without an `Origin` header, an oversized body, and `&key=`. To
test without disturbing a running dev-server, launch a throwaway instance on another port:
`PORT=3009 node dev-server.js`.

**A running dev-server holds the shared config in memory** (and now also the better-auth instance) — after editing `shared-*.js` (voices,
output format, lexicon), kill the process on 3001 and restart, or you verify against the OLD values.
A `curl` 200 only proves *something* is listening, and starting a second instance silently no-ops on
a bound port: this is how a "verified" TTS response came back as Ogg while the source said MP3.
