import { useCallback, useEffect, useRef, useState } from 'react'
import { authorizedFetch } from '../services/authorizedFetch'

export interface SpeechResult {
  transcript: string
  confidence: number
}

/**
 * Why the mic couldn't open. `'denied'` is the only one the adult can fix (iPadOS Settings), so the
 * game shows a different message for it — and NOTHING here is permanent: a later `prime()` can still
 * succeed (the adult grants access, or another app releases the mic), which is why the game's
 * fallback screen carries a retry instead of latching a dead state until reload.
 */
export type MicPermission = 'unknown' | 'granted' | 'denied' | 'error'

// Candidate MIME types in preference order. Chrome → webm/opus, Safari → mp4/aac.
// The server uses autoDecodingConfig, so it accepts either container.
const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/aac']

// Minimum blob size to bother sending (filters accidental taps that produced no audio).
const MIN_BLOB_BYTES = 1200

// Ask for data every 250ms rather than only at stop(). Safari has shipped builds where the single
// stop-time blob comes back empty for very short recordings; accumulated chunks are the safe form.
const CHUNK_MS = 250

// Recognition budget. `/api/stt`'s own maxDuration is 15s, so a client that waits forever can only be
// waiting on a hung socket — and "Lad mig tænke…" forever is indistinguishable from a broken game.
const STT_TIMEOUT_MS = 12_000

// Full-scale factor for the RMS → 0..1 level. A child's voice at ~30cm sits around -20dBFS through
// iPad AGC, so raw RMS peaks near 0.1–0.25; ×4 makes normal speech fill the meter.
const LEVEL_GAIN = 4

const stopTracks = (stream: MediaStream) => {
  stream.getTracks().forEach((track) => {
    try {
      track.stop()
    } catch {
      /* ignore */
    }
  })
}

/**
 * Speech capture for the "Sig et Ord" game.
 *
 * **The mic is opened ONCE per visit and held.** `getUserMedia` costs real time (permission prompt on
 * the first call, then still ~100–500ms of device setup), and the old shape paid that inside the
 * child's press: the board said "Jeg lytter…" while no recorder existed yet, so the first syllable —
 * often the whole word — was never captured. Now `prime()` opens the stream and `startRecording()` is
 * SYNCHRONOUS on top of it, so "listening" is true the frame it appears. The caller releases on unmount.
 *
 * This is the *capture* side only — it never plays audio. Playback (read-back, spelling) goes through
 * the centralized controller. The caller must stop playback before recording so TTS doesn't feed into
 * the mic (`echoCancellation` helps, it doesn't substitute).
 */
export const useSpeechInput = () => {
  const isSupported =
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function' &&
    typeof MediaRecorder !== 'undefined'

  const [isRecording, setIsRecording] = useState(false)
  const [isPrimed, setIsPrimed] = useState(false)
  const [permission, setPermission] = useState<MicPermission>('unknown')

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const mimeRef = useRef<string>('')
  const mountedRef = useRef(true)

  // Level metering (the equalizer bars). Optional by design: if an AudioContext can't be created the
  // bars fall back to their canned animation, so this must never break capture.
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  // Typed with the explicit ArrayBuffer arg: `getByteTimeDomainData` rejects the ArrayBufferLike form
  // (it would allow a SharedArrayBuffer view).
  const levelDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null)

  // Cancellation token for an in-flight prime(). getUserMedia (and the OS permission prompt) can stay
  // pending for seconds; if the component unmounts or the child navigates away in that window, we must
  // not end up with a live-but-orphaned mic stream. release()/cancel() bump this; prime() captures it
  // at entry and, if it went stale, stops the granted tracks instead of keeping them.
  const genRef = useRef(0)
  const primePromiseRef = useRef<Promise<boolean> | null>(null)

  const teardownAnalyser = useCallback(() => {
    analyserRef.current = null
    levelDataRef.current = null
    const ctx = audioCtxRef.current
    audioCtxRef.current = null
    if (ctx) {
      try {
        void ctx.close()
      } catch {
        /* ignore */
      }
    }
  }, [])

  const attachAnalyser = useCallback((stream: MediaStream) => {
    try {
      const Ctor: typeof AudioContext | undefined =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return
      const ctx = new Ctor()
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      // Deliberately NOT connected to ctx.destination — an analyser tap only; routing the mic to the
      // speakers would be instant feedback.
      source.connect(analyser)
      audioCtxRef.current = ctx
      analyserRef.current = analyser
      levelDataRef.current = new Uint8Array(new ArrayBuffer(analyser.fftSize))
    } catch {
      teardownAnalyser()
    }
  }, [teardownAnalyser])

  const releaseStream = useCallback(() => {
    teardownAnalyser()
    if (streamRef.current) {
      // Release mic tracks so the iOS mic indicator clears and audio routing isn't held.
      stopTracks(streamRef.current)
      streamRef.current = null
    }
    if (mountedRef.current) setIsPrimed(false)
  }, [teardownAnalyser])

  /**
   * Open the mic (idempotent, and de-duped while in flight). Resolves true when a live stream is held.
   *
   * `silent: true` is for opportunistic warming (mount, or between words): a failure then means "not
   * primed yet", NOT "the mic is broken" — iOS can refuse `getUserMedia` outside a user gesture, and
   * surfacing that as a permission error would show the child a dead-mic screen for a mic that works
   * the moment they press it.
   */
  const prime = useCallback(
    async (options?: { silent?: boolean }): Promise<boolean> => {
      if (!isSupported) {
        if (!options?.silent && mountedRef.current) setPermission('error')
        return false
      }
      if (streamRef.current?.getAudioTracks().some((t) => t.readyState === 'live')) return true
      if (streamRef.current) releaseStream() // stale/ended tracks — reopen
      if (primePromiseRef.current) return primePromiseRef.current

      const myGen = genRef.current
      const pending = (async (): Promise<boolean> => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          })
          // Cancelled while getUserMedia was pending (e.g. the child hit Back while the permission
          // prompt was up). Release the freshly-granted stream immediately.
          if (myGen !== genRef.current || !mountedRef.current) {
            stopTracks(stream)
            return false
          }
          streamRef.current = stream
          attachAnalyser(stream)
          setIsPrimed(true)
          setPermission('granted')
          return true
        } catch (err) {
          const name = (err as { name?: string })?.name
          if (!options?.silent && mountedRef.current) {
            setPermission(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'error')
          }
          return false
        } finally {
          primePromiseRef.current = null
        }
      })()
      primePromiseRef.current = pending
      return pending
    },
    [attachAnalyser, isSupported, releaseStream],
  )

  /**
   * Start recording on the already-open stream. **Synchronous** — that's the whole point: called from
   * the pointerdown handler it captures from the first frame the UI claims to be listening.
   * Returns false if the mic isn't primed (the caller primes, then retries).
   */
  const startRecording = useCallback((): boolean => {
    const stream = streamRef.current
    if (!stream) return false
    if (!stream.getAudioTracks().some((t) => t.readyState === 'live')) {
      // The OS revoked the track (another app took the mic, or the tab was backgrounded long enough).
      releaseStream()
      return false
    }
    try {
      const mimeType =
        MIME_CANDIDATES.find(
          (c) => typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(c),
        ) || ''
      mimeRef.current = mimeType
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (e: BlobEvent) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorderRef.current = recorder
      recorder.start(CHUNK_MS)
      // An AudioContext created outside a gesture starts suspended → a flat meter. This call IS in the
      // gesture, so resume here rather than at creation.
      void audioCtxRef.current?.resume().catch(() => {})
      setIsRecording(true)
      return true
    } catch {
      recorderRef.current = null
      return false
    }
  }, [releaseStream])

  /**
   * Instantaneous input level, 0..1, or **-1 when metering is unavailable** (no AudioContext, or not
   * recording) — the caller then animates the bars on its canned loop instead of pretending to listen.
   * Read from a rAF loop; it never triggers a React render.
   */
  const getLevel = useCallback((): number => {
    const analyser = analyserRef.current
    const data = levelDataRef.current
    if (!analyser || !data || !recorderRef.current) return -1
    analyser.getByteTimeDomainData(data)
    let sum = 0
    for (let i = 0; i < data.length; i++) {
      const v = (data[i] - 128) / 128
      sum += v * v
    }
    const rms = Math.sqrt(sum / data.length)
    return Math.max(0, Math.min(1, rms * LEVEL_GAIN))
  }, [])

  /**
   * Stop the recorder, assemble the clip, and POST it to /api/stt. **Keeps the stream open** so the
   * next word starts instantly. Resolves null if nothing usable was captured or recognition failed /
   * timed out (caller shows the friendly retry).
   */
  const stopAndRecognize = useCallback(async (): Promise<SpeechResult | null> => {
    const recorder = recorderRef.current
    recorderRef.current = null
    if (!recorder) {
      setIsRecording(false)
      return null
    }

    const blob: Blob | null = await new Promise((resolve) => {
      recorder.onstop = () => {
        const type = mimeRef.current || (chunksRef.current[0]?.type ?? 'audio/webm')
        resolve(new Blob(chunksRef.current, { type }))
      }
      try {
        if (recorder.state !== 'inactive') {
          recorder.stop()
        } else {
          resolve(new Blob(chunksRef.current, { type: mimeRef.current || 'audio/webm' }))
        }
      } catch {
        resolve(null)
      }
    })

    setIsRecording(false)

    if (!blob || blob.size < MIN_BLOB_BYTES) {
      return null
    }

    const abort = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined

    // The timeout has to bound the WHOLE round-trip, not just `fetch`. `authorizedFetch` first awaits
    // `authStore.getAccessToken()`, and an abort signal cannot cancel that — so a stalled token mint
    // left the game sitting on "Lad mig tænke…" forever (owner, iPad Air emulation). Racing the whole
    // thing means "I didn't hear that, try again" is always reachable. `SpeakWordGame` carries a second,
    // longer watchdog for the same reason: two independent brakes, because this one is inside the hook
    // that could itself be the thing wedged.
    const recognize = async (): Promise<SpeechResult | null> => {
      const base64 = await blobToBase64(blob)
      const response = await authorizedFetch('/api/stt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioContent: base64, mimeType: blob.type }),
        signal: abort.signal,
      })
      if (!response.ok) return null
      const data = await response.json()
      const transcript = typeof data.transcript === 'string' ? data.transcript : ''
      const confidence = typeof data.confidence === 'number' ? data.confidence : 0
      return { transcript, confidence }
    }

    try {
      return await Promise.race([
        recognize(),
        new Promise<null>((resolve) => {
          timer = setTimeout(() => {
            abort.abort() // stop paying for a request whose answer we've stopped waiting for
            resolve(null)
          }, STT_TIMEOUT_MS)
        }),
      ])
    } catch {
      return null
    } finally {
      if (timer) clearTimeout(timer)
    }
  }, [])

  /** Abort the current recording without sending anything. Keeps the mic open for the next press. */
  const cancel = useCallback(() => {
    genRef.current++
    const recorder = recorderRef.current
    recorderRef.current = null
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.onstop = null
        recorder.stop()
      } catch {
        /* ignore */
      }
    }
    chunksRef.current = []
    if (mountedRef.current) setIsRecording(false)
  }, [])

  /** Give the mic back to the OS (unmount / leaving the game). Retires any in-flight prime(). */
  const release = useCallback(() => {
    cancel()
    releaseStream()
  }, [cancel, releaseStream])

  // The hook owns the teardown: whatever the component forgets, the mic indicator still clears.
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      // Retiring the CURRENT generation is the point (an in-flight prime must self-abort), so reading
      // the live ref here is deliberate — a value copied at effect time would retire the wrong one.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      genRef.current++
      const recorder = recorderRef.current
      recorderRef.current = null
      if (recorder && recorder.state !== 'inactive') {
        try {
          recorder.onstop = null
          recorder.stop()
        } catch {
          /* ignore */
        }
      }
      teardownAnalyser()
      if (streamRef.current) {
        stopTracks(streamRef.current)
        streamRef.current = null
      }
    }
  }, [teardownAnalyser])

  return {
    isSupported,
    isRecording,
    isPrimed,
    permission,
    prime,
    startRecording,
    stopAndRecognize,
    getLevel,
    cancel,
    release,
  }
}

// Convert a Blob to a base64 string (without the data: prefix). FileReader avoids
// call-stack overflow on large buffers.
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result as string
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}
