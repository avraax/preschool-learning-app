# Verifying on devices — what exists, what it costs, what it can't do

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

The app is hard-gated behind Google OIDC + passkey and `?nogate=1` is **DEV-only**. A cloud device
loading a Vercel preview hits that wall: passkeys are useless on a shared farm device, and Google
routinely blocks sign-in from device-farm IPs. A preview-only, env-flagged gate bypass has to exist
first. Also relevant: no service worker + `no-store` on `/(.*)` means the farm device needs live
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
