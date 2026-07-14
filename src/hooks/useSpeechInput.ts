import { useRef, useState, useCallback } from 'react'

export interface SpeechResult {
  transcript: string
  confidence: number
}

// Candidate MIME types in preference order. Chrome → webm/opus, Safari → mp4/aac.
// The server uses autoDecodingConfig, so it accepts either container.
const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/aac']

// Minimum blob size to bother sending (filters accidental taps that produced no audio).
const MIN_BLOB_BYTES = 1200

/**
 * Speech capture for the "Sig et Ord" game. Hold-to-talk: call start() on pointerdown
 * (the user gesture iOS requires for getUserMedia), then stopAndRecognize() on pointerup.
 *
 * This is the capture side only — it never plays audio. Playback (read-back, spelling)
 * goes through the centralized AudioController via useAudio. The caller must stop any
 * AudioController playback before start() so TTS does not feed into the mic.
 */
export const useSpeechInput = () => {
  const isSupported =
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function' &&
    typeof MediaRecorder !== 'undefined'

  const [isRecording, setIsRecording] = useState(false)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const mimeRef = useRef<string>('')

  // Cancellation token for an in-flight start(). getUserMedia (and the OS permission prompt) can
  // stay pending for seconds; if the component unmounts or the user cancels in that window, we must
  // not end up with a live-but-orphaned mic stream. stop/cancel bump this counter; start() captures
  // the value at entry and, after each await, bails + releases the stream if it went stale. Without
  // this the mic could record indefinitely (OS mic indicator stuck on) after leaving the game.
  const genRef = useRef(0)

  const releaseStream = useCallback(() => {
    if (streamRef.current) {
      // Release mic tracks so the iOS mic indicator clears and audio routing isn't held.
      streamRef.current.getTracks().forEach(track => {
        try {
          track.stop()
        } catch {
          /* ignore */
        }
      })
      streamRef.current = null
    }
  }, [])

  /**
   * Begin capture. Must be called synchronously inside a pointerdown handler on iOS.
   * Throws if getUserMedia rejects (e.g. permission denied or unsupported context) —
   * the caller should surface a friendly fallback message.
   */
  const start = useCallback(async (): Promise<void> => {
    if (!isSupported) {
      throw new Error('Speech input not supported in this context')
    }

    const myGen = genRef.current
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

    // Cancelled while getUserMedia was pending (e.g. child hit Back while the permission prompt was
    // up). Release the freshly-granted stream immediately and never start the recorder.
    if (myGen !== genRef.current) {
      stream.getTracks().forEach(track => {
        try { track.stop() } catch { /* ignore */ }
      })
      return
    }
    streamRef.current = stream

    const mimeType = MIME_CANDIDATES.find(
      c => typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(c)
    ) || ''
    mimeRef.current = mimeType

    const recorder = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream)

    // Re-check after the synchronous recorder setup — cancel() may have fired between the awaits.
    if (myGen !== genRef.current) {
      releaseStream()
      return
    }

    recorderRef.current = recorder
    chunksRef.current = []

    recorder.ondataavailable = (e: BlobEvent) => {
      if (e.data && e.data.size > 0) {
        chunksRef.current.push(e.data)
      }
    }

    recorder.start()
    setIsRecording(true)
  }, [isSupported, releaseStream])

  /**
   * Stop capture, assemble the clip, and POST it to /api/stt.
   * Resolves with the recognition result, or null if nothing usable was captured
   * or recognition failed (caller shows a friendly retry).
   */
  const stopAndRecognize = useCallback(async (): Promise<SpeechResult | null> => {
    // Retire any in-flight start() so a not-yet-resolved getUserMedia self-aborts instead of
    // starting an orphaned recorder after we've decided to stop.
    genRef.current++
    const recorder = recorderRef.current
    if (!recorder) {
      releaseStream()
      setIsRecording(false)
      return null
    }

    const blob: Blob | null = await new Promise(resolve => {
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

    releaseStream()
    recorderRef.current = null
    setIsRecording(false)

    if (!blob || blob.size < MIN_BLOB_BYTES) {
      return null
    }

    try {
      const base64 = await blobToBase64(blob)
      const response = await fetch('/api/stt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioContent: base64, mimeType: blob.type })
      })

      if (!response.ok) {
        return null
      }

      const data = await response.json()
      const transcript = typeof data.transcript === 'string' ? data.transcript : ''
      const confidence = typeof data.confidence === 'number' ? data.confidence : 0
      return { transcript, confidence }
    } catch {
      return null
    }
  }, [releaseStream])

  /** Abort capture without sending anything (e.g. on unmount or navigation). */
  const cancel = useCallback(() => {
    // Retire any in-flight start() first: if getUserMedia is still pending, the stale-generation
    // guard in start() will stop the granted tracks the moment it resolves, so the mic never lingers.
    genRef.current++
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.onstop = null
        recorder.stop()
      } catch {
        /* ignore */
      }
    }
    recorderRef.current = null
    chunksRef.current = []
    releaseStream()
    setIsRecording(false)
  }, [releaseStream])

  return { isSupported, isRecording, start, stopAndRecognize, cancel }
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
