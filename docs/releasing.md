# Releasing — what goes where, and what can bite you

For the owner, in plain terms. The design record is `.claude/rules/env-and-secrets.md` and
`.claude/rules/ios-shell.md`; this is the short version you actually need on the day.

## There are THREE things you can release, not one

| What | How you release it | Can it bite? |
|---|---|---|
| **The website** (`boernelaering.dk`) | `git push origin master` — deploys itself | **Yes.** This is the only accidental path. Pushing *is* releasing. |
| **The staging website** (`staging.boernelaering.dk`) | `npm run deploy:staging` | No. It has no Git connection, so it never deploys on its own. |
| **The staging iPad app** (`BL Staging`) | Codemagic → `ios-staging` | No. |
| **The production iPad app** (`Børnelæring`) | Codemagic → `ios-release`, started by hand | No. Nothing triggers it automatically, on purpose. |

**Both iPad builds go through Codemagic.** Same machine, same steps. They differ in exactly three
variables: which bundle ID they sign, which backend they talk to, and which TestFlight track they upload
to. Staging is meant to be a rehearsal — if it builds there, it builds for production.

## The website and the iPad app are not the same thing

Deploying the website changes **nothing** on the iPad. The whole app, including all the narration, ships
*inside* the binary — there is no `server.url`, so the installed app never fetches new code. Every change
to the App Store app costs a new build and an Apple review. That is not our choice: Guideline 2.5.2
forbids downloading code that changes what an app does.

So the "Ny version" banner is **switched off inside the App Store app**. It only works in Safari or from
a home-screen shortcut, where a reload genuinely gets new code. In the binary it would show a permanent
false "there's an update" that tapping could never fix.

This is the main reason `BL Staging` exists: you can iterate there as often as you like without spending a
review on it.

## The everyday loop

1. Work on `master`. Push. The website updates itself.
2. Need it on the iPad? Codemagic → `ios-staging` → install `BL Staging` from TestFlight.
3. Play it. Seed and wipe freely (`npm run staging:seed` / `npm run staging:wipe`) — nothing here can
   reach the real Reward Book.
4. Happy? Codemagic → `ios-release`, same commit. Install it over `Børnelæring` from the production
   TestFlight track and play it again.
5. Only then submit **that exact build** in App Store Connect. Never a build nobody has touched.

## Before you submit: check the DATABASE is in sync with the code

```
npm run schema:check
```

Both tiers must say **IN SYNC**. Exits non-zero on drift, so it can gate anything.

**This is not paranoia — it took sign-in down on production for a day.** On 2026-09-05 both Google and
Apple failed with "Kunne ikke starte …-login", on the website as well as the iPad, because the code had
shipped four columns on `oauthFlow` (`client`, `failureCode`, `failureMessage`, `failedAt`) that
`npm run auth:migrate` had only ever been run against the **staging** database. Deploying code does not
migrate a database, and nothing connected the two.

It was invisible from every angle: every other route answered 200, `/api/auth/family/providers` looked
healthy, and the failing INSERT returned an empty 500 body by design. Only the auto-uploaded auth report
(`M7W3W`) named the status code.

**If it says DRIFT**, run the migration against *that* tier's database:

```
npm run auth:migrate            # dry run — prints the exact SQL
npm run auth:migrate -- --apply # applies it
```

`npm run auth:migrate` uses `.env.local`, i.e. whichever database that names. To reach **production** you
need its own `DATABASE_URL`, and note Vercel will not hand back a **Sensitive**-flagged value at all
(`BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_SECRET`, `PIN_PEPPER`, `ACCESS_TOKEN_SECRET` all pull back empty) —
which is exactly the friction that let this happen. That is why `schema:check` asks each *deployment*
about itself instead: the credentials are already there.

## Before you submit to the App Store: run the QA pass

**`docs/qa.md`** — the whole pre-release pass, written to be re-run rather than read. It starts with a
selftest that proves the sweep is not decoration, then drives every route across eight viewports and
asserts narration actually produced sound, and ends with a device checklist only you can do. It names a
baseline for every command, so a finding is a *difference* from the baseline.

Run it before submitting, and before merging anything large. It has caught real defects — the first run
found four screens whose narration never played.

## Before you submit: check App Store Connect matches the repo

```
npm run shots:check      # compare; non-zero on any mismatch
npm run shots:upload     # replace a set and pin the display order
npm run desc:check       # the same question about the DESCRIPTION text
npm run desc:sync        # write listing.md's canonical block to ASC
```

**The description drifts the same way the screenshots do, and it did.** On 2026-09-05 the adult area was
renamed "Til de voksne" → "Indstillinger" throughout the app, `listing.md` was updated in the same
commit, and the live listing was not — so ASC spent a day showing a complete, valid, green description
of a screen the app no longer had. That is a Guideline 2.3.1 accuracy problem, and nothing could see it
because nothing looked. `listing.md` is the source of truth: `desc:check` extracts its canonical block
and diffs it line by line, so editing the doc is what changes the store.

**Re-shooting is not uploading, and nothing tells you the difference.** ASC will happily show a
filename, the right pixel size and `COMPLETE` next to the wrong image. It happened three times in one
day: once the whole set was a month stale, and twice the rail shot was re-taken locally after an
adult-surface change and never uploaded. Only `sourceFileChecksum` against a local md5 can see it.

`iphone-6-voksne.png` IS the rail, so **any** change to the adult surface invalidates it.

## Before you submit to the App Store: re-shoot the screenshots

**Do this last, and treat it as part of submitting rather than as work already done.** The App Store
screenshots live in `docs/app-store/shots/` and are the one thing that goes stale silently: nothing fails,
no test goes red, and the store page simply shows an app you no longer ship. Measured once — ten of them
were three days old and already wrong, because that week had quietened the section-label pills, moved the
profile badge, shrunk the reward count badge and deleted the floating gear. None of that breaks anything;
all of it is visible in a screenshot.

So the order on the day is: **finish any UI change → re-shoot → attach the build → submit.** Re-shooting
before the last UI change just means doing it twice.

Ten of the twelve are one mechanical pass with `webkit.mjs`, using the shot list and exact sizes in
`docs/app-store/listing.md` §2.2. Two things to get right, both of which have cost a run:

- **Remove the backend pill before capturing** (`[data-backend-badge]`). The dev build shows `TEST ·
  localhost:5173`; production shows nothing, so deleting it in the capture is honest rather than a cheat.
- **Playwright writes RGBA and App Store Connect wants RGB.** Check byte 25 of the PNG header is `2`
  after any capture, and convert with `ffmpeg -pix_fmt rgb24` if it is `6`.

**All twelve are automatable now, including the two "Indstillinger" ones.** That used to be false, and
the reason it was false is worth keeping: solving the arithmetic parental gate crashes the *WebKit*
target every time (four attempts, "Target crashed", at the moment the adult surface mounts), so the
conclusion drawn was "capture those two on the iPad". It was a driver limit, not an app limit —
**headless Chrome walks the same path with no trouble**, and the gate is arithmetic that the page states
in its own prompt, so the harness can read it and answer it. You do not need a screen of any particular
resolution: `--dpr` makes the image bigger than the layout, so a 1366×1024 iPad layout comes out at
2732×2048. The recipe is in `.claude/skills/ui-screenshot/SKILL.md` and the exact commands in
`docs/app-store/listing.md` §2.2.

## Which app am I looking at?

Three ways, in increasing effort:

1. The icon's name — `Børnelæring` or `BL Staging`.
2. The pill in the top-left corner. It prints the backend the build actually calls, so it is **absent
   only on production**. A mislabelled build is impossible.
3. "Indstillinger" → the version chip at the bottom of the menu, which names the backend on every tier.
   That is how the production app answers the question, since it has no pill.

## Open loose end

**Tag triggers are not enabled yet.** The intent is that `git tag tf-46 && git push origin tf-46` starts
a staging build without opening Codemagic. It needs tag webhook events turned on for the repository
(Codemagic → the app → Settings → Webhooks). Until then, start both workflows by hand.

## Two things worth knowing before you are surprised by them

- **A passkey does not work across the two apps.** It is bound to the domain, so enrolling Face ID in
  `BL Staging` does nothing for `Børnelæring`. Google sign-in works in both.
- **The installed app keeps its loaded code until you swipe it away** in the app switcher. So right
  after installing a build, reopening the icon can still run the old one. Check the version chip before
  concluding a fix didn't work.
