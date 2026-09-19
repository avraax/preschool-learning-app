# Connecting to the Neon databases

Two tiers, **two separate Neon projects**, no shared data. Staging is where dev and TestFlight write;
production is the child's real account. Getting these two confused is the failure this page exists to
prevent — the hosts differ by a few characters and every other field is identical.

| | staging | production |
|---|---|---|
| Neon project | `plain-surf-26612652` | `rough-silence-90309729` |
| Host | `ep-snowy-band-b241x9u5-pooler.c-6.eu-central-1.aws.neon.tech` | `ep-hidden-feather-ashpywa8-pooler.c-4.eu-central-1.aws.neon.tech` |
| Database | `neondb` | `neondb` |
| User | `neondb_owner` | `neondb_owner` |
| Port | `5432` | `5432` |
| SSL | required | required |
| Password | `PGPASSWORD` in `.env.local` | see "Getting the production password" |

Both are `eu-central-1` (Frankfurt), which is what the privacy policy claims — don't move either.

## Just want to look? Use the Neon Console

No install, no connection string, no password — you are already signed in, and it is the fastest way to
answer "did that write land".

- **Staging:** https://console.neon.tech/app/projects/plain-surf-26612652
- **Production:** https://console.neon.tech/app/projects/rough-silence-90309729

**Tables** in the left sidebar browses rows; **SQL Editor** runs queries, e.g.
`select * from usage_counter order by day desc, n desc;`. It is also the only place that shows branch
and compute state, and the usage against the free tier.

The rest of this page is for when you want a real client — filtering, exports, several queries at once,
or a script.

## Getting the production password

**`vercel env pull` with no filename OVERWRITES `.env.local`**, which is the staging one you use every
day. Always pass an explicit filename:

```bash
npx vercel env pull --environment=production .env.prod.tmp --yes
grep '^PGPASSWORD=' .env.prod.tmp        # copy it out
rm .env.prod.tmp                          # then delete it
```

`.env*` is gitignored, so the temp file is never committed — but delete it anyway; it is a live
production credential sitting in the repo folder. The Neon Console shows the same string under the
project's Connection Details if you would rather not pull it at all.

## The tool: DBeaver (already installed)

`C:\Program Files\DBeaver\dbeaver.exe`. Free, and it bundles its own JDBC driver — **there is no `psql`
on this machine** (the `C:\Program Files\PostgreSQL\17` folder is a leftover data directory with no
client binaries), so anything expecting a native client will not work without installing one.

Per connection: **Database → New Connection → PostgreSQL**, fill in host / database / user / password
from the table, then **SSL tab → Use SSL**, `sslmode = require`. Neon refuses plaintext, and the
default JDBC settings do not enable TLS — this is the step that makes a first attempt fail.

**Do these two things on the production connection, before you ever open it:**

1. **Edit Connection → General → Connection type = `Production`.** DBeaver then tints every editor tab
   for that connection red, and prompts before executing.
2. **Tick "Read-only connection"** on the same page. It blocks `UPDATE`/`DELETE`/`INSERT` at the client,
   which is the only thing standing between a stray `DELETE FROM` and a child's progress. Untick it
   deliberately on the rare occasion you mean to write.

Set staging's connection type to `Development` (green) so the two are never visually confusable.

## Alternatives

- **Neon Console** (`console.neon.tech`) — zero install, both projects in one place, has a SQL editor.
  Best for a one-off look; it is also the only option that shows branch/compute state and usage.
- **A Node one-liner**, using the `pg` already in `node_modules` — best when the answer should be
  repeatable or pasted into a session:

  ```bash
  node -e "
  const {Client}=require('pg');
  const url=require('fs').readFileSync('.env.local','utf8').match(/^DATABASE_URL=\"?([^\"\n]+)/m)[1];
  const c=new Client({connectionString:url});
  (async()=>{await c.connect();
    console.table((await c.query('select day,event,app_version,n from usage_counter order by day desc, n desc limit 20')).rows);
    await c.end();})()"
  ```

  Swap the file for a pulled production env to point it at prod. The `pg` driver treats Neon's
  `sslmode=require` as `verify-full` (see `lib/db.ts`), so TLS needs no extra flags.

## Rules that are not optional

- **Never point tests at either database.** Both are shared, live state; a test run against production
  would touch the real account. There is no test tier.
- **Production holds real personal data** — one adult account, the child profiles and their progress.
  Read it, do not browse it idly, and do not copy rows out into a scratch file.
- **`usage_counter` is the exception**: anonymous by construction, no identifier in any column, so it is
  safe to query and to delete from freely on staging. See `docs/usage-analytics.md`.
- **A schema change applied to one tier is not applied to the other.** `npm run auth:migrate -- --apply`
  runs against whatever `DATABASE_URL` is loaded, and forgetting production is what killed sign-in for a
  day on 2026-09-05. `curl <host>/api/schema-health` reports `inSync` per tier — check it after any
  migration, on both.
