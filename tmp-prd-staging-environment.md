# PRD — two backends, and a build that says which one it is

**Authored 2026-08-08. NOT implemented.** Self-contained: a session should be able to build this
without re-reading `tmp-prd-app-store-ios.md`. Everything it needs from that document is quoted here.

Today there is exactly one backend. The Vercel project `preschool-learning-app` auto-deploys from
`master` to `boernelaering.dk`, and the Neon marketplace resource behind it holds the child's real
Reward Book. Local `npm run dev:api` reads `.env.local`, which points at that same database. The
TestFlight build on the iPad has `https://boernelaering.dk` compiled into it. So a seed script, a
schema experiment, a wipe, or a half-finished feature on a test build all land in the one place that
must not break — and nothing in the app, the binary or the build log says which backend is in play.

This splits that into **staging** and **production**, and makes the distinction visible from across the
room. It changes no production behaviour: production keeps its host, its database, its bundle ID, its
app record and its auto-deploy from `master`.

---

## 1. What this is, and what it deliberately is not

**Two tiers, not three.** `staging` is one deployed Vercel project with its own Neon database, shared
by local development *and* everyday TestFlight builds. `production` is what exists today, untouched.
There is no per-developer environment and no "preview" tier: Vercel preview deployments sit behind the
SSO wall, so `curl` gets a 302 and nothing about them can be verified (`.claude/rules/env-and-secrets.md`),
and `lib/env.ts` already disables passkeys on `runtime() === 'preview'` for the same class of reason.

**Two apps on the iPad, not one that switches.** Separate bundle IDs, separate App Store Connect
records, separate TestFlight tracks, separate on-device containers. §6.1 states that trade-off once and
the condition that would flip it.

**The backend is a compile-time constant, still.** `src/config/apiBase.ts` explains why
`SHELL_API_ORIGIN` cannot be an environment variable: the value is baked into a binary going through
App Store review, which has no environment to read. That does not change. It becomes *build*-
configurable — one of exactly two literals chosen by the CI workflow and inlined by Vite — never a
runtime switch, never something the child's device can change, never a setting in the adult menu.

**Not doing:** Android; OTA/live updates (Guideline 2.5.2, and `capacitorConfig.test.ts` fails if a
`server.url` or a live-update package returns); a third tier; per-branch preview databases; changing
production behaviour, the store listing, the donation/IAP work, or the submission itself.

---

## 2. What the implementing session must know before touching anything

### 2.1 Measured this session, 2026-08-08, from Windows

| Fact | How it was measured |
|---|---|
| Vercel scope `allan-brink-vraas-projects`, org id `team_GacOLmNdUS9It9R5VRX8EZQH`. One relevant project: `preschool-learning-app`, id `prj_v2udwWWfF0EVyn73hoQsdBaUUEXd`, production URL `https://boernelaering.dk` | `npx vercel project ls`, `.vercel/project.json` |
| The database is the marketplace resource **`neon-apricot-leaf`**, connected to that one project | `npx vercel integration ls` |
| **The 16 integration-owned variables, now enumerated** (`env-and-secrets.md` said "16" and never listed them): `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `POSTGRES_URL`, `POSTGRES_URL_NON_POOLING`, `POSTGRES_URL_NO_SSL`, `POSTGRES_PRISMA_URL`, `POSTGRES_HOST`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DATABASE`, `PGHOST`, `PGHOST_UNPOOLED`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`, `NEON_PROJECT_ID` — all scoped Production+Preview+Development, all created together | `npx vercel env ls` |
| `vercel integration add` carries a **`--prefix`** flag (`--prefix NEON2_` yields `NEON2_DATABASE_URL`). Not needed here — staging is a separate project — but it is the escape hatch if two resources ever share a project | `npx vercel integration add neon --help` |
| That same `--help` does **not** print Neon's `-m` metadata keys or its plan IDs on CLI 54.12.2. `env-and-secrets.md` claims it does; on this version it does not. Region and plan must be chosen in the browser flow | measured |
| **Sign in with Apple is not live in production.** `https://boernelaering.dk/api/auth/family/providers` answers `{"providers":["google"]}`, and no `APPLE_*` variable exists in the Vercel project. The code shipped in `ec15418`; the environment did not follow | `curl` + `npx vercel env ls \| grep -i apple` (no rows) |
| `staging.boernelaering.dk` does not resolve — free to claim. `boernelaering.dk` is the only domain on the account; registrar and nameservers are both **third party**, so DNS records are added at the registrar, not in Vercel | `curl`, `npx vercel domains ls` |
| `app-store-connect.exe` **0.69.0** is installed at `C:/Users/AllanBrinkVraa/AppData/Roaming/Python/Python313/Scripts/` — the path `.claude/rules/ios-shell.md` documents | `ls` |
| Production serves `fc48c00` / `v1.0.45`; working tree clean | `/api/version`, `git status` |

**UNKNOWN, and why** — the App Store Connect `.p8` is not on this machine (`.gitignore` refuses `*.p8`
and it lives outside the repo), so no live Apple probe was possible. The current App ID list, the app
record's state and whether a second App ID already exists are all UNKNOWN. §9 says what the owner has
to look up.

### 2.2 The eight repo facts that will bite

1. **`import.meta.env.DEV` is `false` in every `vite build`, regardless of `--mode`.** So the backend
   badge cannot be DEV-gated — a normal build would tree-shake it away, which is exactly the build that
   needs it. `src/utils/devHarness.ts:24-38` documents this and `src/utils/harnessBuild.test.ts` pins
   it. Use the `__HARNESS__` pattern instead (a Vite `define` constant with a `typeof … !== 'undefined'`
   guard so plain-Node `--test` can still import the module).
2. **Relative imports carry an explicit extension**, and `.js` for anything a Vercel function reaches
   *transitively* — `api/`, `lib/`, and the `src/config` modules they pull. `lib/env.ts` is imported by
   `api/*`, `lib/auth.ts` **and** `dev-server.js`, so anything added to it must be dependency-free and
   `.js`-suffixed. A `.ts` specifier there is a production-only `ERR_MODULE_NOT_FOUND`.
3. **`.gitignore` carries a blanket `*.json`** with a short `!` allow-list. It has already caused one
   production outage (`public/manifest.json`) and one near-miss (the asset catalog's `Contents.json`).
   Any JSON this work needs versioned wants its own `!` negation, and `git check-ignore -v <path>`
   before committing.
4. **`npm run build` rewrites `src/config/version.ts`** (the `generateVersionPlugin` `buildStart` hook —
   it fires on `vite dev` too). A dirty tree after a build is expected and is never committed.
5. **Never edit a file with a shell text pipeline.** A PowerShell `-replace` re-encodes and mojibakes
   every `æøå`; a `node -e` heredoc command-substitutes backticks and silently drops what was inside.
   Use the Edit tool. Every Danish string here is affected.
6. **Another session may be in this tree.** Check `git log` as well as `git status`; commit promptly;
   `master` is the deploy trigger; never `taskkill //IM node.exe` (the `dev:staging` script in W5 must
   not do this either).
7. **`vercel env` traps**: `--force` is a silent no-op on an existing variable — `vercel env rm NAME
   <env> --yes` then `vercel env add`. `vercel env add NAME preview` fails non-interactively with
   `git_branch_required` unless an explicit **empty** third argument is passed. `vercel env pull`
   overwrites the target file wholesale — always pull to a scratch path. **Env changes never reach an
   existing deployment; a redeploy is required.** And `vercel deploy` aborts uploading this repo
   without `--archive=tgz` (thousands of prebaked mp3s).
8. **House rules that apply unchanged**: no emoji anywhere in the UI (`noEmoji.test.ts`, allowlist
   empty — `lucide-react` on adult surfaces); Danish for all user-facing text; 44px minimum touch
   targets; the adult surface's group/item structure is guarded data in `src/config/adultSettingsIa.ts`
   and must not grow a seventh group; every irreversible adult action is type-to-confirm with a fixed
   Danish word.

---

## 3. Out of scope

Implementing any of this — this document produces no scripts, no env files, no `codemagic.yaml` edits,
no code. Creating or paying for anything in the Apple, Vercel or Neon accounts (§8 lists those as owner
steps). Android or any second platform. OTA / live updates. Changing production behaviour, the App
Store listing, the donation/IAP work (its own PRD), or the submission itself.

---

## 4. The two tiers

### 4.1 The tuple

Everything about a build is decided by which row it is. There are exactly two rows and
`src/config/buildTiers.test.ts` (W8) fails if a third appears anywhere.

| | **production** | **staging** |
|---|---|---|
| `BL_TIER` | `production` | `staging` |
| API origin (baked into the shell) | `https://boernelaering.dk` | `https://staging.boernelaering.dk` |
| Vercel project | `preschool-learning-app` | `boernelaering-staging` |
| Deploy trigger | push to `master` (auto) | `npm run deploy:staging` (on demand) |
| Neon resource | `neon-apricot-leaf` | `bl-staging` |
| `BETTER_AUTH_URL` | `https://boernelaering.dk` | `https://staging.boernelaering.dk` |
| `WEBAUTHN_RP_ID` | `boernelaering.dk` | `staging.boernelaering.dk` |
| Bundle ID | `com.vraa.earlylearning` | `com.vraa.earlylearning.staging` |
| Home-screen name | `Børnelæring` | `BL Test` |
| Codemagic workflow | `ios-release` | `ios-staging` |
| Backend badge in-app | **absent** | **present** |
| Local `.env.local` may point here | never | always |

Local development is the staging tier: `.env.local` carries the staging Neon URL, and the Vite dev
server plus `dev-server.js` on 3001 are the app. It never talks to the staging *deployment* — it has
its own API — but it shares staging's database, which is the point.

### 4.2 How a binary announces itself

Three answers, in increasing effort, and they cannot disagree because all three read the same value:

1. **The home screen.** `Børnelæring` or `BL Test`.
2. **The badge.** A small pill in the top-left corner on any non-production build, reading the backend
   host. It is not a flag that says "this is staging" — it prints the origin the build actually calls,
   so a mislabelled build is structurally impossible.
3. **The adult menu.** "Til de voksne" → the rail footer version chip, which today reads
   `v1.0.45 · fc48c00`, gains the backend host on **every** tier. That is how a *production* binary
   answers the question, since it has no badge.

### 4.3 Why the badge derives from the origin rather than from `BL_TIER`

A boolean can be wrong. `BL_TIER=production` on a build compiled against the staging host would produce
a badge-free binary talking to the wrong database, and nothing would catch it in the app. Deriving the
label from the effective backend origin — `window.location.origin` on the web, the compiled constant in
the shell — means the badge is absent **exactly when** the backend is production. `BL_TIER` still
exists, because the server needs it (W4) and the CI needs it to pick a tuple, but the badge does not
trust it.

---

## 5. Work items

### W1 — Two build constants, injected the way `__HARNESS__` already is

**Files:** `vite.config.ts`, `src/config/apiBase.ts`.

`vite.config.ts` already has a `define` block:

```ts
define: {
  __HARNESS__: JSON.stringify(harness),
  ...(harness ? { 'process.env.NODE_ENV': '"production"' } : {}),
},
```

Add two, read from the build environment with production as the default:

```ts
__BL_API_ORIGIN__: JSON.stringify(process.env.BL_API_ORIGIN ?? 'https://boernelaering.dk'),
__BL_TIER__: JSON.stringify(process.env.BL_TIER ?? 'production'),
```

**Default to production on purpose.** A build with no environment — a local `npm run build`, a Vercel
build of the production project, anything unexpected — is the safe one. A staging build is an explicit
act.

`src/config/apiBase.ts` keeps its whole doc comment, including the "domain move is asymmetric"
paragraph, and `SHELL_API_ORIGIN` stops being a literal:

```ts
declare const __BL_API_ORIGIN__: string | undefined
export const SHELL_API_ORIGIN =
  typeof __BL_API_ORIGIN__ !== 'undefined' ? __BL_API_ORIGIN__ : 'https://boernelaering.dk'
```

The `typeof` guard is not decoration: `apiBase.test.ts` imports this module in plain Node, where the
global does not exist. Vite replaces the identifier textually, so `typeof __BL_API_ORIGIN__` becomes
`typeof "https://…"` — valid, and constant-folded.

Add one paragraph to the existing comment: the value is still a constant baked per build and still
unreachable from the device; what changed is that CI now chooses between **two** literals, and the
asymmetry argument applies to each of them independently — a staging binary in the field keeps calling
the staging host forever, which is why staging's host must not be recycled.

**Exit:** `npm test` green; `npm run build` produces a `dist/` in which `grep -c 'boernelaering.dk'`
finds the production host and zero occurrences of `staging.boernelaering.dk`;
`BL_API_ORIGIN=https://staging.boernelaering.dk npm run build` inverts that.

### W2 — `src/config/backendTarget.ts`, the one place the question is answered

**New file.** Pure, Node-importable, explicit `.ts` imports, no React, no `window` at module scope.
This is the `runtimeTarget.ts` of backends and the same rule applies: one module answers it, nobody
re-derives it.

```ts
export type BuildTier = 'staging' | 'production'
export const PRODUCTION_API_ORIGIN = 'https://boernelaering.dk'
export const STAGING_API_ORIGIN = 'https://staging.boernelaering.dk'
export const BL_TIER: BuildTier          // from __BL_TIER__, defaulting to 'production'
export function effectiveBackend(): string
export function backendLabel(origin?: string): string | null
```

- `effectiveBackend()` — `isNativeShell()` ? `SHELL_API_ORIGIN` : `window.location.origin`. In the
  shell the compiled constant *is* the backend; on the web the page origin is, because the SPA is
  served same-origin with its functions.
- `backendLabel(origin = effectiveBackend())` — returns `null` when `origin === PRODUCTION_API_ORIGIN`,
  otherwise the bare host (`staging.boernelaering.dk`, `localhost:5173`). **Null is the production
  case**, and that single equality is what the App Store guard rests on.
- Import `isNativeShell` and `SHELL_API_ORIGIN` from the existing modules; do not re-detect the
  protocol here.

`src/config/apiBase.ts` re-exporting or importing `PRODUCTION_API_ORIGIN` is fine; a second literal
copy of the host string is not — the constant lives here.

**Exit:** `backendLabel(PRODUCTION_API_ORIGIN) === null`; the production `vercel.app` fallback host
yields a non-null label (correct — it is a different host answering the same data, and saying so is
honest); `npm test` green.

### W3 — The badge, and the version chip

**New file** `src/components/common/BackendBadge.tsx`; **edit** `src/App.tsx` and
`src/components/adult/AdultSettings.tsx`.

The badge:

- Returns `null` when `backendLabel()` is null. That early return is the whole safety property.
- A small non-interactive pill, `position: fixed`, top-left, respecting `env(safe-area-inset-top)`.
  Model the geometry on `src/components/common/UpdateBanner.tsx` (which is bottom-centre, `zIndex:
  1000`, "below the adult corner button (1001) and modals") and sit at the same 1000. It must not
  cover the adult corner button and must not intercept taps — `pointerEvents: 'none'`.
- Text: `TEST · staging.boernelaering.dk`. Danish where there are words; the host is a host. No emoji,
  no `lucide-react` icon (this renders on a child-facing surface).
- Not dismissible. It is not a notification; it is a property of the binary.
- Styling comes from theme tokens (`.claude/rules/theming.md` — no hardcoded values in components),
  and accent text on a light surface uses `theme.onTileColor`.
- Mounted once in `App.tsx` next to the existing persistent chrome, not per route.

The version chip: `AdultSettings.tsx`'s `versionLine` (≈`:167`) and the displayed chip (≈`:390`) both
gain the backend host. Long form for the clipboard, short form on screen:

```
v1.0.45 · fc48c00 · boernelaering.dk            (display)
v1.0.45 · fc48c00 · boernelaering.dk · 8. aug. 2026 14:32   (copied)
```

This is rail-footer **chrome**, next to the existing bug-report button — not an IA item. Do not add a
row to `src/config/adultSettingsIa.ts` and do not add a seventh group; `adultSettingsIa.test.ts` pins
the six groups as an exact list, and `tmp-prd-adult-login-visibility.md` §2 already ruled that the
version footer is chrome.

**Exit:** rung 1 — `?nogate=1` screenshot of `/` against the dev server shows the pill reading
`localhost:5173`; a screenshot against a production-origin build shows nothing. Rung 2 — the pill does
not collide with the adult corner button at `ipad-pro` and `ipad-pro-split`. Rung 3 residue — whether
the pill is legible on the 2017 iPad at arm's length, and whether the child asks about it.

### W4 — `tier()` on the server, and the cross-check that throws

**Files:** `lib/env.ts` (+ its `lib/env.test.ts`).

```ts
export type Tier = 'staging' | 'production'
export function tier(): Tier          // BL_TIER, defaulting to 'production'
```

Then a cross-check that runs at module init, in the same spirit as `isEmailAllowed()` failing closed:
**if `tier()` and `baseURL()` disagree, throw.** `production` must pair with the production origin (or
its `preschool-learning-app.vercel.app` fallback, or a localhost origin in `runtime() === 'dev'`);
`staging` must pair with the staging origin or a localhost origin. Anything else is a misconfigured
deployment and must fail loudly on the first request rather than quietly serve the wrong database.

Keep `lib/env.ts` dependency-free — `dev-server.js` type-strips it and `api/*` imports it.

**Exit:** `lib/env.test.ts` gains cases for each pairing, including the two that must throw. Re-break
per `/re-break`: flip the pairing table's production row to accept the staging origin and prove *that*
test goes red.

### W5 — One command that brings up the whole local stack against staging

**New file** `scripts/dev-staging.mjs`; **edit** `package.json`.

```
npm run dev:staging
```

- Refuses unless `.env.local` declares `BL_TIER=staging`. Message names the file and the line to add.
- Spawns `vite` and the existing `dev:api` command as children, prefixes their output, and forwards
  `SIGINT` to both. Plain `node:child_process`, no new dependency — the repo has none for this and
  does not need one.
- **Never kills a process it did not start.** If 5173 is already bound, say so and exit: that is a
  sibling session's Vite, it already serves this working tree, and killing it has broken a sibling
  before (`.claude/rules/working-in-this-tree.md`).
- Prints, on startup, the three things a session needs to trust what it is looking at: the tier, the
  `BETTER_AUTH_URL`, and the Neon host from `DATABASE_URL` (host only, never the password).

`.env.local` for staging, as the owner will set it (§8 step 5):

```
BL_TIER=staging
BETTER_AUTH_URL=http://localhost:5173
WEBAUTHN_RP_ID=localhost
DATABASE_URL=            # staging Neon, pooled
DATABASE_URL_UNPOOLED=   # staging Neon, direct
BETTER_AUTH_SECRET=      # fresh, not production's
ACCESS_TOKEN_SECRET=     # fresh
PIN_PEPPER=              # fresh
AUTH_DEV_BYPASS=1
```

Everything else in `.env.local` (Azure, Google Cloud STT, `GOOGLE_CLIENT_*`, `AUTH_ALLOWED_EMAILS`)
stays as it is. `BETTER_AUTH_URL` is deliberately **localhost**, not the staging host: locally the app
is served by Vite on 5173 and its OAuth callback has to come back there.

**Exit:** `npm run dev:staging` brings both servers up; `curl localhost:3001/api/version` answers;
signing in locally creates a row in the staging database and none in production.

### W6 — Seed and wipe, with the database declaring its own tier

**New files:** `lib/db-tier.ts` (or `scripts/lib/db-tier.mjs` — it is script-side only, so either;
prefer `scripts/` so no Vercel function reaches it), `scripts/staging-init.mjs`,
`scripts/staging-seed.mjs`, `scripts/staging-wipe.mjs`. **Edit** `package.json`.

```
npm run staging:init
npm run staging:seed -- --children "Emil:fox:12,Ida:owl:3"
npm run staging:wipe
```

**`staging:init`** — runs the better-auth migration (`scripts/auth-migrate.mjs --apply`, which is
idempotent and creates the core tables, the passkey table, the `rateLimit` model and the five family
tables declared in `lib/auth-family-plugin.ts`), then creates a one-row table:

```sql
create table if not exists "blTier" ("tier" text primary key);
insert into "blTier" ("tier") values ('staging') on conflict do nothing;
```

**`assertStagingDatabase(pool)`** in the shared helper: read that table; proceed only if it holds
exactly `staging`. Missing table, empty table, any other value → refuse and exit non-zero.

**Why the marker and not a URL comparison.** A negative check ("this `DATABASE_URL` is not
production's") requires production's Neon host to be committed to the repo, where it does not belong,
and it silently stops protecting anything the day Neon rotates the endpoint. A marker inverts it: the
database itself says what it is, the check fails closed on absence, and **production is never touched
at all** — no marker to add, no migration to run, no connection to open. It is the same shape as
`isEmailAllowed()`: an empty list means nobody, not everybody.

`staging:init` is the only script permitted to run against a database with no marker, and it must
additionally require `BL_TIER=staging` in the environment and refuse if the `user` table already holds
rows (an existing populated database with no marker is production or something worse).

**`staging:seed`** — creates one adult (the first address in `AUTH_ALLOWED_EMAILS`), then the requested
child profiles. Argument grammar `Name:avatarId:slots`, repeated, comma-separated.

Reuse, do not reimplement:

- `defaultPersisted()` and `SCHEMA_VERSION` from `src/config/progressSchema.ts` for the v4 document.
- `xpForSlots(n)` from `src/config/progression.ts` for the XP that genuinely reaches slot *n* on the
  real curve — the same function `devHarness.ts`'s `?rewards=n` uses, so a seeded profile is
  indistinguishable from a played one.
- `AVATAR_IDS` / `normalizeAvatarId` from `src/config/avatars.ts` (the column is called
  `avatarEmoji` and holds an avatar **id** like `fox`, never a glyph).
- The session-minting shape in `scripts/auth-dev-session.mjs`, if a bearer token is wanted for `curl`.

Respect the invariants in `.claude/rules/rewards-and-progression.md`: XP and slots are a per-device
G-Counter ledger, `grantedSlots <= collectedFromLevel(globalLevel())` is an inequality, and
`progressInvariantViolations()` must return empty for every document written. Run it and assert.

**`staging:wipe`** — `assertStagingDatabase` first, then delete every row from the family tables and
the better-auth tables, leaving the schema and the marker in place. It prints the row counts it is
about to delete and requires `--yes` to proceed non-interactively.

**Exit:** `staging:seed` then opening `staging.boernelaering.dk` (or localhost) shows the seeded
children with the right number of stickers in Min Bog; `staging:wipe` returns the profile picker to
the mandatory create dialog; both scripts exit non-zero against a database with no marker.

### W7 — Two Codemagic workflows, and the bundle ID mutation

**Files:** `codemagic.yaml`, new `scripts/set-build-tier.mjs`, new `scripts/verify-build-tier.mjs`.

`codemagic.yaml`'s existing comment block is the design record for signing and must be preserved
verbatim — it names four distinct causes that each wore the same symptom. The single `ios-testflight`
workflow becomes two, sharing that history.

**`scripts/set-build-tier.mjs <tier>`** — runs on the Mac, after `npm ci` and before `npx cap sync ios`:

- Rewrites **every** `PRODUCT_BUNDLE_IDENTIFIER = …;` in `ios/App/App.xcodeproj/project.pbxproj` to the
  tier's bundle ID. Every occurrence, not the first — the pbxproj has one per build configuration.
- Rewrites `appId` in `capacitor.config.ts` and `appName` to the tier's values, so `cap sync` and the
  Info.plist display name follow.
- Refuses any tier not in the two-row table, and refuses to write a value it did not compute from that
  table.
- For `production` it is a no-op that still verifies the committed values are already correct — so the
  release workflow proves the tree is clean rather than assuming it.

It mutates a checkout on a CI machine, never a commit. Nothing is pushed from CI; the existing "Build
the web bundle" step already notes that `version.ts` goes dirty and is never committed.

**`scripts/verify-build-tier.mjs <tier>`** — runs after `npm run build`, in both workflows and
available locally:

- Greps `dist/assets/*.js` for both tier origins. The expected one must be present; the other must be
  absent. Exit non-zero otherwise.
- Greps for the string `nogate` and fails if present (the existing harness-build property, now checked
  on the artifact and not only in a unit test).
- Re-asserts the prebaked-clip count that the current "Verify the narration actually reached dist" step
  checks, or leaves that step alone — either, but not two scripts drifting apart.

This is the guard that answers "local green proves nothing about the deployed artifact". It reads what
was built, not what the source says.

**The two workflows:**

```yaml
workflows:
  ios-staging:
    name: Børnelæring — staging → TestFlight
    # …same instance_type / integrations / cache / signing comments…
    environment:
      groups: [signing]
      vars:
        XCODE_PROJECT: ios/App/App.xcodeproj
        XCODE_SCHEME: App
        BUNDLE_ID: com.vraa.earlylearning.staging
        BL_TIER: staging
        BL_API_ORIGIN: https://staging.boernelaering.dk

  ios-release:
    name: Børnelæring — production → TestFlight
    environment:
      groups: [signing]
      vars:
        XCODE_PROJECT: ios/App/App.xcodeproj
        XCODE_SCHEME: App
        BUNDLE_ID: com.vraa.earlylearning
        BL_TIER: production
        BL_API_ORIGIN: https://boernelaering.dk
```

Both keep `xcode: latest`, `node: 22`, the `bornelaering-asc` integration, the `signing` group holding
`CERTIFICATE_PRIVATE_KEY`, the `npm test` guard step, `agvtool new-version -all "$PROJECT_BUILD_NUMBER"`,
the `fetch-signing-files "$BUNDLE_ID" --type IOS_APP_STORE --certificate-key "@env:CERTIFICATE_PRIVATE_KEY"
--create` sequence, `submit_to_testflight: true` and **no `submit_to_app_store`**. The `--create` flag is
what makes the staging profile appear on its first run without a Mac, exactly as it did for production.

`BUNDLE_ID` stays a `vars:` entry rather than a group variable so `capacitorConfig.test.ts` can keep
matching it with an `m`-anchored regex — that anchoring exists because an unanchored match accepted
`com.vraa.earlylearning2`, and a suffixed staging ID makes that failure mode live again.

**Triggers.** There is no `triggering:` block today; builds are started from the Codemagic UI.
Recommended: give `ios-staging` a tag trigger so an everyday build is one command from Windows, and
leave `ios-release` manual so a production build is always a deliberate act.

```yaml
    triggering:
      events: [tag]
      tag_patterns:
        - pattern: 'tf-*'
```

Then `git tag tf-46 && git push origin tf-46` is the everyday build. Not on every push to `master`:
that burns Mac minutes and floods TestFlight processing for commits nobody intends to install.

**Exit:** both workflows green on Codemagic; the staging build installs alongside production on the
iPad; `verify-build-tier.mjs` fails the build if the tier vars are swapped (prove it by swapping them
in a scratch run, then swapping back).

### W8 — The guards

Each of these is a test file with a name, and each states what breaks without it.

| Guard | Fails when | Without it |
|---|---|---|
| **`lib/tier.test.ts`** (new) | `tier()` and `baseURL()` disagree and the module does not throw; a seed or wipe script's source opens a pool before calling `assertStagingDatabase` (source-order grep with comments stripped — the shape `lib/web-cors.test.ts` already uses for its ordering assertions) | local work, a seed or a wipe writes the child's real Reward Book, and nobody finds out until he opens Min Bog |
| **`src/config/backendTarget.test.ts`** (new) | `backendLabel(PRODUCTION_API_ORIGIN)` is not `null`; `BL_TIER` defaults to anything but `production`; `effectiveBackend()` in a stubbed `capacitor:` window returns anything but the compiled constant | a "TEST" pill ships to the App Store on the reviewed binary |
| **`src/config/buildTiers.test.ts`** (new) | `codemagic.yaml` does not hold exactly two workflows; a workflow's (`BL_TIER`, `BL_API_ORIGIN`, `BUNDLE_ID`) triple is not one of the two allowed tuples; a workflow does not run `scripts/verify-build-tier.mjs`; `submit_to_app_store` appears anywhere | a TestFlight build points at the wrong database while looking perfectly healthy — the games all work, because the games are offline by design |
| **`src/config/capacitorConfig.test.ts`** (extended, now two-valued) | *any* `PRODUCT_BUNDLE_IDENTIFIER` in the committed pbxproj is not the production ID — iterate every occurrence and require all, the shape the `IPHONEOS_DEPLOYMENT_TARGET` test already uses; or `set-build-tier.mjs`'s table contains a bundle ID outside the two allowed | a mutation script leaks into a commit and the next release is signed as staging, or `.staging` is silently accepted where the production ID was meant |
| **`scripts/verify-build-tier.mjs`** (new, run in CI and locally) | `dist/assets/*.js` contains the other tier's origin, or contains `nogate` | the source is right and the artifact is wrong — the exact failure mode that produced two outages already |
| **`src/config/apiBase.test.ts`** (extended) | its expectation of `https://boernelaering.dk/api/progress` now reads `SHELL_API_ORIGIN` instead of repeating the literal; the `fetch('/api…')` source sweep stays exactly as it is | a call site skips `apiUrl()` and quietly resolves against the app bundle, where Capacitor answers it with `index.html` — no 404, no exception |
| **`src/utils/harnessBuild.test.ts`** (unchanged; cited here) | — | it is the reason the badge cannot be `import.meta.env.DEV`-gated; a future session that "simplifies" the badge to a DEV check will strip it from every build that needs it |

After writing these, run `/re-break`: break each invariant in the direction the test measures and prove
*that* test goes red. A guard that greps source must strip comments first, or a comment mentioning the
staging host passes for the real thing.

### W9 — Write it down where the next session will find it

- **`.claude/rules/env-and-secrets.md`** — the 16 Neon variables are now enumerated (§2.1); the
  `--help` claim about metadata keys is wrong on CLI 54.12.2; add the second resource and the
  `--prefix` escape hatch.
- **`.claude/rules/ios-shell.md`** — two bundle IDs, two app records, the `set-build-tier.mjs` step,
  and the fact that `bundle-ids enable-capabilities … "Sign In with Apple"` returns 409 so the staging
  App ID needs the same portal click production needed.
- **`CLAUDE.md`** — one bullet under Key Architecture: two tiers, staging is local + everyday
  TestFlight, the badge names the backend, and production is never reachable from local work. Watch
  `npm run context:check` — `contextBudget.test.ts` caps `CLAUDE.md` at 12 000 bytes.
- **`docs/device-testing.md`** — that there are now two apps on the iPad and how to tell them apart.

---

## 6. Decisions taken, with the reasoning attached

### 6.1 A suffixed sibling bundle ID, not the same app pointed elsewhere

`com.vraa.earlylearning.staging` is a **different app** to iOS: its own App ID, its own provisioning
profile, its own App Store Connect record, its own TestFlight track, its own icon on the home screen,
and — the reason it is worth all of that — **its own app container**. A staging build cannot overwrite,
migrate or corrupt the child's local progress, cached roster, PIN verifier or audio state, because it
cannot see them. The two apps coexist on the one iPad, which is also the child's daily device.

The alternative — one bundle ID, one app, the backend chosen per build — was rejected because
installing a test build *replaces* the production app and **inherits its container**, so a schema
experiment on staging would meet the real local progress document, and the child would lose his book to
a build nobody meant him to have.

The costs, stated plainly: two near-identical icons (mitigated by the `BL Test` name and the badge, not
solved); a second ASC record and App ID to keep alive; and a second SIWA capability click that the CLI
cannot perform.

**What would flip it back:** only a requirement that the two tiers share on-device state. There is no
such requirement and there must not be — separate tiers means separate books.

### 6.2 The database declares its tier; the repo does not know production's URL

Covered in W6. The short version: a negative guard needs production's connection details in the repo
and stops working when they rotate; a positive marker fails closed on absence and never touches
production.

### 6.3 Staging deploys to its project's **production** environment

A Vercel *preview* deployment sits behind the SSO wall — `curl` gets a 302 and nothing can be verified,
which is also why `lib/env.ts` disables passkeys on `runtime() === 'preview'`. So `npm run
deploy:staging` runs `vercel deploy --prod --archive=tgz` against the staging project, with
`VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` set in the script rather than rewriting `.vercel/project.json`
(which is single-valued, gitignored, and belongs to production). `--archive=tgz` is not optional: a
bare `vercel deploy` aborts on this repo's thousands of prebaked mp3s.

The staging project is created **without a Git connection**, so `master` keeps auto-deploying
production and nothing else. That is what makes "staging is deployed on demand" true by construction
rather than by an ignored-build-step setting somebody can flip.

### 6.4 Which secrets are shared and which must be fresh

| Variable | Staging | Why |
|---|---|---|
| `BETTER_AUTH_SECRET`, `ACCESS_TOKEN_SECRET`, `PIN_PEPPER` | **fresh** | This *is* the credential-crossing risk. A staging access JWT must not verify at production; `lib/access-token.ts` keys on `ACCESS_TOKEN_SECRET` with `aud: 'bl-paid'` and `iss: baseURL()`, and sharing the secret would make a staging token spend production's Azure and Google credit |
| `BETTER_AUTH_URL`, `WEBAUTHN_RP_ID` | staging host / `staging.boernelaering.dk` | **Must be the subdomain, not the apex.** A WebAuthn RP ID may be any registrable-domain suffix of the origin, so `boernelaering.dk` would also validate on `staging.boernelaering.dk` — staging would accept production's passkeys. Note the standing rule: changing `WEBAUTHN_RP_ID` invalidates every passkey registered under the old one, so this must be right the first time |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | **shared** | One OAuth client with two more redirect URIs is simpler than a second client, and neither value is tier-sensitive |
| `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` | **shared** | One Services ID (`dk.boernelaering.web`) can carry both domains and both return URLs |
| `APPLE_BUNDLE_ID` | **differs** — `com.vraa.earlylearning.staging` | It maps to better-auth's `appBundleIdentifier`; the staging binary's identifier is not production's |
| `AZURE_SPEECH_*`, `GOOGLE_CLOUD_*` | **shared** | Same billing accounts. Stated plainly: staging TTS and STT bill the same Azure and Google credit. `AUTH_ALLOWED_EMAILS` keeps that bounded to the owner, and the prebaked narration — every line but Sig et Ord's read-back — is served as static files and costs nothing |
| `AUTH_ALLOWED_EMAILS` | **shared** | Fails closed if empty; the same one adult uses both tiers |
| `BLOB_READ_WRITE_TOKEN`, `BUG_REPORT_READ_KEY` | staging gets its own, or neither | Bug reports from a staging build should not land in the production blob store next to real ones |
| `BL_TIER` | `staging` | Production must be given `production` explicitly at the same time (§8 step 4) — the default only covers builds, not the deployed function environment |

### 6.5 `staging.boernelaering.dk`, not a `.vercel.app` host

One CNAME at the registrar buys a stable, human-readable host on a domain the owner controls — which
matters for two things a `.vercel.app` host makes uncertain: the WebAuthn RP ID (a public-suffix host
is a worse place to hang one) and Apple's domain verification for the Sign in with Apple return URL,
which is unproven on a shared Vercel domain.

**The trap that comes with it**: Apple's verification file must be served at
`/.well-known/apple-developer-domain-association.txt`. `vercel.json`'s SPA rewrite `/((?!api/).*)` →
`/index.html` would answer it with the app — except that the rewrite sits after `handle: filesystem`,
so a real static file wins. Put it in `public/.well-known/`, then **verify it actually shipped**: if
the SPA fallback answers a static path, the file is missing from the build, not misrouted. That is the
`public/manifest.json` outage in a new costume, and `.gitignore`'s blanket `*.json` is not the only way
a file can fail to ship — confirm Vite copies a dot-directory out of `public/` before assuming it does.

---

## 7. The release path, and what happens to staging data

Everyday, from Windows:

1. Work on `master`. Push. Production redeploys itself, as it does today — that is the *web*, and it is
   unaffected by any of this.
2. `npm run deploy:staging` when the staging deployment needs to catch up (only needed if something
   server-side changed; local dev does not use it).
3. `git tag tf-<n> && git push origin tf-<n>` → the `ios-staging` workflow builds, signs as
   `com.vraa.earlylearning.staging`, and uploads to the staging TestFlight track.
4. Install `BL Test` on the iPad. It sits next to `Børnelæring`. The badge in the corner says
   `staging.boernelaering.dk`. Play it. Seed and wipe freely with `npm run staging:seed` /
   `npm run staging:wipe` — nothing here can reach production.

Shipping:

5. Start `ios-release` from the Codemagic UI. Same commit, same tree; the only differences are the
   three tier vars, and `verify-build-tier.mjs` proves the artifact carries the production host.
6. Install that build from the **production** TestFlight track on the iPad, over the existing
   `Børnelæring`. It has no badge. Play it — this is the point of routing releases through TestFlight
   rather than submitting a build nobody has touched.
7. Submit **that exact build** in App Store Connect. Never a build that has not been played.

**What carries over: nothing.** Staging adults, child profiles, PINs, passkeys and progress live in a
different Neon database and a different app container, and there is no migration path between them by
design. The child's production app on the iPad is untouched by every step above. Staging test data is
disposed of with `npm run staging:wipe`, or simply left — it costs nothing and reaches nothing.

**One thing that does carry over and is worth knowing:** a passkey registered on
`staging.boernelaering.dk` is bound to that RP ID and will not unlock production, and vice versa. Two
tiers means enrolling the iPad twice. Google sign-in is the way into either.

---

## 8. What only the owner can do

None of this is code, and W1–W9 are inert without steps 1–7. **Do them in this order** — several
depend on the one before. Irreversible steps are flagged.

1. **Create the staging Vercel project.** Dashboard → Add New → Project → **Skip / do not connect a Git
   repository**. Name it exactly `boernelaering-staging`. Copy its **Project ID** from Settings →
   General; the implementing session needs it for `scripts/deploy-staging.mjs`. The org id is already
   known: `team_GacOLmNdUS9It9R5VRX8EZQH`.
   *Connecting Git here would make `master` auto-deploy staging too — the one thing this design avoids.*

2. **Point `staging.boernelaering.dk` at it.** In the staging project → Settings → Domains → Add
   `staging.boernelaering.dk`. Vercel prints a CNAME target (`cname.vercel-dns.com` or similar) — add
   that record at the registrar holding `boernelaering.dk`, which is third-party, not Vercel. Wait for
   the certificate to issue.

3. **Provision the staging database.** With the staging project selected:
   ```
   npx vercel integration add neon --name bl-staging --no-env-pull
   ```
   `--no-env-pull` is not optional: without it the command runs `vercel env pull` and overwrites
   `.env.local` wholesale. The first run may return `integration_terms_acceptance_required` with a
   `verification_uri` — accept it in the browser, then re-run the identical command. **Set the region
   to EU (Frankfurt / `eu-central-1`)** to match production and the privacy policy's data-residency
   claim; the region is chosen in the browser flow, since `--help` does not expose it on CLI 54.12.2.
   Confirm all 16 variables landed with `npx vercel env ls` against the staging project.
   *This may add a billing line — see §9.1.*

4. **Set the environment variables.** On the **staging** project (Production scope; use the CLI's
   `rm`-then-`add` dance, never `--force`):

   | Name | Value |
   |---|---|
   | `BL_TIER` | `staging` |
   | `BETTER_AUTH_URL` | `https://staging.boernelaering.dk` |
   | `WEBAUTHN_RP_ID` | `staging.boernelaering.dk` |
   | `WEBAUTHN_RP_NAME` | `Børnelæring` |
   | `BETTER_AUTH_SECRET` | **newly generated**, e.g. `openssl rand -base64 32` |
   | `ACCESS_TOKEN_SECRET` | **newly generated** |
   | `PIN_PEPPER` | **newly generated** |
   | `AUTH_ALLOWED_EMAILS` | `allanvraa@gmail.com` (same as production) |
   | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | same as production |
   | `AZURE_SPEECH_KEY` / `AZURE_SPEECH_REGION` | same as production |
   | `GOOGLE_CLOUD_PROJECT_ID` / `GOOGLE_CLOUD_CLIENT_EMAIL` / `GOOGLE_CLOUD_PRIVATE_KEY_BASE64` | same as production |
   | `APPLE_CLIENT_ID` / `APPLE_TEAM_ID` / `APPLE_KEY_ID` / `APPLE_PRIVATE_KEY` | same as production, once step 7 is done |
   | `APPLE_BUNDLE_ID` | `com.vraa.earlylearning.staging` |

   And on the **production** project, one addition: `BL_TIER` = `production`. Then **redeploy
   production** — env changes never reach an existing deployment. A redeploy of the current commit is
   enough.

5. **Point `.env.local` at staging.** Copy `.env.local` somewhere outside the repo first. Then change
   `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `BETTER_AUTH_SECRET`, `ACCESS_TOKEN_SECRET` and
   `PIN_PEPPER` to the staging values, set `BETTER_AUTH_URL=http://localhost:5173`,
   `WEBAUTHN_RP_ID=localhost`, and add `BL_TIER=staging`. Afterwards assert every pre-existing key
   survived (`grep -oE '^[A-Z0-9_]+=' .env.local` — with the `0-9`, or it misses `…_BASE64`).
   *From this moment local work cannot reach production, which is the whole point.*

6. **Add the Google redirect URIs.** Cloud Console → project `preschool-learning-app-466719` → the Web
   OAuth client → Authorised redirect URIs. Add **both** paths for staging, and confirm the localhost
   pair is there for local development:
   ```
   https://staging.boernelaering.dk/api/auth/family/oauth/callback
   https://staging.boernelaering.dk/api/auth/callback/google
   http://localhost:5173/api/auth/family/oauth/callback
   http://localhost:5173/api/auth/callback/google
   ```
   Redirect URIs **can only be confirmed by eye** — the `curl` token-exchange probe in
   `env-and-secrets.md` tells you whether the client id and secret authenticate and nothing about
   which URIs are registered.

7. **Apple.** Four things, in this order:
   - **Register the App ID `com.vraa.earlylearning.staging`** in the Developer portal. **Irreversible —
     a bundle ID cannot be renamed or reused after registration.** Enable **Sign in with Apple** and
     nothing else. This has to be a portal click: `app-store-connect bundle-ids enable-capabilities`
     returns 409 "Please select at least one configuration for Sign In with Apple".
   - **Create the App Store Connect app record** for it. Name it something obviously internal (e.g.
     `Børnelæring TEST`) — it is never submitted, but the name is taken account-wide. **The record's
     bundle ID must equal the binary's**, or upload fails with "Cannot determine the Apple ID from
     Bundle ID", and it is editable **only until the first build uploads**.
   - **Add the staging domain to the Services ID `dk.boernelaering.web`**: domain
     `staging.boernelaering.dk`, return URL
     `https://staging.boernelaering.dk/api/auth/family/oauth/callback/apple`. Apple will ask you to
     serve a verification file — that is the `public/.well-known/` trap in §6.5.
   - **Production still has no `APPLE_*` variables** (measured §2.1), so Sign in with Apple is
     currently inert on `boernelaering.dk` despite the code shipping in `ec15418`. Set them on
     production too and redeploy, or Guideline 4.8 is unmet at review. *Outside this PRD's scope but
     discovered by it — do not lose it.*

8. **Codemagic.** The `signing` group and the `bornelaering-asc` App Store Connect integration are
   already there and are shared by both workflows — nothing new to create. If the tag trigger in W7 is
   wanted, enable webhook events for tags on the connected repository (Codemagic UI → the app →
   Settings → Webhooks); without it, start both workflows by hand from the UI, which is how it works
   today.

---

## 9. UNKNOWNs

Each names what has to be looked up and by whom. None is folded into a verdict.

1. **Neon's second-resource plan and cost.** `vercel integration add neon --help` does not print plan
   IDs on CLI 54.12.2, and whether a second marketplace resource fits the current free plan is not
   knowable from here. The owner sees it at the EULA/plan screen in step 3. *If it costs money and that
   is unacceptable*, the fallback is a Neon **branch** of the existing project with an empty starting
   point, its connection string pasted by hand into the staging Vercel project — the 16 integration
   variables will not be synced, and `staging:init`'s marker becomes the only thing separating the two,
   which is weaker but still fails closed.
2. **Apple's domain verification for a subdomain**, and whether Vite copies `public/.well-known/` into
   `dist/` at all. Both are cheap to check once step 7 starts; neither could be checked from here
   without creating the App ID.
3. **Whether the ASC app record can be created before any build exists.** It could for production; it
   should here; unverified.
4. **The current App ID list and the app record's state** — no `.p8` on this machine, so no probe. Once
   the owner points at the key file, `app-store-connect bundle-ids list` and `apps list` answer both in
   one command each (`.claude/rules/ios-shell.md` has the invocation and its two path traps: full path
   to the `.exe`, and `C:/…` not `/c/…` for `--private-key`).
5. **Whether a `.vercel.app` fallback should exist for staging.** Production keeps
   `preschool-learning-app.vercel.app` alive because installed binaries cannot follow a domain move.
   The same argument applies to staging binaries, but they are disposable, so it is probably
   unnecessary. Decide when a staging domain move is actually proposed; the safe default is never to
   move it.

---

## 10. Verification

Every claim names its rung. **Unverified is not broken — say UNKNOWN.**

**Rung 1 — headless Chrome, on Windows, no Mac, no iPad.** All of W1–W6, W8 and W9 are fully checkable
here:

- `npm test`, `npm run lint`, `npm run build` green; `npm run context:check` still passes after W9.
- `node scripts/verify-build-tier.mjs production` passes after a plain `npm run build`, and fails after
  `BL_API_ORIGIN=https://staging.boernelaering.dk npm run build`. That is the artifact check, not a
  source check.
- `ui-screenshot` at `/?nogate=1` against the dev server: the badge reads `localhost:5173`, does not
  overlap the adult corner button, and does not intercept a tap on the tile beneath it.
- `staging:init` → `staging:seed --children "Emil:fox:12"` → the profile picker shows Emil and Min Bog
  shows 12 stickers → `staging:wipe` → the mandatory create dialog returns.
- `staging:wipe` against a database with no `blTier` marker exits non-zero and deletes nothing.
- `/re-break` over every guard in W8.

**Rung 2 — real WebKit with an iPad UA (`webkit.mjs --device ipad-pro`, `ipad-pro-split`).** The badge's
position under `env(safe-area-inset-top)` and in Split View, where the corner button is closest to it.

**Rung 3 — the owner's iPad.** Nothing below can be established any other way:

- That `BL Test` and `Børnelæring` both install and coexist, with distinguishable icons and names.
- That the staging binary's badge is legible at arm's length and that the child does not tap it.
- That signing into staging on the iPad does not disturb the production app's session, and that a
  passkey enrolled on one tier does not unlock the other.
- That the production release binary shows **no** badge — the App Store-facing property, and the one
  worth checking by eye on the actual build that gets submitted.

**Residue that no rung closes:** whether two similar icons confuse the child in daily use. If it does,
the fix is a visually distinct staging icon (a tinted variant of `art-src/logo/app-store-icon-1024.png`,
flattened — alpha is an upload rejection), which is a small follow-up and not part of this PRD.

---

## 11. Landing order

W1–W3 and W8's first two guards are independently landable and change nothing about production —
`__BL_API_ORIGIN__` defaults to the production host, so the tree keeps building exactly the binary it
builds today. Land them first, before any account work exists.

1. **W1** — build constants. No behaviour change.
2. **W2** — `backendTarget.ts`. No behaviour change.
3. **W3** — badge + version chip. Visible in dev immediately; invisible in production by construction.
4. **W8 (partial)** — `backendTarget.test.ts`, the extended `apiBase.test.ts`, the two-valued
   `capacitorConfig.test.ts`. Land with W1–W3, not after.
5. — *owner steps 1–6* —
6. **W4** — `tier()` and the cross-check. Needs `BL_TIER` set on both Vercel projects first, or
   production throws at module init on the next deploy. **Never land this before owner step 4.**
7. **W5, W6** — local stack, seed and wipe. Needs the staging database.
8. — *owner step 7* —
9. **W7** — the two Codemagic workflows. Needs the staging App ID and app record to exist.
10. **W8 (rest)**, **W9** — `buildTiers.test.ts`, `lib/tier.test.ts`, `verify-build-tier.mjs`, docs.

The ordering constraint that matters: **W4 after owner step 4, W7 after owner step 7.** Everything else
is a preference.

---

## 12. Kickoff prompt for the implementing session

> Implement `tmp-prd-staging-environment.md` in full, in the landing order of its §11. Stop at each
> owner step in §8 and tell me exactly what to do — do not create anything in the Apple, Vercel or Neon
> accounts yourself. Land W1–W3 plus their guards first, since they change no production behaviour.

---

## 13. Sources

- `src/config/apiBase.ts`, `src/config/apiBase.test.ts`, `src/config/runtimeTarget.ts` — the shell/web
  split and the `/api` sweep.
- `src/utils/devHarness.ts:24-38`, `src/utils/harnessBuild.test.ts` — the `__HARNESS__` pattern and why
  `import.meta.env.DEV` is unusable here.
- `capacitor.config.ts`, `src/config/capacitorConfig.test.ts` — the bundle ID's four declarations and
  the `m`-anchored `codemagic.yaml` match.
- `codemagic.yaml` — the signing history; four causes, one symptom. Preserve its comments.
- `lib/env.ts`, `lib/web-cors.ts`, `lib/web-cors.test.ts`, `lib/auth.ts`, `lib/access-token.ts` —
  `baseURL()`, `trustedOrigins()`, the no-drift property, the paid-endpoint JWT.
- `scripts/auth-migrate.mjs`, `scripts/auth-dev-session.mjs`, `lib/auth-family-plugin.ts` — schema
  creation and the five family tables.
- `src/config/progressSchema.ts`, `src/config/progression.ts`, `src/config/avatars.ts` — what a seeded
  profile document must be.
- `.claude/rules/env-and-secrets.md`, `.claude/rules/auth.md`, `.claude/rules/ios-shell.md`,
  `.claude/rules/pwa-and-device.md`, `.claude/rules/working-in-this-tree.md`.
- `tmp-prd-app-store-ios.md` §3.1, §3.9, §4.3, §4.4 — bundling, the native project, the phase-B traps,
  the owner-step table this document's §8 imitates.
- Live probes 2026-08-08, listed with their commands in §2.1.
