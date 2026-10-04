// The music bed's loudness lives IN THE FILES, not in a runtime volume.
//
// iOS/iPadOS ignores `HTMLMediaElement.volume` — it is read-only there and always plays at 1 (the
// hardware buttons own the level). Music streams through an <audio> element (Howler `html5: true`,
// see musicClient.ts for why it cannot be WebAudio), so every `BASE_VOLUME` the code ever set —
// 0.045, 0.0225, 0.01125 — was obeyed on the desktop and silently ignored on the iPad and in the
// App Store build, which played the raw masters at full level: -8 LUFS for space, ~11 LU LOUDER than
// the narration, and -16..-19 for the rest, level with it. Two "halve the music" commits changed
// nothing on the device that mattered, because only the desktop could hear them.
//
// So the level is baked: `npm run music:bake` loudness-normalises each master in `art-src/music/`
// to MUSIC_TARGET_LUFS and writes the shipped file to `public/sounds/music/`. The runtime plays at 1,
// so the desktop and the iPad hear the same thing. TO MAKE THE MUSIC LOUDER OR QUIETER, change
// MUSIC_TARGET_LUFS and re-run the bake — changing a runtime volume only moves the desktop.
//
// Narration (the prebaked Azure clips) measures about -19 LUFS. Baked at -32 first (~13 LU under
// it); the owner heard that on a phone build and halved it twice (2026-09-26) → -38 → -44
// (each −6 dB = 50% volume).
export const MUSIC_TARGET_LUFS = -44

// Per-world trim ON TOP of MUSIC_TARGET_LUFS, in LU (negative = quieter). Equal LUFS is not equal
// perceived presence: Regnbue's bed is a mid-range synth pad with nothing below 150 Hz, so at -44 it
// sat in front of the others — the owner turned it down twice by ear (2026-10-04) to -52.
export const MUSIC_WORLD_TRIM_LU: Record<string, number> = { kid: -8 }

/** The level a world's shipped file is baked to. Read by `scripts/bake-music.mjs` and the guard test. */
export function musicTargetLufs(world: string): number {
  return MUSIC_TARGET_LUFS + (MUSIC_WORLD_TRIM_LU[world] ?? 0)
}

// How long the bed takes to fade out when the child leaves a menu for a game (or any other
// non-music screen). THE one knob for that fade: it starts on the tap, so it runs under the wipe
// (coverMs 180–260 per skin) and is gone by the time the game appears. Works on iOS too — the fade
// is a WebAudio gain ramp, not <audio>.volume (see musicClient.fadeOutAndUnload).
export const MUSIC_FADE_OUT_MS = 500

// Duck under TTS. Works where element volume is settable (desktop/Android); a no-op on iOS, where
// the bed is already quiet enough in the file to sit under narration.
export const MUSIC_DUCK_RATIO = 0.15

/** Steady-state element volume. Always 1 un-ducked: the level is in the file (see above). */
export function musicVolume(ttsActive: boolean): number {
  return ttsActive ? MUSIC_DUCK_RATIO : 1
}
