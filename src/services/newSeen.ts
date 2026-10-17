// Which "new in this release" games THIS child has already opened (owner, 2026-10-17: the stars go
// once a game has been tried — "once", not "twice", so a child can understand it: it sparkles until
// I have tried it).
//
// Device-local, per child, its own key — the `practiceLedger` precedent, for the same reason: a
// "you've seen this" hint does not deserve a place in the synced v4 document and its merge algebra.
// Losing it costs one re-shown sparkle, never a sticker. A second iPad shows the stars again; accepted.
//
// It is NOT read from progress, because Fri Tegning earns no XP by design (Krea PRD-01), so "has XP for
// this game" would keep its stars forever. "Opened" = tapped from a menu (`GameSelectionLayout`).
//
// Same attach/detach/clear lifecycle as `practiceLedger` and `kreaSession`, driven by `profileStore`
// (and cleared by `progressStore.resetAll` / child deletion). INERT until attached: reads say "not
// opened" (stars show) and writes are dropped.
//
// Node-importable, so relative imports carry `.ts`.

export const NEW_SEEN_KEY_PREFIX = 'bornelaering-new-seen:'
export const newSeenKeyFor = (profileId: string): string => `${NEW_SEEN_KEY_PREFIX}${profileId}`

const storage = (): Storage | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

class NewSeen {
  private profileId: string | null = null
  private ids = new Set<string>()

  attach(profileId: string): void {
    if (!profileId || profileId === this.profileId) return
    this.profileId = profileId
    this.ids = new Set()
    try {
      const raw = storage()?.getItem(newSeenKeyFor(profileId))
      const parsed = raw ? (JSON.parse(raw) as unknown) : null
      if (Array.isArray(parsed)) for (const id of parsed) if (typeof id === 'string') this.ids.add(id)
    } catch {
      /* malformed / private mode → nothing opened yet; the stars simply show */
    }
  }

  detach(): void {
    this.profileId = null
    this.ids = new Set()
  }

  /** Wipe a child's record (reset, deletion). The stars come back for that child. */
  clear(profileId?: string | null): void {
    const target = profileId ?? this.profileId
    if (!target) return
    if (target === this.profileId) this.ids = new Set()
    try {
      storage()?.removeItem(newSeenKeyFor(target))
    } catch {
      /* ignore */
    }
  }

  /** The child opened this game. No-op when no child is attached. */
  markOpened(gameId: string): void {
    if (!this.profileId || this.ids.has(gameId)) return
    this.ids.add(gameId)
    try {
      storage()?.setItem(newSeenKeyFor(this.profileId), JSON.stringify([...this.ids]))
    } catch {
      /* private mode → the stars just come back next launch */
    }
  }

  /** Every game this child has opened. */
  opened(): ReadonlySet<string> {
    return this.ids
  }
}

export const newSeen = new NewSeen()
