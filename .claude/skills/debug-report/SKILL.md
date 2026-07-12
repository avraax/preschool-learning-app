---
name: debug-report
description: Fetch and debug production/local bug reports from the Børnelæring bug-report API. Use whenever the user gives a report code (e.g. "R7K3F"), says they just sent a report from the app/iPad, asks to check "the newest report", "recent bug reports" or "crash reports", or wants to debug a problem reported via the "Til de voksne" menu. Handles a single code, multiple codes, or no code at all (lists newest reports). Fetches the report JSON + screenshot, summarizes findings, then starts debugging.
---

# Debug a bug report

Reports are created in-app ("Til de voksne" corner menu → "Rapportér et problem") or auto-uploaded
on crashes. Each has a short id like `R7K3F`. Storage: production = Vercel Blob via
`api/bug-report.ts`; local dev = `.bug-reports/<date>/<id>/` on disk via `dev-server.js`.

## 1. Pick the base URL

- Production (default): `https://preschool-learning-app.vercel.app`
- Local (user says "locally", or the report was made against a dev build): `http://127.0.0.1:3001`
  — or just Read the files under `.bug-reports/` directly.
- If `BUG_REPORT_READ_KEY` is set in the Vercel env, append `&key=<value>` to every GET.
- ALWAYS use curl, not WebFetch.

## 2. Resolve which report(s) to debug

- **User gave code(s)**: fetch each one directly (step 3).
- **No code** ("the newest report", "I just sent one", "any crash reports?"):
  `curl -s "$BASE/api/bug-report?list=10&expand=1"` — summaries are newest-first with
  `summary: {type, category, route, note, error, version}`. Default to the newest `type:"manual"`
  report when they said they just sent one; show the list briefly if it's ambiguous which they mean.
- **Multiple reports**: fetch each, then triage into ONE combined summary first (group likely
  duplicates by route + error signature), and fix in order of severity.

## 3. Fetch a report

```bash
curl -s "$BASE/api/bug-report?id=R7K3F"          # → { id, uploadedAt, screenshotUrl, report }
curl -s -o /tmp/bug-R7K3F.jpg "<screenshotUrl>"  # then READ the jpg — actually look at it
```

## 4. Read the report in this order

1. `report.note` — the human's words. (`report.category` is just `crash` for auto-reports, `andet` otherwise.)
2. `report.app` — `route` (which game), `version`/`commitHash` (match code with
   `git show <commitHash>:<file>` if the deploy has moved on), `online`, `viewport`.
3. `report.error` — crashes only: message/stack/componentStack.
4. `report.diagnostics.breadcrumbs` — the route + tap trail: what the child actually did.
5. `report.diagnostics.console` — errors/warnings around the incident (TTS fallbacks appear
   here as "Azure synthesis failed → Web Speech" etc.).
6. `report.diagnostics.network` — failed calls: status 0 = network error; `responseSnippet`
   holds the API's error body.
7. `report.audio` — for sound issues: `ttsHealth.circuitOpen`/`failureCount`, `permission`
   (audioContextState "suspended" = iOS gesture problem), `voiceOverride` (non-null = the
   narrator voice was overridden!), `sfxEnabled`.
8. `report.device` + `report.progress` as supporting context.

## 5. Then debug

Summarize in 3-5 sentences: what happened, where (route/game), on what (device/version), and the
prime suspect subsystem — then open the implicated code and investigate. Delete `/tmp/bug-*.jpg`
when done.
