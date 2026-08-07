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
- Before touching `.env.local`, copy it somewhere outside the repo, then afterwards assert every
  pre-existing key survived. Note `grep -oE '^[A-Z_]+='` **misses names containing digits** (e.g. a
  `…_BASE64` suffix) — use `^[A-Z0-9_]+=`.

## The database is a Vercel MARKETPLACE resource, not a standalone Neon project

`vercel integration ls` shows it (`neon-apricot-leaf`). Consequences:

- **The password lives in 16 integration-owned variables** — `DATABASE_URL`, `DATABASE_URL_UNPOOLED`
  and 14 `POSTGRES_*`/`PG*` aliases. Hand-editing `DATABASE_URL` leaves fifteen stale copies, and the
  integration may re-sync over it anyway. They move together or not at all.
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
- **`vercel integration add <name> --help` lists that integration's `-m` metadata keys** (region, plan,
  bundled add-ons) and its billing plan IDs. This is the only way to avoid a default region
  non-interactively — always set the region explicitly for EU data residency.

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
