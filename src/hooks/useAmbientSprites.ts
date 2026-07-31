import { useEffect, useState } from 'react'
import { useThemeSwitch } from '../theme/ThemeProvider'
import { loadSceneAssets } from '../theme/sceneAssets'

// The active skin's baked ambient motes (de-emoji PRD-01 W5).
//
// Confetti particles and the transition-wipe motifs both draw from this ONE set, so a celebration
// bursts — and a wipe travels — in the art of the world it happens in, instead of the OS emoji font
// (which changes shape between the iPadOS 17.7 floor and a newer device). There is deliberately NO
// fallback glyph: a skin with no world art renders no particles at all (PRD D5).
//
// The URLs come from the same code-split `loadSceneAssets(themeId)` module the world itself uses, so
// by the time a celebration or wipe runs it is already resolved from the module cache.
export const useAmbientSprites = (): string[] => {
  const { themeId } = useThemeSwitch()
  const [state, setState] = useState<{ id: string; sprites: string[] }>({ id: '', sprites: [] })

  useEffect(() => {
    let alive = true
    loadSceneAssets(themeId).then((a) => {
      if (alive) setState({ id: themeId, sprites: a?.ambientSprites ?? [] })
    })
    return () => {
      alive = false
    }
  }, [themeId])

  // Guard against showing the previous skin's motes for a frame after a theme switch.
  return state.id === themeId ? state.sprites : []
}

export default useAmbientSprites
