// Page-side simulation of report J62KA: an iOS `AudioContext.resume()` whose promise NEVER SETTLES.
// Injected BEFORE app scripts by cdp.mjs `--simulate-hung-resume`.
//
// WHY IT EXISTS: on an iPhone 13 Pro (iOS 18.7 / Safari 26.6, 2026-08-06) the music bed and every SFX
// played while NO letter in Lær Alfabetet made a sound. The unlock had logged
// `[audio-unlock] initializeAudio: ctxState= suspended`, the narration element had primed OK — and the
// next line in `initializeAudio` never printed. One bare `await resumePromise` sat between them.
// `resume()` never answered, so `initializeAudio()` never resolved; its de-dupe promise
// (`initPromiseRef`) therefore never cleared, and every later `speak()` awaited the same dead promise.
// Howler owns its own context and element pool, which is why music and SFX were unaffected — the exact
// shape that makes this bug look like "TTS is broken" rather than "audio is off".
//
// A hang is NOT what `--simulate-audio-blocked` produces: that one RESOLVES `resume()` without running
// the clock, which the app handles correctly and reports as `blocked`. A promise that never settles is a
// different failure — nothing rejects, nothing times out, no verdict is ever reached, and the app has no
// evidence of anything being wrong. It cannot be reached by any launch flag.
//
// USE IT AS A REGRESSION GATE: with the bounded unlock in place (`settleWithin` in
// src/utils/audioLiveness.ts) a run under this sim must still reach `audio verdict: OK` — the app waits
// out its verify budget and plays anyway. Restore the bare `await` and the same command reports
// `NO AUDIO ATTEMPTED`, because no clip is ever requested at all.
//
// LIMITS: this proves the app's PLUMBING survives a promise that never answers. It says nothing about
// why WebKit hung, whether iPadOS 17.7 hangs the same way, or how any of it sounds on the device.
// `window.__hungResumeSim.restore()` puts the real `resume()` back.
;(function () {
  if (window.__hungResumeSim) return
  window.__hungResumeSim = { resumes: 0, restore: function () {} }

  var origResume = null
  var origState = null

  try {
    if (window.AudioContext) {
      origResume = window.AudioContext.prototype.resume
      window.AudioContext.prototype.resume = function () {
        window.__hungResumeSim.resumes++
        // Never resolves, never rejects. Deliberately does NOT call through: a call that settled would
        // let the app off the hook, which is the whole thing being tested.
        return new Promise(function () {})
      }

      // **Hanging `resume()` alone is INERT here** — measured: headless Chrome hands the app a context
      // that is already `running`, so `initializeAudio`'s `if (state !== 'running')` never calls resume
      // at all and a bare `await resumePromise` still played every clip. `--block-autoplay` does not fix
      // it either; the one `resume()` seen in that run was Howler's. So the state has to be forced to
      // what the iPhone actually reported: `[audio-unlock] initializeAudio: ctxState= suspended`.
      //
      // `state` is defined on **BaseAudioContext.prototype**, not on AudioContext.prototype — looking it
      // up on the latter returns undefined and the patch silently does nothing (measured: the run then
      // reported OK even with the bug restored, which is the "the mutation never arrived" failure, not a
      // passing test). So walk the chain to whichever prototype actually owns the accessor.
      var proto = window.AudioContext.prototype
      while (proto && !Object.getOwnPropertyDescriptor(proto, 'state')) proto = Object.getPrototypeOf(proto)
      var desc = proto && Object.getOwnPropertyDescriptor(proto, 'state')
      if (desc && desc.get) {
        origState = { proto: proto, desc: desc }
        Object.defineProperty(proto, 'state', {
          configurable: true,
          get: function () {
            return 'suspended'
          },
        })
      }
      window.__hungResumeSim.statePatched = !!origState
    }
  } catch (e) {}

  window.__hungResumeSim.restore = function () {
    try {
      if (origResume) window.AudioContext.prototype.resume = origResume
    } catch (e) {}
    try {
      if (origState) Object.defineProperty(origState.proto, 'state', origState.desc)
    } catch (e) {}
    return { resume: !!origResume, state: !!origState }
  }
})()
