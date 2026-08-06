# How far each rung can verify

What rung 1, rung 2 and rung 3 each prove and cannot prove, and the four outcomes a probe needs.

Back to `../SKILL.md`.

## How far each rung can actually verify (read this before promising anything)

Three rungs, in increasing cost and decreasing convenience. **Say which rung a claim came from** — the
owner's standing complaint is being asked to play-test things a machine could have checked, and the
opposite error (calling a WebKit run "verified on iPad") is worse.

| rung | command | proves | cannot prove |
|---|---|---|---|
| 1. Chrome | `cdp.mjs` | layout, interaction, game logic, progress, **and that audio produced sound** (`--audio-report`) | anything Safari-specific; Chrome plays Ogg happily, so it can NEVER catch the codec floor |
| 2. real WebKit | `webkit.mjs` | Safari-engine layout, the app's **iOS branches** (`deviceDetection` sees an iPad UA), and codec support via `canPlayType` — it correctly reports `audio/ogg` as unsupported | audio PLAYBACK (see below), Mobile-Safari scroll/`fixed`/viewport quirks, iOS transient user-activation, iPadOS 17.7 engine gaps |
| 3. real device | the owner's iPad | everything, including whether it sounds right | — |

**Rung 2 cannot play audio at all.** Playwright's WebKit build on Windows has **no WebAudio and no
speechSynthesis** — `typeof AudioContext === 'undefined'`, verified directly. The app therefore logs
`initializeAudio: ctxState= undefined speechAvail= false` and narration never starts. That is an
environment limit, **not an app bug** — do not go debugging the app when you see it. Audio *playback*
assertions belong on rung 1; WebKit's audio contribution is the `canPlayType` snapshot, which is a
static codec table and needs no device.

**What rung 1 + 2 together replace:** every "does it render / lay out / respond / score / actually make
a sound" question. **What still needs the owner:** does the Danish sound *right* (wording, pronunciation,
pacing to the ear), real-iPad touch feel, and true iPadOS 17.7 engine behaviour. See
`docs/device-testing.md` for why no paid service removes the listening step, and what a device farm
would cost if we ever want rung 3 automated.

Drive the locally-running app in **headless Chrome** (already installed) via the Chrome DevTools
Protocol, using the zero-dependency driver `cdp.mjs` here (Node 22+ global WebSocket/fetch — no
`npm install`). Capture screenshots to view, wait for elements, and measure rects to PROVE layout.
