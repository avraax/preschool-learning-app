// The account/profile singleton — and the ONLY caller of progressStore.attach()/detach().
//
// Keeping that exclusive is what makes the store's "inert by default" discipline meaningful: there is
// exactly one place that decides which child the app is playing as (accounts PRD §5.9).
//
// OFFLINE-CAPABLE: the roster is cached in localStorage alongside the session, so a cold boot with no
// network still knows who the children are and can attach the right book immediately. The server is
// only consulted to refresh.

import { ACTIVE_PROFILE_KEY } from '../config/progressSchema.ts'
import { apiUrl } from '../config/apiBase.ts'
import { DEFAULT_AVATAR_ID, normalizeAvatarId, type AvatarId } from '../config/avatars.ts'
import { guestModeActive } from '../utils/guestMode.ts'
import { devKidCount } from '../utils/devHarness.ts'
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
 * The bypass's roster: ONE child by default, `?devkids=<n>` for more (Børn picker PRD §6.1).
 *
 * The default of one is load-bearing, not a convenience. The boot picker appears at 2+ children, so a
 * bypass that attached two would put "Hvem spiller?" in front of EVERY existing screenshot recipe and
 * `sweep.mjs` run at once — silently, since they would still find `#root > *`. Opting in is the only
 * way to see it, and the only way to see it without minting a real session against the owner's
 * production database.
 *
 * The extras reuse `dev-local`'s shape with a suffixed id, so each still gets its own progress key
 * (`bornelaering-progress:dev-local-2`) and no harness state can land in a real child's book.
 */
const devProfiles = (): ChildProfile[] => {
  const n = devKidCount()
  if (n <= 1) return [DEV_PROFILE]
  return Array.from({ length: n }, (_, i) =>
    i === 0 ? DEV_PROFILE : { id: `dev-local-${i + 1}`, name: `Dev ${i + 1}`, avatarId: DEFAULT_AVATAR_ID },
  )
}

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

/**
 * The "last child who played" pointer. WRITE-ONLY since the Børn picker PRD (§2.1 / §4.6): boot no
 * longer consults it, because honouring it meant a 2+ child family met the picker exactly once and
 * silently resumed as whoever played last ever after.
 *
 * The write is KEPT deliberately. It costs one line, a later "sidst spillet" marker on the picker
 * wants it, and removing it is a behaviour change disguised as a tidy-up. There is no `readPointer`
 * any more — if you find yourself adding one at boot, you are re-introducing the defect.
 */
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
      const kids = devProfiles()
      this.publish({ status: 'choosing', accountId, profiles: kids, rosterSettled: true })
      // ONE child ⇒ select it, exactly as before, so no existing recipe meets the boot picker.
      // `?devkids=2+` deliberately leaves nothing selected, which is how the picker becomes
      // driveable at rung 1 (Børn picker PRD §6.1).
      if (kids.length === 1) this.selectProfile(kids[0].id, accountId)
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

    if (!already) {
      // A DIFFERENT IDENTITY IS ASKING, SO THE PREVIOUS ANSWER IS VOID. `rosterSettled` means "a roster
      // refresh has ANSWERED" — but it answered about whoever was here before, and carrying it across a
      // change of identity turns it into a lie about this one.
      //
      // MEASURED ON THE OWNER'S iPAD, 2026-08-09: guest play sets `rosterSettled: true` (correct — a
      // guest has no roster and never will). Signing in with Google then re-enters `hydrate` with a real
      // account id; `guestModeActive()` is already false, this device has no cached roster, so the branch
      // below published `profiles: []` while `rosterSettled` was still `true` from the guest phase. For
      // the length of the `/api/profiles` round trip `profileGateSurface` therefore read
      // "settled AND empty" ⇒ the UN-DISMISSIBLE create dialog, over an account that already had a
      // child — it flashed up and vanished when the roster arrived, and any tap that landed on it in
      // that window created a nameless profile.
      //
      // This is the SAME defect `profileGatePolicy` was extracted to fix, one moment later: that fix
      // stopped "we haven't asked yet" reading as "no children", and this stops "we asked, as somebody
      // else" reading the same way. Reset FIRST, so nothing between here and the refresh can observe the
      // stale verdict.
      this.publish({ rosterSettled: false })

      // ONE child attaches immediately, so the very first render sees the child's real data (no
      // level-1 flash) and a single-child family never meets a picker — the accounts-PRD contract
      // that keeps "the child never sees a login screen" true.
      //
      // TWO OR MORE ALWAYS ASK (Børn picker PRD §2.1). The stored pointer is deliberately NOT
      // consulted here any more: honouring it meant a family met the picker exactly once, on this
      // device's first launch, and every launch after that silently resumed as whoever played last —
      // so the second child could only start their own session through the PIN-gated adult menu.
      // The pointer is still WRITTEN by `selectProfile` (§4.6): it costs one line, a later
      // "sidst spillet" marker wants it, and deleting the write is a behaviour change disguised as a
      // tidy-up. It simply no longer decides anything at boot.
      //
      // Consequence to keep: with 2+ children the store stays INERT behind the picker, so the app
      // underneath renders the DEFAULT skin (`themeId` is per-child) until a tile is tapped. The
      // picker is full-screen at AUTH_Z so nothing shows, and there is a repaint on pick. Do NOT
      // "fix" that by pre-attaching a guess — that is a write to the wrong book waiting to happen.
      const target = cached.length === 1 ? cached[0].id : null

      if (target) this.selectProfile(target, accountId)
      else {
        // No cached child, or more than one ⇒ let ProfileGate decide (the mandatory create dialog, or
        // the picker). NOTHING is attached and nothing is pre-added, so nothing can be written to the
        // wrong book in the meantime.
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
      const res = await fetch(apiUrl('/api/profiles'), { headers: authHeaders() })
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
      this.publish({ error: 'Flere børneprofiler kræver en konto. Log ind under "Indstillinger".' })
      return null
    }
    if (!authStore.sessionToken()) {
      this.publish({ error: 'Du skal være online for at lave en profil.' })
      return null
    }
    try {
      const res = await fetch(apiUrl('/api/profiles'), {
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
      const res = await fetch(apiUrl('/api/profiles'), {
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
      const res = await fetch(apiUrl('/api/profiles'), {
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
        // …and if exactly ONE child is left, select them rather than leaving `choosing` standing.
        // The boot picker only renders at 2+ (Børn picker PRD §2.1), so a lone survivor would
        // otherwise leave the app rendered with an INERT store and nobody playing — the
        // "nobody to play as" hole, reached from the one direction the gate cannot see (§4.3).
        // Handled HERE, not in `profileGatePolicy`: that module stays a pure statement of what to
        // SHOW, and this is a question of what to ATTACH.
        if (list.length === 1) this.selectProfile(list[0].id)
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
