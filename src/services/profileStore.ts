// The account/profile singleton — and the ONLY caller of progressStore.attach()/detach().
//
// Keeping that exclusive is what makes the store's "inert by default" discipline meaningful: there is
// exactly one place that decides which child the app is playing as (accounts PRD §5.9).
//
// OFFLINE-CAPABLE: the roster is cached in localStorage alongside the session, so a cold boot with no
// network still knows who the children are and can attach the right book immediately. The server is
// only consulted to refresh.

import { ACTIVE_PROFILE_KEY } from '../config/progressSchema.ts'
import { DEFAULT_AVATAR_ID, normalizeAvatarId, type AvatarId } from '../config/avatars.ts'
import { guestModeActive } from '../utils/guestMode.ts'
import { authStore } from './authStore.ts'
import { practiceLedger } from './practiceLedger.ts'
import { progressStore } from './progressStore.ts'
import { progressSync } from './progressSync.ts'

export interface ChildProfile {
  id: string
  name?: string
  /** One of the closed `AVATAR_IDS` set — a baked-art key, never an emoji (de-emoji PRD-01). */
  avatarId: AvatarId
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
  /**
   * Has a roster refresh finished (either way) on this page load?
   *
   * This exists so an EMPTY `profiles` can be told apart from a `profiles` we simply haven't fetched
   * yet. ProfileGate's mandatory create dialog is gated on it: without that, every cold boot showed the
   * un-dismissible "lav en profil" dialog for the length of the /api/profiles round trip — and since
   * `utils/storageReset.ts` deliberately drops the cached roster once per device, THAT is what the
   * accounts release shows on the first sign-in of an account whose children were created elsewhere.
   * On a slow connection the adult can act on it and create a duplicate child.
   *
   * Deliberately set on FAILURE too: offline with no cached roster really has nothing to play as, and
   * the create dialog's own "du skal være online" error is the honest answer there.
   */
  rosterSettled: boolean
  error: string | null
}

type Listener = () => void

const ROSTER_KEY = 'bornelaering-profiles'

/**
 * The stand-in child for the DEV auth bypass — see `hydrate`. Its own localStorage key
 * (`bornelaering-progress:dev-local`) keeps harness state out of any real child's book.
 *
 */
const DEV_PROFILE: ChildProfile = { id: 'dev-local', name: 'Dev', avatarId: DEFAULT_AVATAR_ID }

/**
 * The child for GUEST play — no account, this device only (App Store PRD §3.2 / A1).
 *
 * This is the whole reason A1 is cheap: `progressStore` is already inert until `attach()`, and already
 * keys its document by profile id, so local-only play is a new CALLER of existing machinery rather than
 * a second progress path. The book lives at `bornelaering-progress:local-guest`, so a guest's progress
 * and a real child's can never overwrite each other.
 *
 * `progressSync` needs no guest branch: `canSync()` already requires `authStore.sessionToken()`, and a
 * guest has none — so nothing can be pushed to a server that has no row to push it to. Deliberately
 * NOT written to the roster cache, for the same reason as `DEV_PROFILE`: a later real session must not
 * be offered it as one of the family's children.
 */
const GUEST_PROFILE: ChildProfile = { id: 'local-guest', name: 'Gæst', avatarId: DEFAULT_AVATAR_ID }

/** The guest child's id, for the surfaces that must recognise it (the adult panes). */
export const GUEST_PROFILE_ID = GUEST_PROFILE.id

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
    // Normalise on READ so a roster cached before the baked avatars (which stored the glyph in an
    // `avatarEmoji` field) still resolves to a real portrait instead of dropping the child.
    return parsed
      .filter((p): p is ChildProfile => !!p && typeof (p as ChildProfile).id === 'string')
      .map((p) => ({
        ...p,
        avatarId: normalizeAvatarId(
          (p as ChildProfile).avatarId ?? (p as unknown as { avatarEmoji?: unknown }).avatarEmoji,
        ),
      }))
  } catch {
    return []
  }
}

// Server rows are already normalised by `api/profiles.ts`, but a row written by an older client (or
// read straight from the pre-baked-avatar column) can still carry a glyph — so coerce here too. This
// is the only path a raw server shape enters the store by.
const fromServer = (p: ChildProfile): ChildProfile => ({
  ...p,
  avatarId: normalizeAvatarId(p.avatarId ?? (p as unknown as { avatarEmoji?: unknown }).avatarEmoji),
})

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
    rosterSettled: false,
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

    // DEV BYPASS (`?nogate=1` / `?noauth=1`): there is no account, so there is no roster to fetch and
    // never will be. Without a stand-in child the bypass is not actually usable:
    //   * progressStore stays INERT, so `?rewards=n` awaits whenAttached() forever and every seeded
    //     screenshot recipe dies silently (exactly the §10.7 trap, from the other side), and
    //   * an empty settled roster means ProfileGate raises its UN-DISMISSIBLE create dialog over
    //     whatever screen was being captured — against a server that would refuse the create anyway.
    // Attach a fixed local child instead. Deliberately NOT written to the roster cache: a later real
    // session must not see it, and a stale pointer is already ignored (hydrate only honours a pointer
    // that appears in the fetched roster).
    if (!already && authStore.isDevBypass()) {
      this.publish({ status: 'choosing', accountId, profiles: [DEV_PROFILE], rosterSettled: true })
      this.selectProfile(DEV_PROFILE.id, accountId)
      return
    }

    // GUEST play (A1): same shape as the bypass above and for the same structural reason — there is no
    // account, so there is no roster to fetch and never will be. Attaching a fixed local child is what
    // makes the app playable at all: without it `progressStore` stays inert, so no XP is recorded, no
    // reward can be granted, and `ProfileGate` raises its UN-DISMISSIBLE create dialog over the very
    // first screen a reviewer sees — against a server that would refuse the create anyway.
    //
    // `rosterSettled: true` is the load-bearing half: it is what tells `profileGatePolicy` that the
    // roster has ANSWERED, so an empty one is a real answer rather than "we haven't asked yet".
    if (!already && guestModeActive()) {
      this.publish({
        status: 'choosing',
        accountId: null,
        profiles: [GUEST_PROFILE],
        rosterSettled: true,
      })
      this.selectProfile(GUEST_PROFILE.id, null)
      return
    }

    const cached = readRoster()
    const pointer = readPointer()

    if (!already) {
      // Attach immediately so the very first render sees the child's real data (no level-1 flash).
      const target =
        (pointer && cached.some((p) => p.id === pointer) ? pointer : null) ??
        (cached.length === 1 ? cached[0].id : null)

      if (target) this.selectProfile(target, accountId)
      else {
        // No cached child, or more than one and no valid pointer ⇒ let ProfileGate decide (the
        // mandatory create dialog, or the picker). NOTHING is attached and nothing is pre-added, so
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
    // Nothing to fetch: settled by definition, so the gate can stop waiting on us.
    if (!authStore.sessionToken()) {
      this.publish({ rosterSettled: true })
      return this.state.profiles
    }
    this.publish({ loading: true })
    try {
      const res = await fetch('/api/profiles', { headers: authHeaders() })
      if (!res.ok) {
        this.publish({ loading: false, rosterSettled: true })
        return this.state.profiles
      }
      const { profiles } = (await res.json()) as { profiles?: ChildProfile[] }
      const list = (Array.isArray(profiles) ? profiles : []).map(fromServer)
      writeRoster(list)
      this.publish({ profiles: list, accountId, loading: false, rosterSettled: true, error: null })

      // If the pointer names a profile that no longer exists (deleted on another device), stop playing
      // as it rather than writing to a dead book.
      const active = this.state.activeProfileId
      if (active && !list.some((p) => p.id === active)) {
        this.clearSelection()
      } else if (!active && list.length === 1) {
        this.selectProfile(list[0].id, accountId)
      } else if (!active && list.length > 1) {
        this.publish({ status: 'choosing' })
      }
      return list
    } catch {
      // Settled on FAILURE too. The gate is waiting on this flag, so leaving it false offline would
      // hang the onboarding decision forever instead of letting the create dialog say "du skal være
      // online" — which is the honest answer when there is no cached child either.
      this.publish({ loading: false, rosterSettled: true })
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
    // The practice ledger (Practice Loop PRD-01 W2) is per-child and device-local, so it follows the
    // same attach/detach lifecycle — this store is the only caller for it too.
    practiceLedger.attach(id)
    this.publish({ status: 'ready', accountId, activeProfileId: id, error: null })
    // Reconcile with the server in the background — NEVER awaited, because gameplay already runs off
    // the local state that attach() just hydrated.
    progressSync.start()
    void progressSync.syncNow('attach')
  }

  /** Drop the child selection ("🔄 Skift barn", or a profile that vanished). */
  clearSelection(): void {
    progressStore.detach()
    practiceLedger.detach()
    writePointer(null)
    this.publish({ status: 'choosing', activeProfileId: null })
  }

  async createProfile(input: { name?: string; avatarId: AvatarId }): Promise<ChildProfile | null> {
    // Guest first, because the generic no-token message below is a LIE here: being offline is not the
    // problem and going online would not help. Child profiles are the account feature, so this is also
    // the honest answer to "what does signing in actually buy me?" (Guideline 5.1.1(v) wants exactly
    // that shape — an account for account-shaped features, not for playing).
    if (guestModeActive()) {
      this.publish({ error: 'Flere børneprofiler kræver en konto. Log ind under "Til de voksne".' })
      return null
    }
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
      const list = [...this.state.profiles, fromServer(profile)]
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
    input: { name?: string | null; avatarId?: AvatarId },
  ): Promise<boolean> {
    // No server row exists for the guest child, so a PATCH would 401 and read as a bug.
    if (guestModeActive()) return false
    try {
      const res = await fetch('/api/profiles', {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ id, ...input }),
      })
      if (!res.ok) return false
      const { profile } = (await res.json()) as { profile: ChildProfile }
      const list = this.state.profiles.map((p) => (p.id === id ? fromServer(profile) : p))
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
    // Same as `updateProfile`: no server row, and deleting the ONLY guest child would leave the app
    // with nobody to play as. "Nulstil fremgang" is the guest's equivalent and it works locally.
    if (guestModeActive()) return false
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
      // …and the child's practice ledger (Practice Loop PRD-01 W2). A deleted child must not leave a
      // record of what they got wrong on the device — it is per-child data like the book.
      practiceLedger.clear(id)
      return true
    } catch {
      return false
    }
  }

  /**
   * Wired to `authStore.onSignOut` at the bottom of this module, so it runs on BOTH sign-out paths —
   * the adult's own, and a 401 telling us the session was revoked from another device.
   *
   * `progressStore.detach()` flushes any pending debounced write under the OLD key first, so nothing is
   * lost and nothing can land in the next child's book.
   */
  signOut(): void {
    progressStore.detach()
    practiceLedger.detach()
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
      // A new sign-in must WAIT for its own roster rather than inheriting this one's "settled".
      rosterSettled: false,
      error: null,
    })
  }

  private publish(patch: Partial<AccountState>): void {
    this.state = { ...this.state, ...patch }
    this.listeners.forEach((l) => l())
  }
}

export const profileStore = new ProfileStore()

// THE ONLY reliable place to hang this. A sign-out clears the session inside authStore — including the
// revocation path, where no component is involved at all — and the child must be detached and the
// cached roster dropped at that same moment. authStore cannot call us (this module imports it), so the
// dependency stays one-directional and the wiring is a subscription. AuthGate imports profileStore, so
// this registration is always in the graph before a sign-out can happen.
authStore.onSignOut(() => profileStore.signOut())

if (import.meta.env?.DEV && typeof window !== 'undefined') {
  ;(window as unknown as { __profiles?: ProfileStore }).__profiles = profileStore
}
