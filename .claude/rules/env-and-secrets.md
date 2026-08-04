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

Several keys exist **only** in `.env.local` and are absent from Vercel (they were added before the CLI
was in use). At the time of writing that includes the base64 Google service-account key, the Azure
region, and the bug-report read key — but **check, don't trust this list.**

- **`vercel env pull` overwrites the target file wholesale.** Run against `.env.local` it silently
  deletes anything Vercel doesn't know about. Always pull to a scratch path and copy the one key you
  want across: `vercel env pull /tmp/pulled.env --environment=development`.
- **`vercel integration add` runs `env pull` by default** → always pass **`--no-env-pull`**.
- Before touching `.env.local`, copy it somewhere outside the repo, then afterwards assert every
  pre-existing key survived. Note `grep -oE '^[A-Z_]+='` **misses names containing digits** (e.g. a
  `…_BASE64` suffix) — use `^[A-Z0-9_]+=`.

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
- **Verify OAuth credentials without a browser** by exchanging a deliberately malformed code:

  ```bash
  curl -s -X POST https://oauth2.googleapis.com/token \
    -d code=bogus -d "client_id=$CID" -d "client_secret=$CSEC" \
    -d "redirect_uri=$RU" -d grant_type=authorization_code
  ```

  `invalid_grant` ("Malformed auth code") = the client id/secret authenticate **and** that
  `redirect_uri` is registered. `invalid_client` = wrong id/secret. `redirect_uri_mismatch` = the URI
  isn't registered. Loop it over every redirect URI to confirm the whole set in one pass.

## Verify a database connection for real

TLS reachability is not proof of credentials. Install the driver in a **throwaway sandbox outside the
repo** (so `package.json` stays clean), connect, and run both a `select` and a `create table` /
`drop table` — DDL permission is what schema migrations actually need.
