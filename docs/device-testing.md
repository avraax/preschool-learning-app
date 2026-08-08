# Verifying on devices — what exists, what it costs, what it can't do

## THE TARGET DEVICE — verify against this one, always

The child plays on an **iPad Pro 2nd generation (A10X Fusion, 2017) on iPadOS 17.7.11**, its terminal
OS. That is the compatibility floor in CLAUDE.md and the device every check should lead with.

**Size confirmed by the owner: the 12.9".** Its window numbers are measured from a real 12.9" iPad Pro
PWA — the household's **M1** one, because the child's iPad has never sent a bug report. Both 12.9"
generations share identical CSS geometry, so they transfer:

| property | value |
|---|---|
| screen (CSS px) | 1024 × 1366 @ `devicePixelRatio` 2 → 2048 × 2732 native |
| **landscape window (PWA)** | **1366 × 992** |
| portrait window | 1024 × 1334 |
| **Split View** | **678 × 992** (a report proves it happens) |
| iPadOS | 17.7.11 — terminal, never gets newer Safari |

Keep one thing in mind anyway: **CSS resolution alone cannot identify an iPad model.** The reports above
(`K2HXP`/`WSNHY`, 2026-07-14) were nearly filed as the child's device; they are the M1 iPad —
`platform: MacIntel`, `isM1iPad: true`, UA `Macintosh … Version/26.5`, because M1+ iPads send a
desktop-class UA. Only `isM1iPad` or the UA distinguishes them.

Also note **`1024 × 768` is not any current iPad Pro.** It stays in the guard set only as the tighter
small-iPad case.

## THERE ARE NOW TWO APPS ON THAT IPAD — check which one you are looking at

Since the staging PRD, the iPad carries both tiers side by side. They are separate apps to iOS, with
separate containers, so **a staging build cannot touch the child's real Reward Book** — which is the
whole reason for the second icon.

| | production | staging |
|---|---|---|
| home-screen name | **Børnelæring** | **BL Staging** |
| bundle id | `com.vraa.earlylearning` | `com.vraa.earlylearning.staging` |
| TestFlight track | its own | its own |
| backend | `boernelaering.dk` | `staging.boernelaering.dk` |
| corner badge | **none** | `TEST · staging.boernelaering.dk` |
| progress, PIN, passkeys | the child's real ones | disposable |

**Three ways to tell them apart, in increasing effort**: the icon's name; the badge in the top-left
corner (which prints the *origin the build actually calls*, so a mislabelled build is impossible); and
"Til de voksne" → the version chip in the rail footer, which now carries the backend host on **every**
tier — that is how a production binary answers the question, since it has no badge.

**The icons are near-identical, and that is unresolved.** Whether it confuses the child in daily use is
rung-3 residue no probe can close. If it does, the fix is a tinted variant of
`art-src/logo/app-store-icon-1024.png`, flattened (alpha is an upload rejection).

**A passkey does not cross tiers.** It is bound to the RP ID, so enrolling the iPad on one tier does
nothing for the other — Google sign-in is the way into either. That is deliberate: sharing the RP ID
would let staging accept production's passkeys.

## Rung 3 owed: the audio-activation checks (Audio activation PRD-01 §5.3)

**Status: NOT YET RUN.** Rungs 1 and 2 are done (the verdict's plumbing, the cue's geometry at four
viewports, the blocked→recover cycle); everything below is unreachable at either rung, so it is the whole
residue of that change. Record the answers here rather than in a session.

**Confirm `/api/version`'s `commitHash` FIRST.** The installed PWA keeps its loaded bundle until it is
swiped out of the app switcher, so a play-test right after a push tests the PREVIOUS build
(`.claude/rules/pwa-and-device.md`).

| check | what a pass looks like | result |
|---|---|---|
| Cold launch ×5 from the home-screen icon | no "Tryk for lyd" chip, narration audible | — |
| App-switcher round trip (background, wait, return) | no chip, narration still works — this is the `suspended`-aftermath path AND the frozen-clock recovery | — |
| Siri / a phone call mid-game | recovers with no chip | — |
| **Control Centre silent / mute switch ON** | the only way to test `audioSession.type = 'playback'`. **A/B against the previous build**: if muted-but-audible is NEW, that confirms `ambient` was the second root cause (WebKit 237322) | — |
| Audio genuinely off (whatever the owner's occasional case is) | the chip appears, one tap fixes it, it withdraws by itself | — |

If a check fails, the bug report now carries everything needed to tell the three causes apart in one
round trip — `readiness`, `primeResult`, `playbackOkOnce`, `hasBeenActive` + `userActivationSupported`,
`appCtx`/`howlerCtx` state *and* clock, `audioSessionType`, `everWorked`. Use `/debug-report`.

## Measuring the REAL bundle (`npm run build:harness`)

`?nogate=1` is `DEV &&`-gated and `import.meta.env.DEV` is false in every `vite build` regardless of
`--mode`, so a normal build tree-shakes the dev harness away and a preview build stops at the login
screen — which made production perf and route sweeps impossible. `npm run build:harness` builds a
**production-shaped** bundle (NODE_ENV forced to production, so React and minification match a deploy)
that still answers the dev params, then `vite preview` serves it.

It is a separate build-time flag, never a widening of DEV: `__HARNESS__` is statically replaced with
`false` for every other mode, so the bypass is **absent** from deploy output, not merely inert. Verified:
a plain `vite build` contains zero occurrences of `nogate` or `__HARNESS__`; the harness build contains
them. `src/utils/harnessBuild.test.ts` pins the wiring and fails if any deploy script selects the mode
(re-broken to confirm). **Never deploy a harness build.**

Measured on the harness build at 1366 × 992 (`--cpu-throttle`, 2026-08-04) — load is comfortable even at
a 6× CPU handicap: FCP 224–368 ms at 1×, 700–1400 ms at 6×; LCP ≤ 1.4 s at 6× on home/quiz/album.
**Read frame numbers with suspicion**: the driver runs headless with `--disable-gpu`, so rasterisation is
software and its median frame time (33 ms even at 1×) is an artifact, not a prediction of the device's
compositor. The one durable RELATIVE signal is that `/album` (Min Bog) is the consistent worst case for
frame time and jank at every throttle level — it renders the whole reward path — so it is the screen to
watch if he ever reports sluggishness.

### Steady-state main-thread cost (Performance PRD-01, 2026-08-05)

Load was never the problem — the app STANDING STILL was. `cdp.mjs --perf` cannot see that at all (it
measures load, and its frame times are the software-raster artifact noted above), so
`.claude/skills/ui-screenshot/perf.mjs` was written for it: a settled steady-state window reporting
GPU-independent counters. Measured on the harness build at `--cpu-throttle 6`, 1366 x 992 @ dpr 2, range
over two sweep runs.

| screen | busy% before → after | recalcMs/s | layerMB | willChange |
|---|---|---|---|---|
| home | 81–92 → **77–85** | 385–458 → 354–403 | 41.7 → 35.1 | 23 → 7 |
| `/alphabet` | 70–87 → **67–75** | 311–383 → 243–311 | 41.3 → 40.5 | 21 → 5 |
| `/alphabet/learn` | 78–81 → **16–24** | 96–105 → 51–82 | 53.3 → 42.7 | 17 → 3 |
| `/alphabet/quiz` | 50–78 → **14–23** | 99–193 → 39–65 | 51.1 → 39.7 | 17 → 3 |
| `/farver/ram-farven` | 63–74 → **21–33** | 147–171 → 53–88 | 50.6 → 39.3 | 17 → 3 |
| `/math/addition` | 53–62 → **21–25** | 117–147 → 64–81 | 51.1 → 39.9 | 17 → 3 |
| `/album` | 49–50 → **22–31** | 148–167 → 56–83 | 53.6 → 41.8 | 17 → 3 |

**The menu routes are noisy — up to ~10 points run-to-run.** Never quote a single run as a result, and
always confirm the screen actually rendered its own Danish title (a crashed route satisfies a
`--wait-for` and makes every later number vacuously good).

Four facts worth not re-deriving:

- **`recalcPerSec` cannot be driven below ~60 while anything animates.** Blink counts one style
  recalculation per animating FRAME, whatever the mechanism. On home at 6x: stripping every CSS keyframe
  animation leaves it at 60.1, neutering the parallax driver leaves it at 59.3, and only reduced motion
  reaches 0. **`recalcMsPerSec` is the number to gate on.**
- **What remains on a MENU route is the ambient field's own animation, and nothing else.** Home at 6x:
  78–85% busy running, **39.7% with the ambient animations paused**, 10.6% under reduced motion. Pinning
  the parallax layers still changes nothing (78.3%). Not rasterisation — dpr 1 and dpr 2 measure the same
  (84.7 vs 85.7) — and `translate3d` in the keyframes changes nothing. The only lever left is the sprite
  COUNT, which is the visible bloom.
- **A `transform`/`opacity` keyframe animation promotes its own element**, which is why the
  `will-change` hints could be deleted with no visual change. So a screen with a live ambient field has a
  layer floor of roughly `9 + sprite count`; `layers ≤ 18` on home is not reachable with the world running.
- **`filter: drop-shadow` is load-bearing on a TRANSLUCENT surface** and cannot be swapped for
  `box-shadow` there. `tileSurface()` ends at `rgba(accent, 0.08)`, so the shadow shows through the
  tile's own face: converting lifted a tile face by 20 RGB with DOM rects byte-identical. Only opaque
  boxes (TactilePill, the Sig et Ord orb) were converted.

### Eager JavaScript at first paint (Performance PRD-01 W7, 2026-08-05)

What the document actually fetches before it can paint — the entry `<script type="module">` plus every
`<link rel="modulepreload">` in `dist/index.html`. Re-derive it after any chunking change:

```bash
npm run build:harness && node -e "const fs=require('fs');const h=fs.readFileSync('dist/index.html','utf8');
  const pre=[...h.matchAll(/modulepreload[^>]*assets\/([^\"]+)/g)].map(m=>m[1]);
  const ent=[...h.matchAll(/<script[^>]*type=\"module\"[^>]*src=\"[^\"]*assets\/([^\"]+)\"/g)].map(m=>m[1]);
  const kb=f=>fs.statSync('dist/assets/'+f).size/1024, all=[...ent,...pre];
  console.log(all.map(f=>kb(f).toFixed(0)+'KB '+f).join('
'));
  console.log('TOTAL '+(all.reduce((s,f)=>s+kb(f),0)/1024).toFixed(3)+' MB across '+all.length)"
```

| | chunks | total |
|---|---|---|
| before | 20 | **1.138 MB** |
| after `prebakedTts` made lazy | 20 | 0.975 MB |
| after pruning the lazy-route preloads | **18** | **0.916 MB** |

Today's list: `index` 153 · `mui-vendor` 281 · `react-vendor` 222 · `motion-vendor` 131 ·
`media-vendor` 35 · `depth` 27 · `ttsClient` 22 · `authorizedFetch` 17 · `progressStore` 17 ·
`musicClient` 11 · `auth-vendor` 8 · `progressSchema` 5 · `stickers` 4 · `danish-phrases` 2 ·
`gamePhrases` 1 · `progression` 1 · `rolldown-runtime` 1 · `shared-tts-key` 0 (KB).

Two things worth knowing before touching this again:

- **The 166 KB narration manifest is now a dynamic import, and the lookup MUST NOT await it.** iOS
  consumes the transient user-activation across an `await`, and the prebaked branch of
  `synthesizeAndPlay` reaches `play()` with nothing awaited in front of it — that is what keeps the
  first tap in-gesture. So `prebakedFor()` reads a synchronously-available map or reports a MISS, which
  falls through to live Azure (a slower first clip, never silence). The load is kicked at `ttsClient`
  module init, so that window is a few ms. Verified with `cdp.mjs --audio-report`: the first tap on
  Lær Alfabetet still plays `/sounds/tts/<hash>.mp3`, i.e. the prebaked file, not a live synth.
- **Vite 8 / Rolldown preloads chunks reachable through a DYNAMIC import too.** `index.html` was
  preloading `dnd-vendor` (49 KB of @dnd-kit) and `colorContent` although nothing in `App.tsx`'s static
  graph touches either — every importer is a lazy route component. PRD-01 F8 guessed a `manualChunks`
  artifact; it is the preload-graph walk. `build.modulePreload.resolveDependencies` prunes them for
  `hostType === 'html'` only, so on-demand loading at navigation is untouched (verified: /farver/jagt,
  /ordleg/spelling, /math/addition and /alphabet/quiz all still mount with their drag targets).

The build target is now pinned (`target: ['safari17','ios17']` in `vite.config.ts`) so the syntax floor
matches this device instead of following Vite's default.

A second real device from the reports (390 × 844 @dpr 3, PWA, both orientations) already matches the
existing phone entries.

How to verify: `webkit.mjs --device ipad-pro` (the DEFAULT) / `--device ipad-pro-portrait` /
`--device ipad-pro-split`, and `sweep.mjs`, which leads with the TARGET viewports.

**Audio on this device is the known danger zone.** It is why every shipped file is MP3 (Ogg needs
iPadOS 18.4) and why the codec snapshot matters — see `.claude/rules/audio-system.md`.

**Performance caveat:** `cdp.mjs --cpu-throttle` approximates a slow CPU but is not an A10X — it scales
CPU only, leaving GPU, memory bandwidth, decode and Safari's own JIT untouched. Always measure the
**harness build** (above), never the dev server: unbundled dev ESM overstates load by roughly an order of
magnitude (FCP 1.3 s vs 0.3 s on the same screen).


Researched 2026-08-04. The question was: can an online service (simulated or real devices) replace
"please test this on your iPad", so a session can verify its own work at device quality?

**Answer: partly, and the part that can't be replaced is the part we ask for most — listening.**
Rungs 1 and 2 are built and free (`.claude/skills/ui-screenshot/`). Rung 3 costs money and still
doesn't give an agent ears. Don't re-run this survey; update it if a vendor changes.

## The finding that shapes everything

No device farm can hand an agent audio it can hear. BrowserStack does stream audio out of real
devices — iOS 13.4+, but only on a short list that includes iPad 9, iPad 10 and iPad Pro 11, and they
flag that ReplayKit is disabled by default on some iPads running **iPadOS 17+**, which is exactly our
floor. Even where it works, the audio reaches a *human's ears*, not a transcript. Their audio
*injection* feature is the input side (feeding a mic), and their own docs say "when the audio file is
playing, you do not hear the audio".

So the durable answer to "did the child hear that?" is not a service — it is an assertion. That is
what `--audio-report` does (see the skill): assert `currentTime` advanced, `play()` didn't reject,
`decodeAudioData` didn't fail. Both real silences this repo has shipped were mechanically detectable
that way with no ears involved:
- **Ogg narration on iPadOS 17.7** — `decodeAudioData` rejects / `MEDIA_ERR_DECODE`. Note real WebKit
  reports `canPlayType('audio/ogg')` as **unsupported** while Chrome says `"probably"`, so rung 2
  catches this class and rung 1 structurally cannot.
- **The iOS gesture rule** — `play()` rejects `NotAllowedError`.

## Vendors, as of 2026-08-04

There is **no permanent free real-device tier** anywhere any more. "Free" means one evaluation.

| service | free | cheapest paid | notes |
|---|---|---|---|
| **BrowserStack** | 30 interactive min + 100 automate min, one-time | Live $29/mo (annual) / $39 monthly; **Automate $129/mo** | The only one whose *scriptable* real-iOS story fits how we work: **Playwright on real iOS Safari** (industry-first, June 2025), Automate plan only. Catalogue has iOS 17 iPads incl. iPad Pro 12.9 2021/2022 and iPad Pro 11 2021. Audio output on iPad 9/10/Pro 11. |
| **TestingBot** | 14-day trial | Live €20/mo (annual); **PAYG €0.06/min, 1000 min = €60, credits never expire** | Best price/quality for occasional use, and **EU/GDPR-hosted** — worth weighting given child screenshots in bug reports. Real iPhones/iPads, manual + automated. No Playwright-on-real-iOS; drive via Appium/Selenium. |
| **LambdaTest / TestMu AI** | 100 **lifetime** min; free plan is emulator/simulator only | Real Device Plus Live $39/mo; automation ~$99/mo | Rebranded TestMu AI Jan 2026. Also added Playwright on real iOS (July 2025). |
| **AWS Device Farm** | 1000 device min, one-time | $0.17/device-min; interactive remote access needs an **unmetered** slot at **$250/mo** | Remote access pricing rules it out. |
| **Appetize.io** | 30 min/mo, **public apps only** | $59/mo | Streams real iOS runtimes in-browser (iOS 15–26) — useful for Windows, but the public-app free tier is a non-starter for this app. |
| **BrowserStack Open Source** | unlimited, free, lifetime | — | Requires a **public** open-source project. This repo is private, so not eligible. |

## Prerequisite if we ever buy rung 3

The app is hard-gated behind Google OIDC + passkey, and a cloud device loading a Vercel preview hits that
wall: passkeys are useless on a shared farm device, and Google routinely blocks sign-in from device-farm
IPs. **This is solved for local work by `npm run build:harness` (above)** — but a farm would need that
bundle actually deployed somewhere reachable, which is the one thing a harness build must never be. So
plan on a throwaway preview host, not the production project. Also relevant: no service worker + `no-store` on `/(.*)` means the farm device needs live
network throughout (see CLAUDE.md's PWA bullet) — never design a farm test around offline behaviour.

## Recommendation on record

1. **Built (free):** rungs 1 + 2 — `cdp.mjs --audio-report` for playback assertions, `webkit.mjs` for
   Safari-engine layout, iOS code paths and the codec snapshot. Real WebKit is published at ~80–90% of
   WebKit-specific rendering/JS bugs; the residue is Mobile-Safari-only behaviour (scroll, `fixed`,
   viewport units, memory pressure, backgrounding) plus true iPadOS 17.7 engine gaps.
2. **If we want real-iPad verification on release days:** €60 of TestingBot PAYG. Non-recurring,
   EU-hosted, credits never expire.
3. **Only if it becomes routine:** BrowserStack Automate at $129/mo for scripted Playwright on real iOS.

Sources: BrowserStack ([audio output FAQ](https://www.browserstack.com/support/faq/live/features-live/how-come-i-can-watch-videos-but-cant-hear-audio),
[Playwright on real iOS](https://www.browserstack.com/docs/automate/playwright/playwright-ios/nodejs),
[iPad list](https://www.browserstack.com/test-on-ipad)) ·
[TestingBot pricing](https://testingbot.com/pricing) · [LambdaTest pricing](https://www.lambdatest.com/pricing) ·
[AWS Device Farm pricing](https://aws.amazon.com/device-farm/pricing) · [Appetize pricing](https://www.spotsaas.com/product/appetize-io/pricing)
