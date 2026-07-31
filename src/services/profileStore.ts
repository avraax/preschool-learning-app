// The account/profile singleton — and the ONLY caller of progressStore.attach()/detach().
//
// Keeping that exclusive is what makes the store's "inert by default" discipline meaningful: there is
// exactly one place that decides which child the app is playing as (accounts PRD §5.9).
//
// W8 SCOPE: a single IMPLICIT profile, so the app is fully playable while the store surgery lands.
// W9 replaces `TRANSITIONAL_PROFILE_ID` with the real server-backed roster, and adopts this blob into
// the first real child (the same code path legacy adoption uses).

import { ACTIVE_PROFILE_KEY } from '../config/progressSchema'
import { progressStore } from './progressStore'

/**
 * The implicit profile used before the real roster exists. A FIXED id, not one derived from the device,
 * so the key is stable across reloads and there is exactly one blob for W9 to adopt.
 */
export const TRANSITIONAL_PROFILE_ID = 'local'

export interface ChildProfile {
  id: string
  name?: string
  avatarEmoji: string
}

export type AccountStatus = 'locked' | 'signed-out' | 'ready'

export interface AccountState {
  status: AccountStatus
  accountId: string | null
  profiles: ChildProfile[]
  activeProfileId: string | null
}

type Listener = () => void

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

class ProfileStore {
  private state: AccountState = {
    status: 'signed-out',
    accountId: null,
    profiles: [],
    activeProfileId: null,
  }
  private listeners = new Set<Listener>()

  get(): AccountState {
    return this.state
  }

  subscribe(l: Listener): () => void {
    this.listeners.add(l)
    return () => {
      this.listeners.delete(l)
    }
  }

  /**
   * Called once the auth gate is open. Attaches the stored profile pointer (or the transitional one).
   * Idempotent — attach() is too, and StrictMode double-invokes effects.
   */
  hydrate(accountId: string | null): void {
    const id = readPointer() ?? TRANSITIONAL_PROFILE_ID
    this.selectProfile(id, accountId)
  }

  /**
   * `progressStore.attach()` runs SYNCHRONOUSLY in the same tick as this state update, so the very
   * first render already sees the child's real data — otherwise every profile switch flashes an empty
   * book at level 1 before the data lands.
   */
  selectProfile(id: string, accountId: string | null = this.state.accountId): void {
    writePointer(id)
    progressStore.attach(id)
    this.publish({ status: 'ready', accountId, activeProfileId: id })
  }

  /** Drop the child selection (sign-out, or "🔄 Skift barn"). */
  clearSelection(): void {
    progressStore.detach()
    writePointer(null)
    this.publish({ activeProfileId: null, status: 'locked' })
  }

  signOut(): void {
    progressStore.detach()
    writePointer(null)
    this.publish({ status: 'signed-out', accountId: null, profiles: [], activeProfileId: null })
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
