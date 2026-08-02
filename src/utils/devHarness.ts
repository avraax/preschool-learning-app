// Dev-only screenshot harness (UI/UX Overhaul PRD §8.0.3).
//
// A set of guarded query params so feedback/hint/reward/mascot states can be captured
// deterministically without solving a quiz. EVERYTHING here is behind `import.meta.env.DEV`, so
// none of it ships behavior to production.
//
//   ?fx=correct|wrong|hint|streak   force one tile/board/mix into that state
//   ?theme=<id>                      set the theme without click-chaining the selector
//   ?seed=<n>                        deterministic questions (seeds Math.random)
//   ?nogate=1                        skip the audio welcome/permission gate — AND the auth gate
//   ?noauth=1                        skip only the auth gate
//   ?oauthflow=<flowId>              seed a pending Google flow (drives the OAuth return/recovery)
//   ?reduce=1                        force reduced-motion (test the parity path headlessly)
//   ?nyt=1                           force a "nyt!" badge in Min Bog
//   ?rewards=<n>                     seed the book at n collected rewards (Reward Book PRD-01 W9)

// `import.meta.env?.` — optional, because this module is now in the transitive graph of a Node
// `--test` suite (via authStore), and `import.meta.env` is undefined outside Vite. Same reason
// progressStore.ts guards every one of its own reads.
export const DEV = import.meta.env?.DEV ?? false

const readParams = (): URLSearchParams =>
  new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')

export type FxState = 'correct' | 'wrong' | 'hint' | 'streak'

/** Forced feedback state for screenshots, or null when not in DEV / not requested. */
export const devFx = (): FxState | null => {
  if (!DEV) return null
  const v = readParams().get('fx')
  return v === 'correct' || v === 'wrong' || v === 'hint' || v === 'streak' ? v : null
}

/** Theme id forced via `?theme=`, or null. */
export const devThemeId = (): string | null => (DEV ? readParams().get('theme') : null)

/** Whether to skip the audio welcome/permission gate. */
export const devNoGate = (): boolean => DEV && readParams().has('nogate')

/**
 * Whether to skip the AUTH gate (accounts PRD W4).
 *
 * `?nogate=1` deliberately implies no-auth as well, so every pre-existing `ui-screenshot` recipe
 * keeps working unchanged instead of needing a second param bolted on. `?noauth=1` is the explicit
 * spelling for when only the auth gate should be skipped.
 */
export const devNoAuth = (): boolean =>
  DEV && (readParams().has('nogate') || readParams().get('noauth') === '1')

/** Whether to force the reduced-motion path (so its parity can be captured headlessly). */
export const devReduceMotion = (): boolean => DEV && readParams().get('reduce') === '1'

/** Whether to force a sample "new sticker" (nyt! badge) in the album for screenshots. */
export const devNyt = (): boolean => DEV && readParams().get('nyt') === '1'

/** Whether to force music on (default is off) so the music system can be verified headlessly. */
export const devMusicOn = (): boolean => DEV && readParams().get('music') === '1'

// Seed the Reward Book at N collected rewards (Reward Book PRD-01 W9), so the book / corner ring /
// ceremony / home shelf are all capturable at 0 / 1 / 8 / 9 / 44 / 45 without playing ~72 rounds.
//
// It grants the XP that genuinely reaches that point on the real curve and then hands the owed slots
// over through the real `grantPendingRewards()`, so the seeded state is indistinguishable from played
// state — including the store invariants (note the real one is an INEQUALITY:
// `grantedSlots <= collectedFromLevel(globalLevel())`, the gap being a pending ceremony). `?rewards=0` resets.
// Kept out of progressStore itself: this is harness-only, and it must go through the public API to
// prove the public API produces it.
export const installDevRewards = async (): Promise<void> => {
  if (!DEV) return
  const raw = readParams().get('rewards')
  if (raw == null) return
  const { progressStore } = await import('../services/progressStore')
  const { REWARD_XP, FAST_SLOTS } = await import('../config/progression')
  const { REWARD_SLOTS } = await import('../config/stickers')
  // The store is INERT until profileStore attaches a child (accounts PRD §5.4), and main.tsx fires
  // this at import — long before the auth gate opens. Without waiting, every call below is a silent
  // no-op and the `?rewards=n` harness dies without an error (§10.7).
  await progressStore.whenAttached()
  // Seeding past the end is allowed and must be INDISTINGUISHABLE from a full book — that's the
  // end-of-book state the verification walk checks at ?rewards=72 vs ?rewards=90.
  const want = Math.max(0, Math.min(REWARD_SLOTS * 2, Math.floor(Number(raw) || 0)))
  progressStore.resetAll()
  if (want === 0) return
  const xp =
    Math.min(want, FAST_SLOTS) * REWARD_XP + Math.max(0, want - FAST_SLOTS) * REWARD_XP * 2
  progressStore.grantXp('alphabet', xp)
  progressStore.grantPendingRewards()
  // Mark the seeded rewards as already celebrated so the ceremony doesn't fire on the first menu —
  // otherwise every seeded screenshot opens behind the overlay. Force it with ?rewards=n&celebrate=0.
  if (readParams().get('celebrate') !== '0') {
    progressStore.markLevelCelebrated(progressStore.globalLevel())
  }
}

// DEV `?oauthflow=<flowId>`: seed a PENDING Google flow before React mounts, so the return/recovery
// path (accounts PRD §4.5 step 6) is drivable headlessly. Without this there is no way to test it:
// each ui-screenshot run gets a fresh Chrome profile, so localStorage can't be pre-seeded, and the
// recovery listeners only arm when a pending flow exists AT MOUNT — which in real life is guaranteed
// because the return from Google is always a fresh page load.
export const installDevOauthFlow = (): void => {
  if (!DEV) return
  const flowId = readParams().get('oauthflow')
  if (!flowId) return
  try {
    localStorage.setItem('bl-oauth-flow', JSON.stringify({ flowId, startedAt: Date.now() }))
  } catch {
    /* private mode — nothing to seed */
  }
}

// Seedable RNG (mulberry32). When `?seed=<n>` is present in DEV, replace Math.random so every
// generator that relies on it yields a deterministic sequence — no per-game plumbing required.
export const installDevSeed = (): void => {
  if (!DEV) return
  const raw = readParams().get('seed')
  if (raw == null) return
  let a = (Number(raw) || 1) >>> 0
  Math.random = () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
