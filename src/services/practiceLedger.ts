// What the child gets wrong, so a missed item comes back sooner (Practice Loop PRD-01 W2).
//
// `PerGameStats` is aggregates only (bestStreak / bestStars / bestCount / roundsCompleted /
// lifetimeCorrect), so the letters he already owns came back at exactly the same rate as the ones he
// misses, forever. This is the per-item counterpart, and it feeds ONE thing: the ORDER of W1's prompt
// bag. **It is not adaptive difficulty** — see the header of `src/config/practiceWeights.ts`, which
// carries that argument and the source guard that makes it mechanical.
//
// ## Why this is NOT in the synced v4 document (PRD D2)
//
// Device-local, per child, its own key. A per-item map would have to acquire merge semantics, and the
// merge is the one chain in this app protected hardest (`grantedSlots <= collectedFromLevel(globalLevel())`,
// the convexity clamp, the G-Counter). A scheduling HINT does not deserve that risk: losing it costs one
// session of ordering, not a sticker.
//
// The door out, recorded because someone will want it: **if it ever syncs, it is per-key LWW
// (`max(misses)`, `max(lastSeenAt)`) under its own `version` field, never a G-Counter** — summing misses
// across devices would over-drill an item the child has since learned.
//
// Consequences accepted explicitly: a second iPad starts with an empty ledger, and a future
// parent-facing "hvad driller" row would read only the device in hand.
// Node-importable (progressStore's tests pull this in through the reset path), so relative imports need
// an explicit `.ts` extension — Node's ESM resolver rejects extensionless ones even though Vite/tsc
// accept them, and the failure is a whole test FILE that stops loading.
import { practiceKeyFor } from '../config/practiceSchema.ts'
import { hasPromptPool } from '../config/promptPools.ts'

export interface PracticeEntry {
  misses: number
  seen: number
  lastSeenAt: number
}

/** Entry cap — evicted by oldest `lastSeenAt`. See `practiceSchema.ts` for why this number. */
export const MAX_ENTRIES = 300

type MissListener = (gameId: string, itemKey: string, misses: number) => void

const nowMs = (): number => Date.now()

const entryKey = (gameId: string, itemKey: string): string => `${gameId}:${itemKey}`

class PracticeLedger {
  private entries = new Map<string, PracticeEntry>()
  private key: string | null = null
  private profileId: string | null = null
  private missListeners = new Set<MissListener>()
  private saveTimer: ReturnType<typeof setTimeout> | null = null

  // ----- lifecycle ---------------------------------------------------------------------------------

  /**
   * Point the ledger at a child. Like `progressStore`, it is INERT until this runs and attaching is a
   * pure read, so a hydration bug can't destroy anything. Idempotent (StrictMode double-invokes).
   */
  attach(profileId: string): void {
    if (!profileId || profileId === this.profileId) return
    this.flush()
    this.profileId = profileId
    this.key = practiceKeyFor(profileId)
    this.entries = new Map()
    try {
      const raw = localStorage.getItem(this.key)
      if (raw) {
        const parsed = JSON.parse(raw) as unknown
        if (parsed && typeof parsed === 'object') {
          for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
            const e = v as Partial<PracticeEntry>
            if (typeof e?.misses !== 'number' || typeof e?.seen !== 'number') continue
            this.entries.set(k, {
              misses: Math.max(0, Math.floor(e.misses)),
              seen: Math.max(0, Math.floor(e.seen)),
              lastSeenAt: typeof e.lastSeenAt === 'number' ? e.lastSeenAt : 0,
            })
          }
        }
      }
    } catch {
      /* malformed / private mode → start empty. A lost hint costs one session of ordering. */
    }
  }

  detach(): void {
    this.flush()
    this.key = null
    this.profileId = null
    this.entries = new Map()
  }

  isAttached(): boolean {
    return this.key !== null
  }

  /** Wipe this child's ledger. Called by `progressStore.resetAll()` and `profileStore.deleteProfile()`. */
  clear(profileId?: string | null): void {
    const target = profileId ?? this.profileId
    if (!target) return
    if (target === this.profileId) this.entries = new Map()
    if (this.saveTimer) {
      clearTimeout(this.saveTimer)
      this.saveTimer = null
    }
    try {
      localStorage.removeItem(practiceKeyFor(target))
    } catch {
      /* ignore */
    }
  }

  // ----- writes ------------------------------------------------------------------------------------

  /**
   * Record one answered question at the point that ALREADY knows first-try, so there is no new
   * bookkeeping anywhere: a wrong tap is a miss on the CURRENT item (never the tapped one), a correct
   * tap is a `seen`.
   *
   * Gated on `hasPromptPool(gameId)`: the ledger's only consumer is a prompt bag, so recording items no
   * bag can reorder (the math generators are a parameter space, not a content list) would just push the
   * useful entries out through the cap.
   */
  recordAttempt(gameId: string, itemKey: string, firstTry: boolean): void {
    if (!this.key || !itemKey || !hasPromptPool(gameId)) return
    const id = entryKey(gameId, itemKey)
    const prev = this.entries.get(id) ?? { misses: 0, seen: 0, lastSeenAt: 0 }
    const next: PracticeEntry = {
      misses: prev.misses + (firstTry ? 0 : 1),
      seen: prev.seen + (firstTry ? 1 : 0),
      lastSeenAt: nowMs(),
    }
    this.entries.set(id, next)
    this.evict()
    this.scheduleSave()
    if (!firstTry) this.missListeners.forEach((l) => l(gameId, itemKey, next.misses))
  }

  // ----- reads -------------------------------------------------------------------------------------

  missesFor(gameId: string, itemKey: string): number {
    return this.entries.get(entryKey(gameId, itemKey))?.misses ?? 0
  }

  entryFor(gameId: string, itemKey: string): PracticeEntry | null {
    return this.entries.get(entryKey(gameId, itemKey)) ?? null
  }

  size(): number {
    return this.entries.size
  }

  /**
   * A miss subscription is how the bag learns to re-ask WITHOUT any game plumbing a callback: the write
   * point (the engine's resolve) knows the item and first-try; the bag knows the pass. Returns an
   * unsubscribe.
   */
  onMiss(listener: MissListener): () => void {
    this.missListeners.add(listener)
    return () => this.missListeners.delete(listener)
  }

  // ----- persistence -------------------------------------------------------------------------------

  private evict(): void {
    if (this.entries.size <= MAX_ENTRIES) return
    const byAge = [...this.entries.entries()].sort((a, b) => a[1].lastSeenAt - b[1].lastSeenAt)
    for (let i = 0; i < byAge.length - MAX_ENTRIES; i++) this.entries.delete(byAge[i][0])
  }

  private scheduleSave(): void {
    if (this.saveTimer) return
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null
      this.flush()
    }, 400)
  }

  flush(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer)
      this.saveTimer = null
    }
    if (!this.key) return
    try {
      // An empty ledger REMOVES its key rather than writing `{}` — a child with nothing recorded should
      // leave nothing behind, and it keeps "has this child got a ledger?" answerable from storage alone.
      if (this.entries.size === 0) localStorage.removeItem(this.key)
      else localStorage.setItem(this.key, JSON.stringify(Object.fromEntries(this.entries)))
    } catch {
      /* quota / private mode → the hint is expendable by design */
    }
  }
}

export const practiceLedger = new PracticeLedger()
export default practiceLedger
