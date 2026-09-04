---
paths:
  - "src/components/**/*.tsx"
---

# Audio from a component

What a component author can get wrong. The engine, the readiness verdict, the pronunciation lexicon and
the 8-step protocol for changing a spoken line are in `.claude/rules/audio-system.md` — read it when the
work is actually about audio; this file is what always applies.

- **One audio at a time. New audio cancels the current one, and there is no queue.** Starting narration
  while narration is playing stops the first; an `AbortError` from the cancelled one is the documented
  behaviour, not a failure.
- **Never route SFX through `SimplifiedAudioController`.** `sfx` (`src/services/sfxClient.ts`) is a
  separate short channel that never cancels or queues against narration, so a tap cue and a spoken line
  can overlap. Keep `Howler` behind `sfxClient` rather than importing it directly.
- **Never `await` narration inside a tap handler.** The answer must register and the board must respond
  on the press; awaiting the clip delays the feedback by the length of the sentence. Fire and continue.
- **Never `await` a padded prebaked clip to pace a sequence.** Prebaked files carry trailing silence, so
  awaiting them makes an autoplay browse drift slower and slower. Use a fixed onset step (the alphabet
  and number browses use 1.3 s / 1.4 s).
- **All shipped audio is MP3, never Ogg/Opus.** Apple has no Ogg container before iPadOS 18.4, so Ogg
  silenced narration *and* SFX on the 17.7 floor device while only the mp3 music bed survived. Guarded by
  `src/services/audioFormat.test.ts`.
- **`ctx.state === 'running'` is not liveness in either direction.** A probe context can sit `suspended`
  while narration plays, and WebKit 263627 reports `running` with a frozen clock. Liveness is a moving
  clock — read it through `sfx.getWebAudioContext()`, re-read every probe, because Howler closes and
  rebuilds its context inside the first touch on iPad.
- **There is no blocking permission modal.** Audio unlocks on the first gesture anywhere; only a
  `blocked` verdict shows the small non-blocking "Tryk for lyd" chip. Don't add a gate.
- **Adding or changing any spoken line follows the 8-step protocol** in `audio-system.md`. A line
  composed inline in a component never gets baked and reaches live Azure, **which for a GUEST is
  silent, not slow** (`canCallPaidApis: false` → Web Speech), and `audit:check` cannot see it.
