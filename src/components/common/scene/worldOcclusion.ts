import { useEffect } from 'react'

/**
 * For a game that paints its OWN opaque full-bleed scene: while mounted, the persistent world behind it
 * is not drawn at all (`PersistentWorld`'s `html[data-world-occluded]` rule). The world is fully hidden
 * there anyway, so drawing it only spends compositor layers and GPU memory — on the A10X iPad that
 * memory is shared with the CPU. Fyld Båden measured 30 → 13 layers, ~27 → ~11 MB (Harbour PRD-01).
 *
 * The flag is removed on unmount, which happens under the transition wipe, so the world is back before
 * anything uncovers it.
 */
export const OCCLUSION_ATTR = 'data-world-occluded'

export function useOccludeWorld(): void {
  useEffect(() => {
    const root = document.documentElement
    root.setAttribute(OCCLUSION_ATTR, '')
    return () => root.removeAttribute(OCCLUSION_ATTR)
  }, [])
}
