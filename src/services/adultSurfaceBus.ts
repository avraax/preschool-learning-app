// The one way to open "Til de voksne", now that the trigger and the surface live in different trees.
//
// `AdultSurface` is mounted ONCE, globally, in `App.tsx` — it owns the PIN/arithmetic gate, the
// screenshot capture and the lazy `AdultSettings` chunk. The trigger is `ProfileBadge`, which renders
// inside each page's header chrome. A React context would have to wrap the router to reach it and
// would re-render every page on each publish; the app already uses module-scope buses for exactly this
// shape (`mascotBus`, `rewardBus`, `xpBus`), so this is one more.
//
// **Deliberately a SINGLE registered opener, not a listener list.** Two registered surfaces would mean
// two PIN prompts and two screenshots per tap. `register` returns its own unregister, and that
// unregister only clears the slot if it is still the one it installed — StrictMode double-invokes
// effects, so a naive `register(null)` on cleanup would unregister the SECOND mount's opener and leave
// the badge dead in development only.

type Opener = () => void

let opener: Opener | null = null

export const adultSurfaceBus = {
  /** Called by `AdultSurface` on mount. Returns the matching unregister. */
  register(fn: Opener): () => void {
    opener = fn
    return () => {
      if (opener === fn) opener = null
    }
  },
  /**
   * Open the adult surface. A no-op before `AdultSurface` has mounted — the badge can render one frame
   * earlier, and a tap in that window must do nothing rather than throw.
   */
  open(): void {
    opener?.()
  },
  /** DEV/probe only: has a surface registered itself? */
  isReady(): boolean {
    return opener !== null
  },
}
