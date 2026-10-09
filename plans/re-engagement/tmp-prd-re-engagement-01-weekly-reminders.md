# PRD — Weekly reminders: bring back the families who played once

Status: authored 2026-10-09, **NOT implemented**. Owner decision session; every question in §2 was
answered by the owner before this was written. Supersedes nothing. It is the first native-only *feature*
in the shell (everything native so far has been plumbing: sign-in return, the browser sheet).

Survives unchanged: the "no third-party analytics" promise (`docs/usage-analytics.md` §1.1), the closed
usage-event set and its anonymity-by-construction (`src/config/usageEvents.ts`), the parental gate and
the adult IA as data (`.claude/rules/adult-surface.md`), "never show a distance" on child surfaces
(`RewardRing.tsx`).

---

## 1. Why

**The problem, in the owner's words:** people download the app, play once, and forget it is installed.
It is an iPad app (Capacitor shell); the website is almost never used.

**What we can and cannot do on this platform** (researched 2026-10-09; sources at the end):

- **Web push is impossible.** iOS web push needs a home-screen web app *and a service worker*, and the
  web build deliberately has none. The shell can do **local notifications**: scheduled on the iPad, no
  server, no APNs, no entitlement, and nothing leaves the device. That keeps Guideline 1.3 / 5.1.4 (Kids
  Category: no third-party analytics, no device info to third parties) and our own "ingen sporing" promise
  intact.
- **Live Activities and widgets are out.** There are no Live Activities on iPadOS 17 (the floor device is
  17.7), and a widget needs a native extension target. Neither is in the category's practice anyway: none
  of the surveyed kids' apps use widgets, badges or Live Activities for re-engagement.
- **Guideline 4.5.4.** Notifications must never be required for the app to work. Promotional ones need
  explicit opt-in consent *in our UI* and an in-app way to opt out. We treat a "come back" reminder as
  promotional, so we need both: the pre-prompt (§2.1) and the toggle (§2.8).
- **The iOS permission dialog shows once, ever.** A "Tillad ikke" tapped by a five-year-old is permanent
  short of iPad Settings. Hence our own adult-addressed pre-prompt, where "Ikke nu" does *not* burn the
  system dialog. That is Apple's own guidance ("request authorization in context").
- **Provisional authorization was rejected.** It is quiet delivery to Notification Center only, with no
  banner or sound, which is too invisible to bring anyone back. The Capacitor plugin doesn't expose it
  either.

**What the comparable apps do, and what parents dislike:**

- **Accepted:**
  - a parent-addressed summary or reminder at most weekly (Khan Academy's opt-in weekly reminder; Epic's
    weekly parent email);
  - parent-scheduled routine notifications (Moshi bedtime);
  - new or seasonal content found on opening (Toca, Sago).
- **Criticised:**
  - anything addressed to the child;
  - characters guilting the child ("your monster misses you");
  - streaks (Khan Academy retired one);
  - daily log-in gifts;
  - icon badges;
  - more than about one notification a week;
  - notifications on by default.
- **Evidence:** Radesky et al. (JAMA Netw Open 2022) found manipulative "come back" design in about 80% of
  apps used by 3–5-year-olds. The EU DSA Art. 28 guidelines (July 2025) say notifications should be off by
  default for minors. They likely exempt a micro-enterprise, but they are the clearest statement of good
  practice, and an opt-in design meets them.
- **Frequency:** Localytics' survey found that at about 1 notification a week 10% of users would disable
  them, and at 2–5 a week 37% would and 22% would stop using the app. Airship reports higher retention at
  about 1 a week than at none (correlational, from a vendor).

**What this PRD therefore builds:**

- One opt-in, asked once, of the adult, on first launch.
- A reminder that fires only when the family has not opened the app for 7 days.
- At most 3 reminders, then silence until the app is opened again.
- Calm Danish copy addressed to the parent.
- A switch in Indstillinger.
- Anonymous counters to see whether it works.

---

## 2. Decisions (owner, 2026-10-09). Do not re-litigate

1. **Asked on first launch, a moment after home first appears**, about 4 s, with no gesture required.
   The owner's original idea was to fire the iOS dialog straight away. That was changed to "our
   pre-prompt first, then the iOS dialog" because the dialog is one-shot (§1).
2. **The pre-prompt has no parental gate.** It is addressed to the adult in its copy. A child tapping
   "Ja" costs at most one weekly reminder to the parent; a gate would sink the opt-in rate.
3. **Copy in v1: a general reminder, replaced by a near-sticker line when that is true.** No seasonal
   line and no "Ugens bogstav" in v1. Both need real content behind them first (§8). The owner asked to
   start simple; this is the recommendation he took.
4. **Timing: 7 days after the last open, re-anchored on every open.** An active family never receives
   one. The owner's first idea was "every week from the day they allowed it"; it was changed so that
   active players aren't nagged.
5. **Back-off: stop after 3 ignored reminders** (days 7, 14 and 21 after the last open). After that,
   silence until the app is opened again, which restarts the cycle.
6. **"Ikke nu" is final.** The pre-prompt never shows again. The only way in after that is the
   Indstillinger toggle.
7. **Send time: 16:30 on weekdays, 10:00 on Saturdays and Sundays**, local time, for whichever weekday
   day N falls on.
8. **The toggle lives in a new Indstillinger group, "Påmindelser"**, with one switch and a line saying
   when reminders come.
9. **iOS denied + toggle turned on:** explain that notifications are off in iOS, and show a button that
   opens Børnelæring's page in iPad Settings.
10. **Tapping a reminder opens the app normally** (cold start → picker at 2+ children → home). No deep
    link into Min Bog.
11. **Use the child's name only for a named profile.** Guests are literally `"Gæst"`
    (`profileStore.ts` `GUEST_PROFILE`), so they get the neutral variant. The name never leaves the iPad.
12. **Measure it with the existing anonymous usage counter**: new closed-set event names, aggregate daily
    counts only, no per-install id (§3, W4).
13. **No icon badge, ever.** Default notification sound.

### 2.1 The copy (decided; implement verbatim)

Every line is addressed to the family ("I"), names no mascot, makes no claim the app can't back
("nye opgaver" would be false: the games are endless, not new), and never states a distance or a count.
Child-surface rule: the ring only signals nearness. We hold the parent-facing copy to the same standard,
so "tæt på", never "2 opgaver til".

**The pre-prompt** is a modal card over home. It is silent: no narration, so no new spoken lines and no
prebake.

- Overline: `Til den voksne`
- Title: `Må vi minde jer om Børnelæring?`
- Body: `Hvis appen ikke har været åbnet i en uge, sender vi en venlig påmindelse — højst én om ugen, og
  aldrig mere end tre i træk. Påmindelserne laves på iPad'en; der sendes ingen data. I kan slå dem fra
  under Indstillinger.`
- Primary button: `Ja tak`. Secondary button: `Ikke nu`.

**The notifications.** The title is always `Børnelæring`.

- **#1 (day 7)** uses the near variant if `near` is true at schedule time, else general A.
- **#2 (day 14)** uses general B. **#3 (day 21)** uses general C. Days 14 and 21 never repeat the near
  line: progress can't have changed since nobody played.
- **Near**, named: `{navn} er tæt på sit næste klistermærke. Har I ti minutter i dag?`
- **Near**, guest: `Der er et klistermærke tæt på i Børnelæring. Har I ti minutter i dag?`
- **General A**: `Bogstaver, tal og farver venter. Har I ti minutter i dag?`
- **General B**: `Klar til en lille runde? Børnelæring er der, når I er.`
- **General C**: `Et par minutter med bogstaver eller tal kan gøre en god dag lidt bedre.`

**`near`** means `xpProgressToNextLevel().fill >= 0.5` (the same source as the ring's fill,
`RewardRing.tsx:100`) **and** the book is not full (`grantedSlots() < REWARD_SLOTS`). The 0.5 threshold
is an implementer-level assumption; the owner wouldn't care about the exact cut.

---

## 3. What changes in code

| File | Change | |
|---|---|---|
| `package.json` | add `@capacitor/local-notifications@^8` and `@capacitor/app-launcher@^8` (opens iPad Settings) | edit |
| `ios/App/CapApp-SPM/Package.swift` | regenerated by **`npm run cap:sync`**, never bare `npx cap sync` (Windows backslash trap) | edit |
| `src/config/capacitorConfig.test.ts` | extend the "shell registers the plugin" test: both new packages are dependencies AND quoted-whole in Package.swift | edit |
| `src/config/reminderSchedule.ts` | **PURE** (no imports beyond progression constants): `reminderTimes(lastOpen: Date) → Date[3]` (day 7/14/21 at 16:30 weekday / 10:00 weekend, local), `reminderCopy(index, { name, isGuest, near }) → {title, body}`, `isNear(fill, granted, slots)`, the copy strings from §2.1 | new |
| `src/config/reminderSchedule.test.ts` | DST weeks (late Mar / late Oct), Fri→Fri, Sat→10:00, guest never gets `Gæst`, #2/#3 never near, book full → never near, no digits in any body | new |
| `src/services/reminders.ts` | the shell-only service: dynamic-imports the plugin (box the proxy), `permissionState()`, `requestFromPrompt()`, `reschedule()` (cancel our 3 ids → schedule 3), `cancelAll()`, `registerTapListener()`; persists `bl.reminders.v1` = `{ prompt: 'unasked'\|'yes'\|'not_now', enabled: boolean }` in localStorage (try/catch) | new |
| `src/services/reminders.test.ts` | with a fake plugin: unasked+prompt → offer; `not_now` → never offer; `denied` → never offer; disabled → `reschedule` cancels and schedules nothing; ids are stable (3 fixed ints) | new |
| `src/components/reminders/ReminderPrompt.tsx` | the pre-prompt card (§2.1), shown by a controller mounted in `App.tsx` once home has been on screen ~4 s on a session where `shouldOffer()` is true | new |
| `src/App.tsx` | mount `ReminderPrompt` controller; at boot (shell only) call `registerTapListener()` and `reschedule()` | edit |
| `src/services/xpBus.ts` call site *or* `progressStore` subscriber | debounced (≈2 s) `reschedule()` on every XP grant so "last open" and `near` track the session **without relying on a background event** (§4.3) | edit |
| `src/config/adultSettingsIa.ts` | new group `{ id: 'paamindelser', label: 'Påmindelser', items: [{ id: 'paamindelser.weekly', label: 'Ugentlig påmindelse' }] }`; add a `shellOnly` flag (hidden on web) — rule kept pure and truth-tabled like `showsDevTools` | edit |
| `src/config/adultSettingsIa.test.ts` | the group exists, single-word label not in `AMBIGUOUS_LABELS`, hidden when not shell | edit |
| `src/components/adult/panes/PaamindelserPane.tsx` | the switch + "Kommer kl. 16:30 på hverdage og 10:00 i weekenden, kun hvis appen ikke har været åbnet i en uge. Højst tre i træk." + the denied state with `Åbn iPad-indstillinger`; a **devTool** row `Send en testpåmindelse om 1 minut` | new |
| `src/components/adult/AdultSettings.tsx` | route the new group id to its pane | edit |
| `src/config/usageEvents.ts` | `NOTIFY_EVENTS` closed set: `notify:offered`, `notify:yes`, `notify:not_now`, `notify:granted`, `notify:denied`, `notify:tap_open`, `notify:toggle_on`, `notify:toggle_off` | edit |
| `src/services/usagePing.ts` | `reportNotifyStep(step)` beside `reportAdultStep` | edit |
| `api/usage.ts` + `lib/usageEndpoint.test.ts` | accepts the new names (it validates against the shared set; check it actually reads the new export) | edit |
| `src/config/legalContent.ts` (+ English mirror) | new paragraph: local reminders, opt-in, made on the device, nothing sent; the "Appen tæller selv…" line gains "om påmindelser blev slået til" | edit |
| `docs/app-store/listing.md` | if the description lists features/privacy points, add one line; read the field back after writing (ios-shell.md) | edit |
| `ios/App/App/PrivacyInfo.xcprivacy` | **no change expected**: nothing collected. Confirm, don't add a data type | check |

---

## 4. The traps. Read before writing any of it

1. **A Capacitor plugin proxy is a thenable.** Never return `LocalNotifications` or `AppLauncher` from an
   `async` function, or the promise never settles and nothing errors (report BV9DJ). Box it, as
   `shellBrowser.ts` does. Also **dynamic-import** both, because `reminders.ts` is reached by plain-Node
   tests and by the web build (`shellReturn.ts` explains why).
2. **The whole feature is gated on `isNativeShell()`.** The web build must neither show the pre-prompt
   nor the Indstillinger group, nor import the plugin.
3. **Do not rely on a background/pause event to reschedule.** Whether JS gets to finish an async plugin
   call while a backgrounded WKWebView suspends is unverified here, and an `await` that never settles is
   this repo's signature bug. Reschedule **at boot** and **debounced on every XP grant**. The pause event
   may be added as a third, best-effort trigger only.
4. **"Last open" means the latest reschedule.** Every reschedule cancels all three ids and re-schedules
   from *now*, which is what makes the 7-day re-anchor and the stop-after-3 work with zero background
   execution. Use **three fixed integer ids** (e.g. 7101/7102/7103). Random ids leak stale reminders that
   `cancel` can't find.
5. **The tap listener must be registered at boot, before anything awaits the profile roster.** A tap on
   a cold-started app delivers `localNotificationActionPerformed` once. Whether the plugin retains it for
   a late listener is **UNKNOWN**. Register it early and verify on the iPad (§7). The listener does
   exactly one thing, `reportNotifyStep('tap_open')`. No navigation (decision 10).
6. **The pre-prompt must not steal a game.** Show it only while the route is `/` and home has been
   visible about 4 s. If the child navigates into a game first, do not show it mid-game. Defer to the
   next time home is on screen this session, else to the next launch (the state is still `unasked`).
   Never stack it over `ProfilePicker`, `CreateProfileDialog`, the sticker ceremony or an auth overlay.
   Check `authUiOpen` / the gate surface, not z-index (`authOverlayZ` trap).
7. **Only a `click` handler may close a blocking overlay.** A `pointerdown`/`touchend` close lets the tap
   fall through to the board behind it (the "Start lyd nu" incident). Both buttons close on `click`.
8. **Read `checkPermissions()` before offering.** Offer only on `'prompt'` (iOS never asked) **and** our
   state `unasked`. If iOS already says `granted` (a reinstall can keep it), skip the card, set
   `prompt: 'yes', enabled: true` and schedule. If `denied`, never show the card.
9. **The "Ja tak" tap must be what calls `requestPermissions()`**, synchronously in its handler chain,
   not after an unrelated await. iOS shows the dialog either way, but a delayed call reads as a broken
   button. Count `notify:yes` before the call, then `granted`/`denied` from its result.
10. **The guest name is `"Gæst"`, not empty.** `reminderCopy` takes `isGuest` explicitly
    (`profile.id === GUEST_PROFILE_ID`) rather than testing for a falsy name. Several children means the
    attached profile at reschedule time, i.e. whoever played last (decision 11).
11. **No digits in any body.** This is the "never a distance" rule carried to the parent copy. The test
    asserts `!/\d/.test(body)` over every variant. Ti is spelled out for that reason.
12. **Do not request badge-only semantics and never set `badge`.** The plugin's `requestPermissions`
    asks for alert+sound+badge as one dialog. That is fine, but never pass a badge count in `schedule`.
13. **DST.** Build each `at` from local calendar fields (`new Date(y, m, d + 7, 16, 30)`), never
    `now + 7*86400000`, or the late-October and late-March weeks land an hour off.
14. **Package.swift: run `npm run cap:sync`, never bare `npx cap sync`.** The latter writes Windows
    backslash paths that SPM on the CI Mac can't resolve (`capacitorConfig.test.ts` catches it). Commit
    the regenerated file.
15. **Opening iPad Settings.** `AppLauncher.openUrl({ url: 'app-settings:' })` (UIApplication's
    `openSettingsURLString`) opens the app's own Settings page. Whether `canOpenUrl` needs an
    `LSApplicationQueriesSchemes` entry for it is **UNKNOWN**. Call `openUrl` directly, and if it reports
    failure, fall back to the text "Indstillinger → Børnelæring → Notifikationer".
16. **Usage counter: the allow-list is the cap.** Add names to the shared closed set, not ad-hoc strings,
    and check `api/usage.ts` actually validates against the new export (it drops unknown names
    *silently*, so a missing wire-up looks like "nobody opted in").
17. **localStorage is per-device, not per-child**, which is correct: the opt-in is the adult's, for the
    iPad.
18. **Another session may share this tree; master deploys.** Commit each stage; don't push.

---

## 5. What must NOT change

- No notification is ever addressed to the child or voiced by the mascot. No guilt, no "savner dig", no
  streak, no daily cadence, no badge, no log-in gift.
- Nothing about a child leaves the device. No push server, no APNs entitlement, no per-install id in the
  usage counter (`docs/usage-analytics.md` §1.1). The App Privacy answers and `PrivacyInfo.xcprivacy` stay
  as they are.
- The app works identically with reminders off or denied (4.5.4).
- One audio at a time; the pre-prompt is silent (no new spoken lines, so the prebake protocol isn't
  triggered).
- No emoji. The card uses baked art or none; a `lucide-react` icon is allowed only because the card is
  adult-addressed.
- `rewardNumber()`/ring semantics untouched. `near` reads the store; it never grants or changes XP.
- The web build is unchanged.

---

## 6. Work stages

- **W0. Plugins + pure schedule.** Add both packages and `npm run cap:sync`, extend
  `capacitorConfig.test.ts`, then `reminderSchedule.ts` + tests. Ships nothing visible. Green on its own.
- **W1. The service.** `reminders.ts` + tests with a fake plugin. Boot wiring in `App.tsx`: tap listener
  + reschedule, plus the debounced XP-grant reschedule. Still invisible, since the state is `unasked`
  and nothing is scheduled until `enabled`.
- **W2. The pre-prompt.** `ReminderPrompt` + controller + traps 6–9.
- **W3. Indstillinger "Påmindelser".** Group, `shellOnly` rule, pane, denied state + `app-settings:`,
  and the devTool "testpåmindelse om 1 minut" (schedules id 7199 with general A, `at` now + 60 s).
- **W4. Counters + policy.** `NOTIFY_EVENTS`, `reportNotifyStep` at each step, endpoint test,
  `legalContent.ts` (both languages), listing line.

One commit per stage. Don't push; the owner ships a TestFlight build via Codemagic (`docs/releasing.md`).

---

## 7. Verification

**Rung 1–2 (no iPad):**

- `npm test`, `npm run lint`, `npm run build` green.
- `ui-screenshot` of `ReminderPrompt` on all 4 skins + phone width, forced visible via a DEV-only query
  flag (e.g. `?reminderprompt=1`; the shell has no query string, so this is web-dev only).
- The pane at rungs 1 and 2, in all three states: off, on, and denied (fake plugin).
- Web build: grep `dist/` to confirm `ReminderPrompt` is never mounted outside the shell, and that no
  static import of `@capacitor/local-notifications` exists in the web graph.

**Guards. Re-break each with `/re-break`:**

- `reminderSchedule.test.ts`:
  - DST week lands at 16:30 local. Break it: switch to ms arithmetic.
  - Weekend → 10:00. Break it: drop the weekend branch.
  - Guest never contains `Gæst`. Break it: use the name unconditionally.
  - No digits in any body. Break it: put "2" in one string.
  - #2/#3 never near. Break it: pass `near` through.
- `reminders.test.ts`:
  - `not_now` never re-offers. Break it: return true from `shouldOffer` for `not_now`.
  - Disabled schedules nothing.
  - Reschedule cancels the fixed ids first. Break it: use random ids.
- `capacitorConfig.test.ts`: both plugins are quoted-whole in Package.swift. Break it: rename one.
- `adultSettingsIa.test.ts`: `Påmindelser` is hidden on web. Break it: drop `shellOnly`.
- `lib/usageEndpoint.test.ts`: `notify:tap_open` is accepted. Break it: remove it from the set.

**Rung 3 (owner's iPad, staging build `BL Staging`). Everything here is UNKNOWN until tried:**

1. Fresh install → home → card after about 4 s → "Ja tak" → the iOS dialog appears → Allow.
2. Indstillinger → Påmindelser → devTool test reminder → lock the iPad → banner after 1 min, with sound
   and no badge.
3. Tap the banner while the app is killed. The app cold-starts normally, and `notify:tap_open` appears in
   the counter next day (`docs/database-access.md`). This is the retained-event question in trap 5.
4. Reinstall → "Ikke nu" → never shown again. Toggle on in Indstillinger → the iOS dialog (still unasked)
   appears.
5. Deny in iOS → toggle on → explanation + `Åbn iPad-indstillinger` opens the right page.
6. The Danish reads naturally on the lock screen (length, line breaks, æøå).

---

## 8. Out of scope

- **Seasonal / "nyt i appen" / "Ugens bogstav" lines.** v2, and only once there is real seasonal content
  in the scene or a new chapter to point at. Promising "nyt" without it is the false claim §2.1 avoids.
- Push notifications, a server, APNs, rich notifications or actions, a weekly parent email, widgets,
  Live Activities, and any per-install or per-child analytics.
- Letting the parent choose the day or time. The owner rejected manual setup; the toggle is on/off only.
- The web/PWA build.

---

## 9. Kickoff prompt for a fresh session

> Implement `plans/re-engagement/tmp-prd-re-engagement-01-weekly-reminders.md`. Read
> `.claude/rules/ios-shell.md` (thenable proxy, cap:sync), `adult-surface.md` and `docs/usage-analytics.md`
> §1 first, then §4 of the PRD before writing anything. Start with W0 (plugins + the pure schedule),
> because everything else schedules through it. Re-break every guard in §7 with `/re-break`, name the rung
> for every claim, and leave rung 3 as UNKNOWN for the owner's iPad. Commit per stage, don't push.

---

Sources (2026-10-09):

- Apple App Review Guidelines 1.3 / 4.5.4 / 5.1.4 (developer.apple.com/app-store/review/guidelines/)
- "Asking permission to use notifications" (developer.apple.com/documentation/usernotifications)
- WebKit, "Web Push for Web Apps on iOS and iPadOS" (webkit.org/blog/13878)
- Radesky et al., JAMA Netw Open 2022 (pmc.ncbi.nlm.nih.gov/articles/PMC9206186)
- EU Commission, DSA Art. 28 guidelines on the protection of minors, July 2025
  (digital-strategy.ec.europa.eu)
- Localytics push-frequency survey (via businessofapps.com)
- Airship retention benchmarks
- Khan Academy support / Northwestern IPR WP-26-05 on streaks
- Moshi via internetmatters.org
- Epic via educationalappstore.com
