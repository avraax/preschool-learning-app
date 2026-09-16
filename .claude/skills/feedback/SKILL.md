---
name: feedback
description: Read what parents have written from inside Børnelæring — the messages an adult typed and sent via "Indstillinger" → "Send feedback". Use whenever the owner asks "har nogen skrevet?", "any feedback?", "what are people saying", "read the newest messages", "har jeg fået noget", or runs /feedback. Lists the human-written messages newest-first across both tiers, summarises what people actually said, and separates praise from ideas from faults. NOT for debugging a specific report code or a crash — that is `/debug-report`.
---

# Read the feedback

A parent taps **"Indstillinger" → "Send feedback"**, types a sentence, optionally leaves the screenshot
ticked, and sends. One door, no kind picker — **you classify by reading**, because the owner deliberately
refused to make a parent choose a category before they could type (2026-09-15).

**These are the only messages a human chose to write.** Everything else in the same store was uploaded
by the app itself.

## The origin is IN THE PATH — you can see it without opening anything

Since 2026-09-16 the folder carries it: `bug-reports/<date>/<origin>-<ID>/report.json`.

| folder | `type` | what it is | is it feedback? |
| --- | --- | --- | --- |
| `feedback-M4QP2` | `manual` | an adult typed a message and pressed Send | **yes — this is the whole job** |
| `crash-R7K3F` | `crash` | the error boundary or a window hook auto-uploaded | no |
| `auth-T8W1K` | `auth` | a sign-in failed and auto-uploaded | no |
| `ukendt-…` | something else | a payload whose `type` was not one of the three | treat as unknown |
| `M4QP2` (bare) | read the JSON | **stored BEFORE the scheme existed** | unknown until you open it |

The listing returns `origin` per report, so no fetch is needed to triage. **A bare-id folder gives
`origin: null`, which means the path does not say — not that the origin is unknown.** For those, open
the report and read `type`; never report a legacy entry as feedback because it isn't marked otherwise.

A listing that is mostly `crash` and `auth` is **normal** and is not "lots of feedback". Say how many
were feedback and never fold the others into the count.

## 1. Check BOTH tiers — the listings do not overlap

Staging is its own Vercel project with its own Blob store, so a TestFlight (`BL Staging`) message is
invisible from the production URL and vice versa. A quiet production list is not silence.

- Staging / TestFlight: `https://staging.boernelaering.dk`
- Production: `https://preschool-learning-app.vercel.app`
- Local dev: `http://127.0.0.1:3001`, or just read `.bug-reports/<date>/<id>/` off disk

Remote GETs are **fail-closed**: append `&key=$BUG_REPORT_READ_KEY` (the value is in `.env.local`,
currently the same on both tiers) or you get 403 (env unset) / 401 (wrong key). **A 403 is UNKNOWN, not
"no feedback"** — fix the key and ask again before reporting anything.

## 2. List, then read

```bash
# ALWAYS curl, never WebFetch — the JSON is large.
curl -s "$BASE/api/bug-report?list=25&expand=1&key=$BUG_REPORT_READ_KEY"
```

`expand=1` summarises the **10 newest only**, with `summary: {type, category, route, note, version}` —
`note` is the parent's own words, truncated to 120 chars. That is usually enough to triage. For the full
text and the picture:

```bash
curl -s "$BASE/api/bug-report?id=M4QP2&key=$BUG_REPORT_READ_KEY"
curl -s -o /tmp/fb-M4QP2.jpg "<screenshotUrl from the response>"   # then READ the jpg
```

## 3. Report it the way the owner wants to hear it

Answer first, a few sentences, no table. For each `manual` message:

1. **What they said** — quote the Danish, don't paraphrase it into a feature request. The words are the
   point; a parent writing "hun bliver ked af det når den siger forkert" is telling you something a
   summary destroys.
2. **Which build and route** — `app.commitHash` (never `version`, which is rarely bumped) and
   `app.route`. A complaint about a screen the owner has since rebuilt is not a live complaint.
3. **Praise / idea / fault** — your call, from reading. Group them; the owner wants the faults first and
   the praise kept, not averaged away.

Then, and only for the faults, open the implicated code. For a fault worth real debugging, hand over to
**`/debug-report`** with the code — it knows the read-order for `diagnostics`, `audio` and `device`.

## What this channel cannot tell you

- **There is no reply address.** The message carries no name and no e-mail by design, so a question back
  is impossible unless the parent separately mails the owner quoting their code. Never propose "let's
  ask them" as a next step.
- **Absence is not health.** Nothing prompts a parent to write — there is no rating prompt and no nudge
  (Kids Guideline 1.3 keeps everything adult-directed behind the gate). An empty list means nobody
  opened the settings and typed, not that nothing is wrong.
- **A message can only be sent from the section menus, never mid-game** — the in-game header holds the
  reward ring alone. So a complaint about a game arrives with the *menu* screenshotted, or with the
  board only if the adult opened settings straight from it. Don't read a menu screenshot as "the bug is
  on the menu".
