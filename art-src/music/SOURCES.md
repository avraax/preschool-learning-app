# Music bed sources and licences

One record per shipped bed (`public/sounds/music/<world>.mp3`). A track whose source or licence cannot
be filled in here does not ship. Shipped files are derived from the masters in this folder by
`npm run music:bake` (level only); the loop cut is made once, when the master is created, and described
below.

**Open item (owner):** Pixabay answers automated requests with 403, so the page URLs below are the
Pixabay IDs from the download filenames, not visited links. Paste each page's real URL and save a PDF
or screenshot of it next to the original in `originals/`, so the record still holds if the page
disappears.

## Regnbue — `kid.mp3` (replaced 2026-10-04)

- **Title / uploader:** "020210_floating synth pad.wav" — Pixabay user `freesound_community` (Pixabay's
  import account for Freesound uploads)
- **Source:** Pixabay Sound Effects, ID 77049 — URL: _owner to paste_
- **Downloaded:** 2026-10-04 by the owner
- **Licence:** Pixabay Content License — https://pixabay.com/service/license-summary/ (commercial use
  and use in apps allowed, no attribution required, modifying allowed; no standalone redistribution)
- **Original:** `originals/freesound_community-020210_floating-synth-padwav-77049.mp3`, 66.0 s,
  24 kHz stereo, sha256 `8461e94e5118dacafdd2cd7a7b31304f127590cae8557f4ee9983a93ebee2936`
- **What we changed:** cut 19.0–57.0 s (skips the fade in and out), last 4 s crossfaded into the
  start (equal power) to make a seamless 34 s loop, resampled to 44.1 kHz → `kid.mp3` master (320 kbps).
  Baked to −52 LUFS (8 LU under the other beds, by ear — `MUSIC_WORLD_TRIM_LU` in
  `src/config/musicLevel.ts`).
- Replaced "Rainbow Adventures" (no provenance record existed for it).

## Rummet — `space.mp3` (replaced 2026-10-04)

- **Title / uploader:** "Deep Calm Texture (short)" — Pixabay user `gigidelaromusic`
- **Source:** Pixabay, ID 450960 — URL: _owner to paste_
- **Downloaded:** 2026-10-04 by the owner
- **Licence:** Pixabay Content License — https://pixabay.com/service/license-summary/
- **Original:** `originals/gigidelaromusic-deep-calm-texture-short-450960.mp3`, 47.0 s, 44.1 kHz
  stereo, sha256 `b1fcc12312bc3553aa1999755cdb373acff4364297c569877b67636ae4ba5edd`
- **What we changed:** cut 2.5–45.0 s (skips the quiet first beat and the tail), last 3 s crossfaded
  into the start to make a seamless 39.5 s loop → `space.mp3` master (320 kbps). Baked to −44 LUFS.
- Replaced "Galaxy/Universe" (no provenance record existed for it).

## Havet — `ocean.mp3` and Dinosaurer — `dino.mp3` (unchanged)

"Aquatic Downtime" and "Fantasy theme", added 2026-07 before this record existed. **Source and licence
are not recorded anywhere in the repo.** The owner kept both by choice (2026-10-04); find and record
their sources here before they can be called documented.
