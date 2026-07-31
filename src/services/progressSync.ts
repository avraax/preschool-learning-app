// Progress sync: the network half of local-first (accounts PRD §6.4).
//
// NEVER imported by progressStore — the store must stay playable, testable and Node-importable with no
// network in its graph. The dependency points this way only.
//
// The UI never awaits any of this. Gameplay already runs off local state, so a sync is pure background
// reconciliation; a failure is invisible except in the adult menu's "Synkronisering" line.

import { progressStore } from './progressStore'
import { authStore } from './authStore'
import { normalizePersisted } from '../config/progressSchema'
import { routeKind } from '../components/common/scene/routeKind'

export type SyncReason =
  | 'attach'
  | 'commit-debounce'
  | 'ceremony'
  | 'pagehide'
  | 'reconnect'
  | 'poll'
  | 'manual'

export interface SyncStatus {
  phase: 'idle' | 'pulling' | 'pushing' | 'offline' | 'error'
  dirty: boolean
  pendingRev: number
  lastPushAt: number
  lastPullAt: number
  conflicts: number
  error: string | null
}

/** Much longer than the 250ms localStorage debounce — this batches a whole ROUND into one request. */
const COMMIT_DEBOUNCE_MS = 8000
const POLL_INTERVAL_MS = 5 * 60 * 1000
const MAX_CONFLICT_RETRIES = 3
/** Above this, a keepalive request is at risk; we skip the unload push and re-push on next attach. */
const UNLOAD_PAYLOAD_LIMIT = 50_000

type Listener = () => void

class ProgressSync {
  private status: SyncStatus = {
    phase: 'idle',
    dirty: false,
    pendingRev: 0,
    lastPushAt: 0,
    lastPullAt: 0,
    conflicts: 0,
    error: null,
  }
  private listeners = new Set<Listener>()
  private started = false
  private commitTimer: ReturnType<typeof setTimeout> | null = null
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private inFlight: Promise<void> | null = null
  private offCommit: (() => void) | null = null

  getStatus(): SyncStatus {
    return this.status
  }

  subscribe(cb: Listener): () => void {
    this.listeners.add(cb)
    return () => {
      this.listeners.delete(cb)
    }
  }

  start(): void {
    if (this.started || typeof window === 'undefined') return
    this.started = true

    this.offCommit = progressStore.onCommit(() => {
      this.publish({ dirty: this.isDirty(), pendingRev: progressStore.syncMeta()?.rev ?? 0 })
      if (this.commitTimer) clearTimeout(this.commitTimer)
      this.commitTimer = setTimeout(() => {
        this.commitTimer = null
        void this.push('commit-debounce')
      }, COMMIT_DEBOUNCE_MS)
    })

    window.addEventListener('online', () => void this.syncNow('reconnect'))
    // pagehide covers the iOS PWA swipe-away, where no later event may fire at all.
    window.addEventListener('pagehide', () => this.flushBeacon())
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.flushBeacon()
      // Timers are throttled in a backgrounded PWA, so returning to the app is the reliable trigger —
      // not the interval below (§4.7).
      else void this.pull('poll')
    })

    this.pollTimer = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      // NEVER pull mid-game: a merge landing during a round is safe (the join is lock-free) but the
      // network work and the possible re-render are not worth it while a child is playing.
      if (routeKind(window.location.pathname) === 'game') return
      void this.pull('poll')
    }, POLL_INTERVAL_MS)
  }

  stop(): void {
    if (this.commitTimer) clearTimeout(this.commitTimer)
    if (this.pollTimer) clearInterval(this.pollTimer)
    this.offCommit?.()
    this.commitTimer = null
    this.pollTimer = null
    this.offCommit = null
    this.started = false
  }

  /** Called by profileStore right after attach: pull first, then push anything the pull didn't cover. */
  async syncNow(reason: SyncReason): Promise<void> {
    await this.pull(reason)
    if (this.isDirty()) await this.push(reason)
  }

  private isDirty(): boolean {
    const meta = progressStore.syncMeta()
    return !!meta && meta.rev > meta.syncedRev
  }

  private profileId(): string | null {
    return progressStore.activeProfileId()
  }

  private canSync(): boolean {
    return (
      !!authStore.sessionToken() &&
      progressStore.isAttached() &&
      !!this.profileId() &&
      !authStore.isDevBypass()
    )
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${authStore.sessionToken()}`,
      'Content-Type': 'application/json',
    }
  }

  async pull(reason: SyncReason): Promise<void> {
    if (!this.canSync()) return
    // Serialise: two concurrent pulls would race each other's applyRemote for no benefit.
    if (this.inFlight) return this.inFlight
    const profileId = this.profileId() as string
    this.inFlight = (async () => {
      this.publish({ phase: 'pulling', error: null })
      try {
        const res = await fetch(`/api/progress?profileId=${encodeURIComponent(profileId)}`, {
          headers: this.headers(),
        })
        if (res.status === 404) {
          // Never synced: our local state IS the first version. Mark dirty so the push happens.
          this.publish({ phase: 'idle', lastPullAt: Date.now(), dirty: this.isDirty() })
          return
        }
        if (!res.ok) {
          this.publish({ phase: 'error', error: `Kunne ikke hente (${res.status})` })
          return
        }
        const body = (await res.json()) as { rev?: number; blob?: unknown }
        const remote = normalizePersisted(body.blob)
        if (!remote) {
          this.publish({ phase: 'error', error: 'Serverens data kunne ikke læses' })
          return
        }
        // Applied against the LIVE state at this instant — safe mid-round and mid-ceremony because the
        // merge is a proper join.
        progressStore.applyRemote(remote)
        progressStore.markSynced(Number(body.rev) || 0, progressStore.syncMeta()?.syncedRev ?? 0)
        this.publish({
          phase: 'idle',
          lastPullAt: Date.now(),
          dirty: this.isDirty(),
          error: null,
        })
      } catch {
        // A network failure is NOT an error state the adult needs to act on — it's just offline.
        this.publish({ phase: 'offline' })
      } finally {
        this.inFlight = null
      }
      void reason
    })()
    return this.inFlight
  }

  async push(reason: SyncReason, attempt = 0): Promise<void> {
    if (!this.canSync()) return
    const doc = progressStore.exportPersisted()
    const meta = progressStore.syncMeta()
    if (!doc || !meta) return
    const profileId = this.profileId() as string

    this.publish({ phase: 'pushing', error: null })
    try {
      const res = await fetch('/api/progress', {
        method: 'PUT',
        headers: this.headers(),
        body: JSON.stringify({ profileId, baseRev: meta.serverRev, blob: doc }),
      })

      if (res.status === 409) {
        const body = (await res.json()) as { rev?: number; blob?: unknown }
        const theirs = normalizePersisted(body.blob)
        this.publish({ conflicts: this.status.conflicts + 1 })
        if (theirs) {
          progressStore.applyRemote(theirs)
          progressStore.markSynced(Number(body.rev) || 0, progressStore.syncMeta()?.syncedRev ?? 0)
        }
        // Bounded, then back off to the next trigger. Because the merge is a proper join the retry
        // PROVABLY converges — this cap is a runaway guard, not a correctness crutch.
        if (attempt + 1 < MAX_CONFLICT_RETRIES) return this.push(reason, attempt + 1)
        this.publish({ phase: 'idle', dirty: this.isDirty() })
        return
      }

      if (res.status === 422) {
        // Our own document failed the shared invariants. Nothing to retry — surface it so a bug report
        // carries it, rather than looping.
        this.publish({ phase: 'error', error: 'Fremgangen kunne ikke gemmes (ugyldige data)' })
        return
      }

      if (!res.ok) {
        this.publish({ phase: 'error', error: `Kunne ikke gemme (${res.status})` })
        return
      }

      const body = (await res.json()) as { rev?: number }
      // ACK exactly the rev we sent — NOT the current one. A commit that landed while the request was
      // in flight must stay dirty.
      progressStore.markSynced(Number(body.rev) || 0, meta.rev)
      this.publish({
        phase: 'idle',
        lastPushAt: Date.now(),
        dirty: this.isDirty(),
        error: null,
      })
    } catch {
      this.publish({ phase: 'offline' })
    }
  }

  /**
   * Last-gasp push as the page goes away.
   *
   * CORRECTION TO THE PRD: it specifies `navigator.sendBeacon`, but a beacon CANNOT set headers — so it
   * cannot carry the `Authorization: Bearer …` this endpoint requires, and would simply 401. A
   * `keepalive` fetch is the only unload-safe transport that can authenticate. Its ~64 KB budget is the
   * same constraint the PRD flagged for beacons, so oversized payloads are skipped and re-pushed on the
   * next attach.
   *
   * Either way the rule holds: an unload push must NOT advance `syncedRev`, because we can't reliably
   * read the response. Staying dirty and re-pushing is the safe direction.
   */
  flushBeacon(): void {
    if (!this.canSync()) return
    if (!this.isDirty()) return
    const doc = progressStore.exportPersisted()
    const meta = progressStore.syncMeta()
    const profileId = this.profileId()
    if (!doc || !meta || !profileId) return

    const payload = JSON.stringify({ profileId, baseRev: meta.serverRev, blob: doc })
    if (payload.length > UNLOAD_PAYLOAD_LIMIT) return

    try {
      void fetch('/api/progress', {
        method: 'PUT',
        headers: this.headers(),
        body: payload,
        keepalive: true,
      })
    } catch {
      /* the next attach re-pushes */
    }
  }

  private publish(patch: Partial<SyncStatus>): void {
    this.status = { ...this.status, ...patch }
    this.listeners.forEach((l) => l())
  }
}

export const progressSync = new ProgressSync()

if (import.meta.env?.DEV && typeof window !== 'undefined') {
  ;(window as unknown as { __sync?: ProgressSync }).__sync = progressSync
}
