# SFX sources and licences

One line per shipped cue that came from outside the repo (Harbour PRD-01: licence logged per file).

| shipped file | source | original file | licence |
|---|---|---|---|
| `public/sounds/ui/fish-land.mp3` | Kenney "Impact Sounds" — https://kenney.nl/assets/impact-sounds | `impactSoft_medium_002.ogg` | CC0 |
| `public/sounds/ui/box-land.mp3` | Kenney "Impact Sounds" — https://kenney.nl/assets/impact-sounds | `impactWood_heavy_001.ogg` | CC0 |
| `public/sounds/ui/harbour-ambience.mp3` | owner's download (Pixabay, uploader "freesound_community") — source kept as `art-src/sfx/harbour-seagulls-day-src.mp3` | `freesound_community-harbour_seagulls_day_2-22341.mp3` | Pixabay Content License (owner to confirm on the download page) |
| `public/sounds/ui/boat-motor.mp3` | owner's download (Pixabay, uploader "freesound_community") — source kept as `art-src/sfx/diesel-motor-fishing-boat-src.mp3` | `freesound_community-diesel-motor-on-fishing-boat-75321.mp3` | Pixabay Content License (owner to confirm on the download page) |
| `public/sounds/ui/boat-horn.mp3` | owner's download (Pixabay, uploader "dragon-studio") — source kept as `art-src/sfx/boat-horn-src.mp3` | `dragon-studio-boat-horn-386178.mp3` | Pixabay Content License (owner to confirm on the download page) |

All three are cut and levelled by `node scripts/bake-harbour-sounds.mjs` (seamless 40 s ambience loop at
-32 LUFS; a steady 6 s motor cut at -26 LUFS; mono MP3).

Still aliased to existing cues (no external file yet): `bundle`, `splash`. (`boat-arrive`
is gone — the motor swell replaced it.)

**Krea's studio cues** (`public/sounds/ui/krea-*.mp3`) have no external source: they are synthesised
by `node scripts/bake-krea-sounds.mjs` (ffmpeg noise + sines), so there is nothing to license. A
recorded replacement gets a row in the table above.
