// Page-side simulation of a device where audio really IS blocked. Injected BEFORE app scripts by
// cdp.mjs `--simulate-audio-blocked`.
//
// WHY IT EXISTS: the app's audio verdict (Audio activation PRD-01) is EVIDENCE-BASED, so `blocked` is
// only reachable when three things hold at once — a gesture has happened, the narration element's
// `play()` is refused with `NotAllowedError`, and no AudioContext clock is moving. Chrome cannot be
// coaxed into that combination by a launch flag: `--autoplay-policy=document-user-activation-required`
// blocks playback only UNTIL the first real gesture, and the same gesture that sets
// `userActivation.hasBeenActive` also unlocks `play()` and resumes the context. So without this, the
// cue-absence assertions in every other recipe are VACUOUS — nothing proves the selector can ever match.
//
// This reproduces the state through the app's REAL evidence path (a rejected prime plus a dead clock),
// not by forcing the component to render. It is a simulation of the DEVICE, not of the verdict:
//   * `HTMLMediaElement.play()` rejects with a genuine `NotAllowedError`, which is what
//     `classifyPrimeFailure` reads and what iOS raises when an element is not user-activated;
//   * `AudioContext.resume()` resolves without ever running, so `state` stays `suspended` and
//     `currentTime` never advances — the clock probe correctly reports no liveness.
//
// LIMITS, so nobody over-claims: this proves the app's PLUMBING reaches `blocked` and recovers from it.
// It says nothing about whether iPadOS 17.7 produces this state, or about how it looks on the device.
// `window.__audioBlockedSim.restore()` puts the real implementations back, which is how the RECOVERY leg
// is tested: block → assert the cue appears → restore → tap the cue → assert it goes away because a clip
// actually sounded. Without a restore you can only ever prove the cue appears, never that it withdraws,
// and "the cue never withdraws" is the exact class of bug this PRD removed (the old modal's dead latch).
;(function () {
  if (window.__audioBlockedSim) return
  window.__audioBlockedSim = { plays: 0, resumes: 0, restore: function () {} }

  var notAllowed = function () {
    // A real DOMException, so `e.name === 'NotAllowedError'` is true by construction rather than by a
    // hand-set property the app might read differently.
    try {
      return new DOMException('play() blocked by audio-blocked-sim', 'NotAllowedError')
    } catch (e) {
      var err = new Error('play() blocked by audio-blocked-sim')
      err.name = 'NotAllowedError'
      return err
    }
  }

  var origPlay = null
  var origResume = null

  try {
    origPlay = HTMLMediaElement.prototype.play
    HTMLMediaElement.prototype.play = function () {
      window.__audioBlockedSim.plays++
      // Deliberately do NOT call through: a real block never starts the media clock either, and calling
      // through would let the element report progress and hand the app positive evidence.
      return Promise.reject(notAllowed())
    }
  } catch (e) {}

  // Both the app's own context and Howler's go through this prototype, which is the point — the probe
  // ORs over every app-owned context, so leaving either one runnable would defeat the simulation.
  // NB this only matters together with the launcher's --block-autoplay: with autoplay allowed a fresh
  // AudioContext is born `running`, so stubbing resume() alone leaves a live clock and the verdict is
  // correctly `live`. That combination cost one confusing run — keep the two flags together.
  try {
    if (window.AudioContext) {
      origResume = window.AudioContext.prototype.resume
      window.AudioContext.prototype.resume = function () {
        window.__audioBlockedSim.resumes++
        return Promise.resolve()
      }
    }
  } catch (e) {}

  window.__audioBlockedSim.restore = function () {
    try { if (origPlay) HTMLMediaElement.prototype.play = origPlay } catch (e) {}
    try { if (origResume) window.AudioContext.prototype.resume = origResume } catch (e) {}
    return { play: !!origPlay, resume: !!origResume }
  }
})()
