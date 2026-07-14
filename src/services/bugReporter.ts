// Bug report assembly + delivery (Bug Report feature).
//
// buildReportPayload() snapshots everything a debugging session needs — app/build info,
// device, audio health, progress state, and the diagnosticsBuffer rings — into one JSON
// document. submitBugReport() POSTs it (+ optional screenshot) to /api/bug-report, which
// stores it durably in Vercel Blob and returns a short human-friendly id ("R7K3F").
// Crashes funnel through reportCrash/reportCrashEvent: slim payload, per-session
// signature dedupe, hard cap — a crash loop can never storm the endpoint.

import { BUILD_INFO } from '../config/version'
import { getDeviceSnapshot } from '../utils/deviceDetection'
import { simplifiedAudioController } from '../utils/SimplifiedAudioController'
import { ttsClient } from './ttsClient'
import { musicClient } from './musicClient'
import { progressStore, type ProgressState } from './progressStore'
import {
  getDiagnosticsSnapshot,
  getSessionId,
  type CrashEvent,
  type DiagnosticsSnapshot,
} from './diagnosticsBuffer'
import type { VoiceOverride } from '../config/voiceOverride'

export type BugCategory = 'lyd' | 'udseende' | 'spil' | 'andet' | 'crash'

export interface BugReportError {
  message: string
  stack?: string
  componentStack?: string
  signature: string
}

export interface BugReportPayload {
  schema: 1
  type: 'manual' | 'crash'
  createdAt: string
  sessionId: string
  category: BugCategory
  note: string
  error?: BugReportError
  app: {
    version: string
    commitHash: string
    buildTime: number
    route: string
    themeId: string
    online: boolean
    language: string
    timezone: string
    viewport: { w: number; h: number; dpr: number }
  }
  device: ReturnType<typeof getDeviceSnapshot> | null
  audio: {
    controller: ReturnType<typeof simplifiedAudioController.getTTSStatus> | null
    permission: ReturnType<typeof simplifiedAudioController.getPermissionSnapshot> | null
    ttsHealth: ReturnType<typeof ttsClient.getHealth> | null
    voiceOverride: VoiceOverride | null
    sfxEnabled: boolean | null
    music: ReturnType<typeof musicClient.getHealth> | null
  }
  progress: ProgressState | null
  diagnostics: DiagnosticsSnapshot
}

export interface SubmitResult {
  id: string
  screenshotUrl: string | null
}

/** Every subsystem read is fenced — a broken subsystem must not break reporting it. */
function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn()
  } catch {
    return fallback
  }
}

export function buildReportPayload(input: {
  type: 'manual' | 'crash'
  category: BugCategory
  note: string
  error?: BugReportError
}): BugReportPayload {
  return {
    schema: 1,
    type: input.type,
    createdAt: new Date().toISOString(),
    sessionId: getSessionId(),
    category: input.category,
    note: input.note,
    error: input.error,
    app: {
      version: BUILD_INFO.version,
      commitHash: BUILD_INFO.commitHash,
      buildTime: BUILD_INFO.buildTime,
      route: safe(() => window.location.pathname + window.location.search, 'unknown'),
      themeId: safe(() => localStorage.getItem('bornelaering-theme') ?? '(default)', 'unknown'),
      online: safe(() => navigator.onLine, true),
      language: safe(() => navigator.language, 'unknown'),
      timezone: safe(() => Intl.DateTimeFormat().resolvedOptions().timeZone, 'unknown'),
      viewport: safe(
        () => ({ w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio }),
        { w: 0, h: 0, dpr: 1 },
      ),
    },
    device: safe(() => getDeviceSnapshot(), null),
    audio: {
      controller: safe(() => simplifiedAudioController.getTTSStatus(), null),
      permission: safe(() => simplifiedAudioController.getPermissionSnapshot(), null),
      ttsHealth: safe(() => ttsClient.getHealth(), null),
      voiceOverride: safe(() => ttsClient.getVoiceOverride(), null),
      sfxEnabled: safe(() => progressStore.get().settings.sfxEnabled, null),
      music: safe(() => musicClient.getHealth(), null),
    },
    progress: safe(() => progressStore.get(), null),
    diagnostics: safe(() => getDiagnosticsSnapshot(), {
      sessionId: 'unknown',
      startedAt: 0,
      capturedAt: Date.now(),
      console: [],
      network: [],
      breadcrumbs: [],
    }),
  }
}

// Stay under Vercel's ~4.5MB request-body limit (dev server: 5MB) with headroom.
const MAX_BODY_CHARS = 3_800_000

export async function submitBugReport(
  payload: BugReportPayload,
  screenshotDataUrl: string | null,
): Promise<SubmitResult> {
  let body: { report: BugReportPayload; screenshot?: string } = {
    report: payload,
    ...(screenshotDataUrl ? { screenshot: screenshotDataUrl } : {}),
  }
  // Degrade gracefully instead of getting a 413: drop the screenshot, then trim the console ring.
  if (JSON.stringify(body).length > MAX_BODY_CHARS) body = { report: payload }
  if (JSON.stringify(body).length > MAX_BODY_CHARS) {
    body = {
      report: {
        ...payload,
        diagnostics: { ...payload.diagnostics, console: payload.diagnostics.console.slice(-100) },
      },
    }
  }

  const res = await fetch('/api/bug-report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Bug report API ${res.status}`)
  const data = (await res.json()) as { id?: string; screenshotUrl?: string | null }
  if (!data.id) throw new Error('Bug report API returned no id')
  return { id: data.id, screenshotUrl: data.screenshotUrl ?? null }
}

/** Offline/failed-upload fallback: save the identical report as a local .json file. */
export function downloadReportAsFile(
  payload: BugReportPayload,
  screenshotDataUrl: string | null,
): void {
  try {
    const blob = new Blob(
      [JSON.stringify({ ...payload, screenshotDataUrl: screenshotDataUrl ?? undefined }, null, 2)],
      { type: 'application/json' },
    )
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `fejlrapport-${payload.createdAt.replace(/[:.]/g, '-')}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  } catch {
    /* nothing sensible left to do */
  }
}

// ===== automatic crash reporting =====

const CRASH_CAP_PER_SESSION = 3
const CRASH_SIG_KEY = 'bl-crash-signatures'

function crashSignature(message: string, stack?: string): string {
  return `${message}::${(stack ?? '').split('\n').slice(0, 2).join('|')}`.slice(0, 300)
}

async function uploadCrash(message: string, stack?: string, componentStack?: string): Promise<void> {
  const signature = crashSignature(message, stack)
  // Dedupe + cap per session. If sessionStorage is unavailable we cannot bound a crash
  // loop, so we skip auto-reporting entirely rather than risk a storm.
  try {
    const sent: string[] = JSON.parse(sessionStorage.getItem(CRASH_SIG_KEY) ?? '[]')
    if (sent.includes(signature) || sent.length >= CRASH_CAP_PER_SESSION) return
    sent.push(signature)
    sessionStorage.setItem(CRASH_SIG_KEY, JSON.stringify(sent))
  } catch {
    return
  }

  try {
    const payload = buildReportPayload({
      type: 'crash',
      category: 'crash',
      note: '',
      error: { message, stack, componentStack, signature },
    })
    // Slim: crashes carry no screenshot and a trimmed console ring.
    payload.diagnostics.console = payload.diagnostics.console.slice(-120)
    await submitBugReport(payload, null)
  } catch {
    /* never let crash reporting throw (or recurse via the rejection handler) */
  }
}

/** Entry for the React error boundary. */
export async function reportCrash(error: Error, componentStack?: string): Promise<void> {
  await uploadCrash(error.message, error.stack, componentStack)
}

/** Entry for diagnosticsBuffer's window error/unhandledrejection hooks. */
export function reportCrashEvent(ev: CrashEvent): void {
  void uploadCrash(ev.message, ev.stack)
}
