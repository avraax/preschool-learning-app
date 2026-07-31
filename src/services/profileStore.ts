// The account/profile singleton — and the ONLY caller of progressStore.attach()/detach().
//
// Keeping that exclusive is what makes the store's "inert by default" discipline meaningful: there is
// exactly one place that decides which child the app is playing as (accounts PRD §5.9).
//
// OFFLINE-CAPABLE: the roster is cached in localStorage alongside the session, so a cold boot with no
// network still knows who the children are and can attach the right book immediately. The server is
// only consulted to refresh.

import { ACTIVE_PROFILE_KEY } from '../config/progressSchema'
import { authStore } from './authStore'
import { progressStore } from './progressStore'

/**
 * The implicit profile used before any real child exists (and by the W4–W8 window, before profiles
 * shipped). W9 adopts its blob into the first real child, using the same merge path legacy adoption
 * uses — so nobody who played during that window loses anything.
 */
export const TRANSITIONAL_PROFILE_ID = 'local'

export interface ChildProfile {
  id: string
  name?: string
  avatarEmoji: string
  createdAt?: number
}

export type AccountStatus = 'signed-out' | 'choosing' | 'ready'

export interface AccountState {
  status: AccountStatus
  accountId: string | null
  profiles: ChildProfile[]
  activeProfileId: string | null
  /** True while the roster is being fetched for the first time. */
  loading: boolean
  error: string | null
}

type Listener = () => void

const ROSTER_KEY = 'bornelaering-profiles'

const readPointer = (): string | null => {
  try {
    return localStorage.getItem(ACTIVE_PROFILE_KEY)
  } catch {
    return null
  }
}

const writePointer = (id: string | null): void => {
  try {
    if (id) localStorage.setItem(ACTIVE_PROFILE_KEY, id)
    else localStorage.removeItem(ACTIVE_PROFILE_KEY)
  } catch {
    /* private mode — the pointer then lasts only this page load */
  }
}

const readRoster = (): ChildProfile[] => {
  try {
    const raw = localStorage.getItem(ROSTER_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (p): p is ChildProfile =>
        !!p && typeof (p as ChildProfile).id === 'string' && typeof (p as ChildProfile).avatarEmoji === 'string',
    )
  } catch {
    return []
  }
}

const writeRoster = (profiles: ChildProfile[]): void => {
  try {
    localStorage.setItem(ROSTER_KEY, JSON.stringify(profiles))
  } catch {
    /* ignore */
  }
}

const authHeaders = (): Record<string, string> => {
  const token = authStore.sessionToken()
  return token
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' }
}

class ProfileStore {
  private state: AccountState = {
    status: 'signed-out',
    accountId: null,
    profiles: [],
    activeProfileId: null,
    loading: false,
    error: null,
  }
  private listeners = new Set<Listener>()
  private hydratedFor: string | null = null

  get(): AccountState {
    return this.state
  }

  subscribe(l: Listener): () => void {
    this.listeners.add(l)
    return () => {
      this.listeners.delete(l)
    }
  }

  activeProfile(): ChildProfile | null {
    const id = this.state.activeProfileId
    return this.state.profiles.find((p) => p.id === id) ?? null
  }

  /**
   * Called once the auth gate opens. Attaches SYNCHRONOUSLY from the cached roster + pointer, then
   * refreshes from the server in the background — the same no-boot-spinner discipline as everything
   * else in this build.
   */
  hydrate(accountId: string | null): void {
    const key = accountId ?? 'anon'
    const already = this.hydratedFor === key
    this.hydratedFor = key

    const cached = readRoster()
    const pointer = readPointer()

    if (!already) {
      // Attach immediately so the very first render sees the child's real data (no level-1 flash).
      const target =
        (pointer && cached.some((p) => p.id === pointer) ? pointer : null) ??
        (cached.length === 1 ? cached[0].id : null) ??
        // No roster yet (first run, or the W4–W8 window): the transitional profile keeps the app
        // playable, and W9's adoption moves it into the first real child.
        (cached.length === 0 ? (pointer ?? TRANSITIONAL_PROFILE_ID) : null)

      if (target) this.selectProfile(target, accountId)
      else {
        // More than one child and no valid pointer ⇒ the picker decides. Nothing is attached yet, so
        // nothing can be written to the wrong book in the meantime.
        this.publish({
          status: 'choosing',
          accountId,
          profiles: cached,
          activeProfileId: null,
        })
      }
    }

    void this.refreshRoster(accountId)
  }

  /** Pull the roster. Never throws — offline just keeps the cached list. */
  async refreshRoster(accountId: string | null = this.state.accountId): Promise<ChildProfile[]> {
    if (!authStore.sessionToken()) return this.state.profiles
    this.publish({ loading: true })
    try {
      const res = await fetch('/api/profiles', { headers: authHeaders() })
      if (!res.ok) {
        this.publish({ loading: false })
        return this.state.profiles
      }
      const { profiles } = (await res.json()) as { profiles?: ChildProfile[] }
      const list = Array.isArray(profiles) ? profiles : []
      writeRoster(list)
      this.publish({ profiles: list, accountId, loading: false, error: null })

      // If the pointer names a profile that no longer exists (deleted on another device), stop playing
      // as it rather than writing to a dead book.
      const active = this.state.activeProfileId
      if (active && active !== TRANSITIONAL_PROFILE_ID && !list.some((p) => p.id === active)) {
        this.clearSelection()
      } else if (!active && list.length === 1) {
        this.selectProfile(list[0].id, accountId)
      } else if (!active && list.length > 1) {
        this.publish({ status: 'choosing' })
      }
      return list
    } catch {
      this.publish({ loading: false })
      return this.state.profiles
    }
  }

  /**
   * `progressStore.attach()` runs SYNCHRONOUSLY in the same tick as this state update, so the very
   * first render already sees the child's real data — otherwise every profile switch flashes an empty
   * book at level 1 before the data lands.
   */
  selectProfile(id: string, accountId: string | null = this.state.accountId): void {
    writePointer(id)
    progressStore.attach(id)
    this.publish({ status: 'ready', accountId, activeProfileId: id, error: null })
  }

  /** Drop the child selection ("🔄 Skift barn", or a profile that vanished). */
  clearSelection(): void {
    progressStore.detach()
    writePointer(null)
    this.publish({ status: 'choosing', activeProfileId: null })
  }

  async createProfile(input: { name?: string; avatarEmoji: string }): Promise<ChildProfile | null> {
    if (!authStore.sessionToken()) {
      this.publish({ error: 'Du skal være online for at lave en profil.' })
      return null
    }
    try {
      const res = await fetch('/api/profiles', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(input),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        this.publish({ error: body?.error ?? 'Profilen kunne ikke oprettes.' })
        return null
      }
      const { profile } = (await res.json()) as { profile: ChildProfile }
      const list = [...this.state.profiles, profile]
      writeRoster(list)
      this.publish({ profiles: list, error: null })
      return profile
    } catch {
      this.publish({ error: 'Ingen forbindelse. Prøv igen når du er på nettet.' })
      return null
    }
  }

  async updateProfile(
    id: string,
    input: { name?: string | null; avatarEmoji?: string },
  ): Promise<boolean> {
    try {
      const res = await fetch('/api/profiles', {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ id, ...input }),
      })
      if (!res.ok) return false
      const { profile } = (await res.json()) as { profile: ChildProfile }
      const list = this.state.profiles.map((p) => (p.id === id ? profile : p))
      writeRoster(list)
      this.publish({ profiles: list })
      return true
    } catch {
      return false
    }
  }

  /**
   * Soft-delete on the server AND drop this device's local book for that child, so a deleted sibling's
   * progress doesn't sit on disk forever. The server row is soft-deleted, so it stays recoverable.
   */
  async deleteProfile(id: string): Promise<boolean> {
    try {
      const res = await fetch('/api/profiles', {
        method: 'DELETE',
        headers: authHeaders(),
        body: JSON.stringify({ id }),
      })
      if (!res.ok) return false
      const list = this.state.profiles.filter((p) => p.id !== id)
      writeRoster(list)
      if (this.state.activeProfileId === id) {
        progressStore.detach()
        writePointer(null)
        this.publish({ profiles: list, activeProfileId: null, status: 'choosing' })
      } else {
        this.publish({ profiles: list })
      }
      try {
        localStorage.removeItem(`bornelaering-progress:${id}`)
      } catch {
        /* ignore */
      }
      return true
    } catch {
      return false
    }
  }

  signOut(): void {
    progressStore.detach()
    writePointer(null)
    try {
      localStorage.removeItem(ROSTER_KEY)
    } catch {
      /* ignore */
    }
    this.hydratedFor = null
    this.publish({
      status: 'signed-out',
      accountId: null,
      profiles: [],
      activeProfileId: null,
      error: null,
    })
  }

  private publish(patch: Partial<AccountState>): void {
    this.state = { ...this.state, ...patch }
    this.listeners.forEach((l) => l())
  }
}

export const profileStore = new ProfileStore()

if (import.meta.env?.DEV && typeof window !== 'undefined') {
  ;(window as unknown as { __profiles?: ProfileStore }).__profiles = profileStore
}
