// A piece in progress survives FOR THE SESSION ONLY (Krea PRD-01 §2.1.3, §4.6). Navigating away and
// back, or an accidental reload, resumes it; ending the session (the app force-closed, the tab or PWA
// killed) loses it. That is `sessionStorage`, and deliberately nothing stronger: the owner's definition
// is "nothing is stored", so the privacy text does not change. Do NOT add localStorage or IndexedDB "for
// safety" — that would be storing children's drawings.
//
// Keyed `bl-krea:<profileId>:<gameId>:<itemId>`, per child, and cleared:
//   - on "Nyt papir" → Ja, and on "next" after done (the game calls `clearItem`)
//   - on a profile DETACH (switch / sign-out) — or a sibling would open the other child's drawing
//   - on `progressStore.resetAll` and a profile deletion
// Same attach/detach lifecycle as `practiceLedger`, driven by `profileStore`, its only caller.
//
// Every read and write is wrapped: a quota error or a private-mode throw degrades to "no resume", never
// to a crash.

const PREFIX = 'bl-krea:'

export const kreaKey = (profileId: string, gameId: string, itemId: string): string =>
  `${PREFIX}${profileId}:${gameId}:${itemId}`

/** The store as the tests and the browser both see it — `sessionStorage` in the app. */
export interface KeyValueStore {
  getItem(k: string): string | null
  setItem(k: string, v: string): void
  removeItem(k: string): void
  key(i: number): string | null
  readonly length: number
}

const browserStore = (): KeyValueStore | null => {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage
  } catch {
    return null
  }
}

class KreaSession {
  private profileId: string | null = null
  private store: () => KeyValueStore | null = browserStore

  /** Tests only: swap the backing store. */
  useStore(s: KeyValueStore | null): void {
    this.store = () => s
  }

  attach(profileId: string): void {
    if (!profileId || profileId === this.profileId) return
    // Switching straight from one child to another (no detach in between) must not leave the first
    // child's drawing where the second would open it.
    if (this.profileId) this.clear(this.profileId)
    this.profileId = profileId
  }

  /** A child stops playing on this device (switch / sign-out): their unfinished drawings go. */
  detach(): void {
    if (this.profileId) this.clear(this.profileId)
    this.profileId = null
  }

  /** The current owner, or null while detached — the games read and write nothing then. */
  owner(): string | null {
    return this.profileId
  }

  load(gameId: string, itemId: string): string | null {
    if (!this.profileId) return null
    try {
      return this.store()?.getItem(kreaKey(this.profileId, gameId, itemId)) ?? null
    } catch {
      return null
    }
  }

  /** Returns false when the write did not land (quota, private mode) — resume is then simply absent. */
  save(gameId: string, itemId: string, value: string): boolean {
    if (!this.profileId) return false
    const key = kreaKey(this.profileId, gameId, itemId)
    try {
      this.store()?.setItem(key, value)
      return true
    } catch {
      // A half-written or stale copy is worse than none: it would resume an older picture.
      try {
        this.store()?.removeItem(key)
      } catch {
        /* ignore */
      }
      return false
    }
  }

  clearItem(gameId: string, itemId: string): void {
    if (!this.profileId) return
    try {
      this.store()?.removeItem(kreaKey(this.profileId, gameId, itemId))
    } catch {
      /* ignore */
    }
  }

  /** Every Krea entry of one child (default: the attached one). */
  clear(profileId?: string | null): void {
    const target = profileId ?? this.profileId
    if (!target) return
    try {
      const s = this.store()
      if (!s) return
      const mine = `${PREFIX}${target}:`
      const doomed: string[] = []
      for (let i = 0; i < s.length; i++) {
        const k = s.key(i)
        if (k && k.startsWith(mine)) doomed.push(k)
      }
      for (const k of doomed) s.removeItem(k)
    } catch {
      /* ignore */
    }
  }
}

export const kreaSession = new KreaSession()
export default kreaSession
