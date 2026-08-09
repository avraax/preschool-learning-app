---
paths:
  - ".env*"
  - "vercel.json"
  - "lib/**"
  - "api/**"
---

# Environment variables, secrets & Vercel provisioning

Secrets live in **two places that are not mirrors of each other**: the gitignored `.env.local` (read by
`dev-server.js` via `node --env-file`) and the Vercel project env (production / preview / development).
Every trap below cost real time or risked destroying credentials.

## `.env.local` is authoritative for some secrets — never overwrite it

Keys can exist **only** in `.env.local` and be absent from Vercel, and a pull then deletes them.
**Measure it, don't trust a list** — this one was wrong within days. As of 2026-08-06 only
`AUTH_DEV_BYPASS` is local-only; the Azure key, the base64 Google service-account key and the
bug-report read key have all since been added to Vercel:

```bash
npx vercel env ls 2>/dev/null | awk 'NR>4 && $1 ~ /^[A-Z]/ {print $1}' | sort -u > /tmp/v
grep -oE '^[A-Z0-9_]+=' .env.local | tr -d '=' | sort -u | comm -23 - /tmp/v   # local-only
```

- **`vercel env pull` overwrites the target file wholesale.** Run against `.env.local` it silently
  deletes anything Vercel doesn't know about. Always pull to a scratch path and copy the one key you
  want across: `vercel env pull /tmp/pulled.env --environment=development`.
- **`vercel integration add` runs `env pull` by default** → always pass **`--no-env-pull`**.
- **So does every `vercel blob create-store` / `delete-store`, and there is NO `--no-env-pull` there.**
  Measured 2026-08-08: a `delete-store` rewrote `.env.local` from the *production* project's
  *development* env — `BL_TIER`, `AUTH_DEV_BYPASS` and `BUG_REPORT_READ_KEY` gone, and the local DB
  silently repointed at PRODUCTION's Neon. It also ignores `--non-interactive` and `VERCEL_PROJECT_ID`
  (it resolves from `.vercel/project.json`). **`cp .env.local` to a scratch path before those two and
  `cmp` it after** — the pull is the LAST thing it prints, so a tail-only read of the output looks like
  a normal success. It is only those two: `blob list`, `list-stores`, `get-store`, `empty-store`,
  `env pull` and `env rm` all left `.env.local` byte-identical (measured 2026-08-09), so treating every
  `vercel` command as dangerous just makes the real warning cheap.
- **`--cwd <scratch>` is the escape hatch, and it is total.** The CLI resolves the project *and* writes
  the pulled `.env.local` from `client.cwd` (read the bundled source if you doubt it:
  `dist/commands-bulk.js`, `envPullCommandLogic(client, ".env.local", …, client.cwd, …)`). Copy
  `.vercel/project.json` into a scratch dir and pass `--cwd` — the command stays fully linked to
  production and the pull lands in the scratch dir. Verified 2026-08-09 across five `blob` /
  `integration resource` commands: the repo's `.env.local` never changed.
- Before touching `.env.local`, copy it somewhere outside the repo, then afterwards assert every
  pre-existing key survived. Note `grep -oE '^[A-Z_]+='` **misses names containing digits** (e.g. a
  `…_BASE64` suffix) — use `^[A-Z0-9_]+=`.

## TWO TIERS, TWO PROJECTS, TWO DATABASES (staging PRD)

`production` = `preschool-learning-app` (`prj_v2udwWWfF0EVyn73hoQsdBaUUEXd`) → `boernelaering.dk`, Neon
`neon-apricot-leaf`, auto-deploys from `master`. `staging` = `preschool-learning-app-staging`
(`prj_ZOnA09yX1vZZ4yXdCH680NmmP8gH`) → `staging.boernelaering.dk`, Neon `bl-staging`, **no Git
connection** — deployed only by `npm run deploy:staging`, which is what makes "on demand" true by
construction rather than by a setting somebody can flip. Org `team_GacOLmNdUS9It9R5VRX8EZQH`.

- **The CLI resolves its target from `.vercel/project.json`, which is PRODUCTION's** — single-valued and
  gitignored. Every staging command needs `VERCEL_ORG_ID` + `VERCEL_PROJECT_ID` in the environment
  instead; `vercel domains add <d> <project>` even REFUSES the two-argument form and would have added
  the staging subdomain to production. Never rewrite that file.
- **`--prod` means "this PROJECT's production environment"**, so staging deploys with it. A *preview*
  deployment sits behind the SSO wall (302 to `curl`), which is also why `lib/env.ts` disables passkeys
  on `runtime() === 'preview'`.
- **`--archive=tgz` uploads no `.git`**, so `vite.config.ts`'s `git rev-parse` fails and every staging
  build reported `commitHash: "dev"`. `scripts/deploy-staging.mjs` resolves it locally and passes
  `BL_COMMIT_SHA`.
- **Local development IS the staging tier.** `.env.local` carries `BL_TIER=staging` and the staging Neon
  URL; `npm run dev:staging` refuses to start without it. Seed/wipe are gated on a `blTier` marker
  table *in the database* — a positive check that fails closed, so production is never even connected
  to (`lib/tier.test.ts`).

## The database is a Vercel MARKETPLACE resource, not a standalone Neon project

`vercel integration ls` shows them (`neon-apricot-leaf`, `bl-staging`). Consequences:

- **The password lives in 16 integration-owned variables**, and here they are, since "16" was never a
  list: `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `POSTGRES_URL`, `POSTGRES_URL_NON_POOLING`,
  `POSTGRES_URL_NO_SSL`, `POSTGRES_PRISMA_URL`, `POSTGRES_HOST`, `POSTGRES_USER`, `POSTGRES_PASSWORD`,
  `POSTGRES_DATABASE`, `PGHOST`, `PGHOST_UNPOOLED`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`,
  `NEON_PROJECT_ID` — all scoped Production+Preview+Development, all created together. Hand-editing
  `DATABASE_URL` leaves fifteen stale copies, and the integration may re-sync over it anyway. They move
  together or not at all.
- **`--prefix NEON2_` is the escape hatch** if two resources ever have to share one project. Not needed
  here, because the tiers are separate projects.
- **Rotating the password is NOT possible from here.** `vercel integration` only adds/connects/removes;
  there is no `NEON_API_KEY` in the repo. It needs a Neon API key or the console (reachable from the
  Vercel dashboard), after which the integration re-syncs all 16 and production needs a **redeploy** —
  env changes never reach an existing deployment.
- **Never rotate it with `ALTER ROLE` over the existing connection.** The database would reject the old
  password immediately while Vercel still served it, and the integration has no way to learn the new
  one — strictly worse than not starting.

## `vercel env` CLI traps

- **`--force` is a silent no-op on an existing variable.** It prints "Added Environment Variable" and
  leaves the old value in place. Values are encrypted and unreadable, so you cannot spot the failure by
  listing. **To change a value: `vercel env rm NAME <env> --yes` then `vercel env add`.**
- **`vercel env add NAME preview` fails non-interactively** with `git_branch_required`, even though its
  own hint suggests the command you just ran. Pass an explicit **empty** third argument to mean
  all preview branches: `vercel env add NAME preview "" --value … --yes`.
- Use `--no-sensitive` for non-secret config so it stays readable later; leave real secrets sensitive.
- **A SENSITIVE variable reads back as an empty string** — `vercel env pull` writes `NAME=""` for it, so
  you cannot verify what you stored. `BUG_REPORT_READ_KEY` is one of them, so take it from `.env.local`
  when you need to `curl` a deployed report; a production pull hands you `""` and a 401 that looks like
  the key is wrong. Proven rather than assumed: `APPLE_BUNDLE_ID` was readable while
  non-sensitive and empty after being re-added as sensitive, same value. So a round-trip check has to be
  BEHAVIOURAL: deploy, then ask the app (`/api/auth/family/providers` returns `apple` only if the `.p8`
  actually parsed and signed in the real runtime). Do **not** downgrade a key to sensitive:false to peek.
- **`vercel build` is SAFE for `.env.local`** — it writes only under `.vercel/` (verified by hashing
  `.env.local` before and after). It is the cheapest way to inspect what actually deploys; see
  `.claude/rules/api-endpoints.md`. `vercel dev`, by contrast, runs the package.json `dev` script and
  dies if port 5173 is already taken.
- **`vercel deploy` aborts uploading this repo** ("Upload aborted", after several minutes of file
  hashing — there are thousands of prebaked mp3s). Pass **`--archive=tgz`** and it completes. Note a
  preview deployment is then behind Vercel's SSO wall, so `curl` gets a 302 and cannot verify anything.

## Provisioning marketplace resources

- **A browser EULA acceptance is required first.** The first `vercel integration add <name>` returns
  `integration_terms_acceptance_required` with a `verification_uri`; the owner must accept it. Not
  automatable — hand them the URL, then re-run the identical command.
- **THE REGION DEFAULTS TO `us-east-1` AND IT WILL NOT ASK.** Measured 2026-08-08: `vercel integration
  add neon --name bl-staging --no-env-pull` provisioned silently, no terms prompt, no region prompt, and
  landed in Virginia while production is in Frankfurt — breaking the privacy policy's EU data-residency
  claim and putting the database an ocean away from `vercel.json`'s `regions: ["fra1"]` functions. Neon's
  region is fixed at creation, so the only fix is delete and re-create.
- **Pass `-m region=fra1`.** `fra1` is Frankfurt. This rule used to say the keys come from
  `vercel integration add <name> --help` — **they do not on CLI 54.12.2**, which prints the generic help.
  They come from the ERROR: pass a wrong value and it lists every valid one
  (`cle1, iad1, pdx1, fra1, lhr1, syd1, sin1, gru1`). Guessing wrong is free; guessing silently is not.
- **Then VERIFY the region from the host**, don't trust the flag: pull to a scratch path and read
  `PGHOST` — `…eu-central-1.aws.neon.tech`. Deleting needs `--disconnect-all`
  (`vercel integration-resource remove <name> --disconnect-all`).

## Blob stores: region is fixed, and a second store cannot take the default var name

**Every new stateful resource is a data-residency claim, so give it its own row in
`docs/app-store/policy-verification.md`.** The bug-report store holds screenshots of a child's screen
and sat in `iad1` unnoticed for 27 days — not because anyone believed it was in the EU, but because the
claims table only had a row for "database", and nothing was there to be falsified.

- **`--region` defaults to `iad1` and cannot be changed afterwards** (Vercel docs, *Choosing your Blob
  store region*: "You cannot change the region once the store is created"; there is no `update-store`
  subcommand). Moving one means create + copy + repoint + delete.
- **`create-store` cannot connect if `BLOB_READ_WRITE_TOKEN` already exists** in any target
  environment — it creates the store, then fails the connect, leaving it orphaned. Connect it
  afterwards with **`vercel integration resource connect <store> <project>`** (blob stores show up as
  marketplace resources), which is also the only command exposing **`--prefix`**. Note the prefix
  *replaces* `BLOB`: `--prefix EU` yields `EU_READ_WRITE_TOKEN`, not `EU_BLOB_READ_WRITE_TOKEN`.
- **`delete-store` refuses a non-empty store (409) — but only AFTER it has already dropped the
  store's project connection.** So a failed delete still changes state; run `vercel blob empty-store
  --yes --rw-token <that store's token>` first (the token keeps working once disconnected), then
  delete. Copy and verify before emptying: this is the irreversible step.
- **Let the connection own the var, never hand-add it.** `delete-store` issues
  `DELETE /connections`, so a hand-made `BLOB_READ_WRITE_TOKEN` sharing that name is at risk when the
  old store is removed. The clean swap is: `env rm` the old var → `resource disconnect` → `resource
  connect` the new store unprefixed on all three environments.
- **The token names its store**: `vercel_blob_rw_<storeIdSuffix>_<secret>`, and the public host is
  `<storeidsuffix-lowercased>.public.blob.vercel-storage.com`. That makes the deployed check exact —
  `/api/bug-report?list=3` returns blob URLs, so the host in them says which store answered. **Env
  changes need a redeploy**, so that host stays on the OLD store until production is rebuilt.
- Copy blobs with `put()` from `@vercel/blob` and the pathname verbatim: `addRandomSuffix` defaults to
  false, and `api/bug-report.ts` derives both the listing and the id lookup from `list()` on
  `bug-reports/`, so a suffixed pathname would break every existing report code.

## The CLI's stored token is not an API token

`auth.json` (under `%APPDATA%\com.vercel.cli\Data\`) holds a CLI session token, and `api.vercel.com`
rejects it as a bearer with `403 invalidToken`. There is no shortcut around the CLI to the REST API
from this machine. What IS available: the CLI ships readable bundled source, so
`grep` in `dist/commands-bulk.js` settles what a command does to your files before you run it.

## Third-party credentials that cannot be automated

- **Google OAuth Web clients must be created in the Cloud Console — there is no API.**
  `gcloud iap oauth-clients` is deprecated, was shut down in March 2026, and only ever worked for an
  internal Workspace brand (a personal Gmail cannot have one). Don't burn time looking for a CLI path.
- **Verify the CLIENT ID/SECRET without a browser** by exchanging a deliberately malformed code:

  ```bash
  curl -s -X POST https://oauth2.googleapis.com/token \
    -d code=bogus -d "client_id=$CID" -d "client_secret=$CSEC" \
    -d "redirect_uri=$RU" -d grant_type=authorization_code
  ```

  `invalid_client` = wrong id/secret. `invalid_grant` = the id/secret authenticate.
  **It does NOT tell you whether `redirect_uri` is registered** — this rule used to claim it did, and
  that is false. Measured 2026-08-07: a fictional domain and a wrong path both returned `invalid_grant`,
  i.e. the same answer as the real registered URI. Google rejects the bogus code *before* it validates
  the redirect URI, so every URI looks registered. Two runs of this probe were about to be reported as a
  finding; the **known-negative control** below is the only reason they weren't.
  **Redirect URIs can only be confirmed by eye in the Cloud Console.**

## Verify a database connection for real

TLS reachability is not proof of credentials. Install the driver in a **throwaway sandbox outside the
repo** (so `package.json` stays clean), connect, and run both a `select` and a `create table` /
`drop table` — DDL permission is what schema migrations actually need.
