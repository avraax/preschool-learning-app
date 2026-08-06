// Page-side audio instrumentation. Injected BEFORE any app script (so it sees the very first clip),
// by both drivers here: cdp.mjs `--audio-report` and webkit.mjs `--audio-report`.
//
// WHY THIS EXISTS: a screenshot cannot show silence, and no device-farm service can hand an agent
// audio it can hear. So "did the child actually hear that?" has to become an assertion. The two
// real-device silences this repo has already shipped were both mechanically detectable from inside
// the page, with no ears involved:
//   * Ogg narration on iPadOS 17.7 — decodeAudioData rejected / <audio> raised MEDIA_ERR_DECODE.
//   * The iOS gesture rule — play() rejected with NotAllowedError.
// A third class it catches for free: play() RESOLVES and the element still never advances past 0
// (wrong src, empty file, zero-length prebake), which is the failure that looks fine in every log.
//
// It records ATTEMPTS, not elements, because ttsClient reuses ONE shared <audio> for every clip —
// aggregating per element would merge 40 narration lines into a single row.
//
// LIMITS, so nobody over-claims from a green report: this proves the pipeline decoded audio and the
// clock advanced, i.e. the browser believes it emitted samples. It cannot prove loudness, that the
// right words were spoken, mix balance, or that a device's hardware route was audible. For Howler's
// WebAudio path (sfx) the honest ceiling is "decoded + source started" — there is no clock to read.
//
// ONE KNOWN AMBIGUITY, so a rare red is not chased as a bug: a clip cancelled AFTER its play() promise
// already RESOLVED cannot be told apart from a genuinely silent one. Both look like "resolved, clock
// never moved" — the cancel produces no AbortError because there was no pending promise left to reject.
// Lær Tal's autoplay browse tripped this once in ~6 runs (a fully-loaded 1.32s clip, readyState 4, zero
// progress) and was clean 5/5 afterwards. So treat a single non-reproducing "no progress" on an autoplay
// SEQUENCE as suspect-but-unproven, and re-run before filing it. A repeatable one is real.
;(function () {
  if (window.__audioProbe) return

  var MIN_PROGRESS = 0.05 // seconds of real playback before we call an attempt "sounded"
  var attempts = []
  var wa = { contexts: 0, states: [], decodeOk: 0, decodeFail: 0, decodeFailures: [], sourceStarts: 0 }
  var notes = []

  function now() { try { return Math.round(performance.now()) } catch (e) { return 0 } }
  function note(msg) { notes.push(now() + 'ms ' + msg); if (notes.length > 200) notes.shift() }

  // Keep sources readable: a data: URL is 100k+ chars of base64, a prebaked clip is a path worth seeing.
  function shortSrc(s) {
    if (!s) return '(no src)'
    if (String(s).indexOf('data:') === 0) return 'data:… (' + String(s).length + ' chars)'
    try { return new URL(String(s), location.href).pathname } catch (e) { return String(s).slice(0, 90) }
  }

  function bind(el) {
    if (el.__probeBound) return
    el.__probeBound = true
    el.addEventListener('timeupdate', function () {
      var a = el.__probeAttempt
      if (!a) return
      a.timeupdates++
      if (el.currentTime > a.maxTime) a.maxTime = el.currentTime
      // Volume/mute must be sampled ACROSS the attempt, not at play() time. musicClient starts its bed
      // at volume 0 and FADES IN, so a play()-time sample reports the healthy music bed as "silenced" —
      // it produced 12 false positives across every menu before this was tracked over time.
      if (el.volume > a.maxVolume) a.maxVolume = el.volume
      if (!el.muted) a.everUnmuted = true
    })
    el.addEventListener('ended', function () { if (el.__probeAttempt) el.__probeAttempt.ended = true })
    el.addEventListener('stalled', function () { if (el.__probeAttempt) el.__probeAttempt.stalled++ })
    el.addEventListener('error', function () {
      var a = el.__probeAttempt
      var err = el.error
      var desc = err ? 'MediaError code ' + err.code + (err.message ? ' (' + err.message + ')' : '') : 'error event, no MediaError'
      if (a) a.mediaError = desc
      note('media error: ' + desc + ' on ' + shortSrc(el.currentSrc || el.src))
    })
  }

  try {
    var origPlay = HTMLMediaElement.prototype.play
    HTMLMediaElement.prototype.play = function () {
      var el = this
      bind(el)
      var a = {
        n: attempts.length + 1,
        at: now(),
        src: shortSrc(el.currentSrc || el.src || el.getAttribute('src')),
        rawSrc: String(el.currentSrc || el.src || el.getAttribute('src') || '').slice(0, 40),
        muted: !!el.muted,
        volume: typeof el.volume === 'number' ? el.volume : 1,
        maxVolume: typeof el.volume === 'number' ? el.volume : 1,
        everUnmuted: !el.muted,
        rejected: null,
        mediaError: null,
        maxTime: 0,
        timeupdates: 0,
        ended: false,
        stalled: 0,
        readyState: el.readyState,
        duration: isFinite(el.duration) ? el.duration : null,
      }
      attempts.push(a)
      el.__probeAttempt = a
      var p
      try {
        p = origPlay.apply(el, arguments)
      } catch (e) {
        a.rejected = (e && e.name) || String(e)
        note('play() threw ' + a.rejected)
        throw e
      }
      if (p && typeof p.then === 'function') {
        p.then(function () {
          a.readyState = el.readyState
          if (isFinite(el.duration)) a.duration = el.duration
        }, function (e) {
          a.rejected = (e && e.name) || String(e)
          note('play() rejected ' + a.rejected + ' on ' + a.src)
        })
      }
      return p
    }
  } catch (e) { note('could not patch HTMLMediaElement.play: ' + e) }

  // ---- WebAudio (Howler's default path for SFX) ----
  // decodeAudioData is where an undecodable container fails. Patch both AudioContext flavours via the
  // shared BaseAudioContext prototype when present, else the concrete constructors.
  try {
    var Ctx = window.AudioContext || window.webkitAudioContext
    var protos = []
    if (window.BaseAudioContext && window.BaseAudioContext.prototype) protos.push(window.BaseAudioContext.prototype)
    else if (Ctx && Ctx.prototype) protos.push(Ctx.prototype)
    protos.forEach(function (proto) {
      var origDecode = proto.decodeAudioData
      if (!origDecode) return
      proto.decodeAudioData = function (buf, onOk, onErr) {
        var bytes = buf && buf.byteLength
        var ok = function (b) { wa.decodeOk++; if (onOk) onOk(b) }
        var bad = function (e) {
          wa.decodeFail++
          var msg = (e && (e.message || e.name)) || 'decode failed'
          wa.decodeFailures.push(msg + ' (' + bytes + ' bytes)')
          note('decodeAudioData FAILED: ' + msg)
          if (onErr) onErr(e)
        }
        var r = origDecode.call(this, buf, onOk ? ok : undefined, onErr ? bad : undefined)
        if (r && typeof r.then === 'function') return r.then(function (b) { wa.decodeOk++; return b }, function (e) { bad(e); throw e })
        return r
      }
    })
    if (Ctx) {
      var Wrapped = function () {
        var c = arguments.length ? new Ctx(arguments[0]) : new Ctx()
        wa.contexts++
        try { wa.states.push(c.state) } catch (e) { /* ignore */ }
        return c
      }
      Wrapped.prototype = Ctx.prototype
      window.AudioContext = Wrapped
      if (window.webkitAudioContext) window.webkitAudioContext = Wrapped
    }
    if (window.AudioBufferSourceNode && window.AudioBufferSourceNode.prototype) {
      var origStart = window.AudioBufferSourceNode.prototype.start
      if (origStart) {
        window.AudioBufferSourceNode.prototype.start = function () {
          wa.sourceStarts++
          return origStart.apply(this, arguments)
        }
      }
    }
  } catch (e) { note('could not patch WebAudio: ' + e) }

  // Format capability snapshot. On the iPadOS-17 floor this alone convicts an Ogg regression before a
  // single clip plays — `audio/ogg` comes back '' where `audio/mpeg` says 'maybe'/'probably'.
  function formats() {
    var out = {}
    try {
      var a = document.createElement('audio')
      ;['audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/ogg; codecs="vorbis"', 'audio/ogg; codecs="opus"', 'audio/wav'].forEach(function (t) {
        out[t] = a.canPlayType(t) || '(no)'
      })
    } catch (e) { out.error = String(e) }
    return out
  }

  // An attempt lands in one of FOUR buckets, and getting these apart is the whole difficulty:
  //
  //  prime     — the deliberately silent iOS unlock clip (ttsClient.primePlaybackElement sets
  //              SILENT_UNLOCK_CLIP, a `data:audio/wav` blob, then pauses it). It is SUPPOSED to make
  //              no sound and never advance. Keyed on the wav mime because every real clip is mp3
  //              (TTS_CONFIG.mime = audio/mpeg — see audio-system.md), so this can't swallow narration.
  //  preempted — play() rejected AbortError. This is the app's DOCUMENTED no-queue model: new audio
  //              cancels current (stopCurrentAudio pauses + clears src), which rejects the in-flight
  //              promise. Expected on any fast tap. NOT a defect on its own — but if EVERYTHING is
  //              pre-empted and nothing ever sounds, something is cancelling narration, which is a
  //              real bug class here, so the verdict still fails when sounded === 0.
  //  failed    — a genuine silence: NotAllowedError (the iOS gesture rule), NotSupportedError /
  //              MEDIA_ERR_DECODE (the Ogg-on-iPadOS-17 shape), muted, volume 0, or the quiet one —
  //              play() RESOLVED and the clock never moved.
  //  sounded   — the clock actually advanced.
  function bucket(a) {
    // An element with NO src cannot be a clip anyone was meant to hear — it is an unlock/prime. Howler
    // does this on every touch platform: `_unlockAudio` walks its html5AudioPool (10 nodes) calling
    // play()/pause() on each src-less element to user-activate it. Under an iPad UA that produced 22
    // such calls here, all of which a naive rule reads as "22 silent clips". Chrome with a desktop UA
    // never shows them at all, which is exactly why this rule had to be found on the WebKit side.
    if (!a.rawSrc) return 'prime'
    if (/^data:audio\/wav/.test(a.rawSrc || '')) return 'prime'
    // muted / volume 0 MUST be tested before the clock, because a silenced element still advances
    // currentTime perfectly normally — that is the whole reason this check exists, and ordering it
    // after `maxTime` scores the loudest possible bug as a success. Judge on the MAX seen over the
    // attempt's life (a fade-in legitimately starts at 0); silent for its whole life is the defect.
    if (!a.everUnmuted || a.maxVolume === 0) return 'failed'
    if (a.maxTime > MIN_PROGRESS) return 'sounded'
    if (a.rejected === 'AbortError') return 'preempted'
    // Too young to judge: a clip whose play() landed just before the report (live Azure synth is ~1.1s,
    // and a prebaked fetch adds more) has had no chance to advance. Calling that SILENT invents a
    // defect and makes the verdict a race against the driver's own settle time.
    if (a.ageAtReport < 700) return 'pending'
    return 'failed'
  }

  function reason(a) {
    if (a.rejected) return 'play() rejected: ' + a.rejected
    if (a.mediaError) return a.mediaError
    if (a.muted) return 'element was muted'
    if (a.volume === 0) return 'volume was 0'
    if (a.maxTime <= MIN_PROGRESS) return 'no progress — play() resolved but currentTime never passed ' + MIN_PROGRESS + 's (src ' + a.src + ')'
    return 'unknown'
  }

  window.__audioProbe = {
    reset: function () { attempts.length = 0; notes.length = 0; wa.decodeOk = 0; wa.decodeFail = 0; wa.decodeFailures.length = 0; wa.sourceStarts = 0 },
    report: function () {
      var by = { sounded: [], preempted: [], failed: [], prime: [], pending: [] }
      attempts.forEach(function (a) { a.ageAtReport = now() - a.at; by[bucket(a)].push(a) })
      var real = attempts.length - by.prime.length - by.pending.length // attempts meant to be heard AND old enough to judge
      var broken = by.failed.length > 0 || wa.decodeFail > 0
      var mute = real > 0 && by.sounded.length === 0 // everything cancelled / nothing ever heard
      return {
        formats: formats(),
        media: {
          attempts: attempts.length,
          meantToBeHeard: real,
          sounded: by.sounded.length,
          preempted: by.preempted.length,
          primes: by.prime.length,
          pending: by.pending.length,
          failed: by.failed.map(function (a) { return { n: a.n, src: a.src, why: reason(a), maxTime: +a.maxTime.toFixed(3), timeupdates: a.timeupdates, readyState: a.readyState } }),
          detail: attempts.map(function (a) {
            return { n: a.n, bucket: bucket(a), src: a.src, maxTime: +a.maxTime.toFixed(3), dur: a.duration, ended: a.ended, muted: a.muted, vol: a.volume, maxVol: a.maxVolume, age: a.ageAtReport, rejected: a.rejected, err: a.mediaError }
          }),
        },
        webaudio: { contexts: wa.contexts, states: wa.states, decodeOk: wa.decodeOk, decodeFail: wa.decodeFail, decodeFailures: wa.decodeFailures.slice(0, 5), sourceStarts: wa.sourceStarts },
        notes: notes.slice(-30),
        // The one line a caller should gate on.
        verdict: (real === 0 && wa.sourceStarts === 0 && by.pending.length > 0)
          ? 'PENDING — ' + by.pending.length + ' clip(s) started too recently to judge; give the driver a longer settle'
          : (real === 0 && wa.sourceStarts === 0)
          ? 'NO AUDIO ATTEMPTED (nothing called play() or started a buffer — did the trigger fire?)'
          // NARRATION dead while WebAudio lives. This used to fall through to `OK — 0/0 clips played`,
          // which is the one verdict shape that hides report J62KA exactly: a hung unlock swallowed every
          // `speak()` so no narration clip was ever REQUESTED, while Howler's SFX/music (its own context,
          // its own elements) played on — measured, and the reason the owner read the bug as "TTS is
          // broken" rather than "audio is off". `real === 0` means nothing was ever meant to be heard, so
          // a live SFX buffer cannot redeem it. SILENT, and therefore exit 1.
          : (real === 0)
          ? 'SILENT — no narration was ever requested (0 clips meant to be heard) while ' + wa.sourceStarts +
            ' webaudio source(s) played: SFX alive, TTS dead — the report-J62KA shape (hung unlock?)'
          : broken
            ? 'SILENT — ' + by.failed.length + ' of ' + real + ' clips genuinely failed, ' + wa.decodeFail + ' decode failures'
            : mute
              ? 'SILENT — nothing was ever heard: all ' + real + ' clips were pre-empted before playing (something is cancelling narration)'
              : 'OK — ' + by.sounded.length + '/' + real + ' clips played (' + by.preempted.length + ' pre-empted by design, ' + by.prime.length + ' silent unlock primes, ' + wa.sourceStarts + ' webaudio sources)',
      }
    },
  }
  note('audio probe installed')
})()
