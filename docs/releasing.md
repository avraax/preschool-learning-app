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

## Before you submit to the App Store: run the QA pass

**`docs/qa.md`** — the whole pre-release pass, written to be re-run rather than read. It starts with a
selftest that proves the sweep is not decoration, then drives every route across eight viewports and
asserts narration actually produced sound, and ends with a device checklist only you can do. It names a
baseline for every command, so a finding is a *difference* from the baseline.

Run it before submitting, and before merging anything large. It has caught real defects — the first run
found four screens whose narration never played.

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

**The two "Til de voksne" shots cannot currently be automated — take them on the iPad.** The harness
reaches the arithmetic parental gate reliably but crashes WebKit the moment the gate is *solved* and the
adult surface mounts (four attempts, "Target crashed"). Your iPad Pro 12.9" captures natively at
2732×2048, which is exactly what the required 13" slot accepts, and TestFlight already has the build — so
that is the shorter path, not a workaround. The iPhone one has no such escape: an iPhone 13 is 6.1"
(1170×2532) and the slot wants 6.9" (2868×1320), so it needs the harness fixed or left alone.

## Which app am I looking at?

Three ways, in increasing effort:

1. The icon's name — `Børnelæring` or `BL Staging`.
2. The pill in the top-left corner. It prints the backend the build actually calls, so it is **absent
   only on production**. A mislabelled build is impossible.
3. "Til de voksne" → the version chip at the bottom of the menu, which names the backend on every tier.
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
