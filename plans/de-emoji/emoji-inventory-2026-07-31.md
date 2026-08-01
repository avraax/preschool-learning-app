# De-emoji inventory — 2026-07-31

Generated from `src/**/*.{ts,tsx}` (comment-only lines excluded). Companion to
`tmp-prd-de-emoji-01-remove-every-shipped-emoji.md`. **208 occurrences · 52 files · 118 glyphs.**

Markdown rather than JSON on purpose: `.gitignore` globally ignores `*.json`.

Regenerate with the script in §W0 of the PRD (`src/config/noEmoji.test.ts` once it exists).

> **This file is the ORIGINAL audit snapshot — it is not updated as workstreams land.** The live truth is
> `src/config/noEmoji.test.ts` (its `ALLOWED_FILES` map is what remains) — dump the current inventory with
> `EMOJI_REPORT=scan.md node --test src/config/noEmoji.test.ts`. Landed so far: **W0–W5**. W5 = confetti +
> the transition wipes now draw each skin's baked `ambientSprites` (every row below for `CelebrationEffect.tsx` and
> `transition/TransitionOverlay.tsx` is gone — 36 glyphs). W3 = `src/assets/ui/` (star · trophy · flame · book ·
> sparkle) replaced the load-bearing chrome glyphs, and the Min Bog chapter-complete ✅ became a lucide `Check`, so
> the rows for `RoundResultScreen`, `StickerAlbum`, `RewardRing`, `StickerReveal` and `HomePage` are gone too.
> W4 = the theme/section/game data was **all** dead fallback behind art that already shipped, so it was deleted
> rather than replaced: `Game.emoji` + `GameTileIcon`'s `fallbackEmoji` (24), `SECTION_ICONS` + the
> `CategoryPalette.icon`/`iconSize` pair nothing ever rendered (5+10), and every skin's `selectorEmoji` (6). Three
> coverage guards replaced them so a missing render can't reintroduce a glyph — `gameIcons.test.ts` (all 24
> `<section>.<id>` keys resolve), `themes.test.ts` (every registered skin ships `selectorThumb`), and W2's required
> `companionStages`. 208 → **87** glyphs.
>
> **The 12 accounts-era child-profile avatars then landed too (2026-08-01)** — baked portraits in
> `src/assets/avatars/`, keyed by a closed id set (`src/config/avatars.ts`, shared with `api/profiles.ts` +
> `dev-server.js`), guarded by `avatars.test.ts`. No DB migration: the column keeps its `avatarEmoji` name and the
> value became an id. 87 → **75** glyphs.
>
> **W6 + W7 LANDED 2026-08-01 — the PRD is COMPLETE.** All 45 reward renders ship (16 new + 29 re-trimmed from the
> game art), `Reward.emoji` and `RewardChapter.emoji` are deleted, the chapter tabs draw each chapter's first
> reward, and `rewardArtCoverage.test.ts` guards the set. **`ALLOWED_FILES` in `noEmoji.test.ts` is now EMPTY.**
>
> **208 → 25 glyphs**, and all 25 are `console.*` log prefixes (bucket E, owner option (a) — never rendered,
> excused by the log rule rather than by an allowlist). Nothing child- or adult-FACING renders an emoji anywhere.
> Remaining follow-up: re-capture `docs/ui-reference/`.

## A · reward data (art-gated) — 50 occurrences

| File | Line | Glyphs | Context |
|---|---|---|---|
| `src/config/stickers.ts` | 44 | 🐾 | `emoji: '🐾',` |
| `src/config/stickers.ts` | 46 | 🐕 | `{ id: 'dyr-hund', label: 'Hund', emoji: '🐕' },` |
| `src/config/stickers.ts` | 47 | 🐱 | `{ id: 'dyr-kat', label: 'Kat', emoji: '🐱' },` |
| `src/config/stickers.ts` | 48 | 🐄 | `{ id: 'dyr-ko', label: 'Ko', emoji: '🐄' },` |
| `src/config/stickers.ts` | 49 | 🐴 | `{ id: 'dyr-hest', label: 'Hest', emoji: '🐴' },` |
| `src/config/stickers.ts` | 50 | 🐷 | `{ id: 'dyr-gris', label: 'Gris', emoji: '🐷' },` |
| `src/config/stickers.ts` | 51 | 🐑 | `{ id: 'dyr-faar', label: 'Får', emoji: '🐑' },` |
| `src/config/stickers.ts` | 52 | 🐰 | `{ id: 'dyr-kanin', label: 'Kanin', emoji: '🐰' },` |
| `src/config/stickers.ts` | 53 | 🦊 | `{ id: 'dyr-raev', label: 'Ræv', emoji: '🦊' },` |
| `src/config/stickers.ts` | 54 | 🐻 | `{ id: 'dyr-bjoern', label: 'Bjørn', emoji: '🐻' },` |
| `src/config/stickers.ts` | 60 | 🚗 | `emoji: '🚗',` |
| `src/config/stickers.ts` | 62 | 🚗 | `{ id: 'kt-bil', label: 'Bil', emoji: '🚗' },` |
| `src/config/stickers.ts` | 63 | 🚌 | `{ id: 'kt-bus', label: 'Bus', emoji: '🚌' },` |
| `src/config/stickers.ts` | 64 | 🚂 | `{ id: 'kt-tog', label: 'Tog', emoji: '🚂' },` |
| `src/config/stickers.ts` | 65 | ✈ | `{ id: 'kt-fly', label: 'Fly', emoji: '✈️' },` |
| `src/config/stickers.ts` | 66 | ⛵ | `{ id: 'kt-baad', label: 'Båd', emoji: '⛵' },` |
| `src/config/stickers.ts` | 67 | 🚲 | `{ id: 'kt-cykel', label: 'Cykel', emoji: '🚲' },` |
| `src/config/stickers.ts` | 68 | 🚚 | `{ id: 'kt-lastbil', label: 'Lastbil', emoji: '🚚' },` |
| `src/config/stickers.ts` | 69 | 🚁 | `{ id: 'kt-helikopter', label: 'Helikopter', emoji: '🚁' },` |
| `src/config/stickers.ts` | 70 | 🚀 | `{ id: 'kt-raket', label: 'Raket', emoji: '🚀' },` |
| `src/config/stickers.ts` | 76 | 🍎 | `emoji: '🍎',` |
| `src/config/stickers.ts` | 78 | 🍎 | `{ id: 'mad-aeble', label: 'Æble', emoji: '🍎' },` |
| `src/config/stickers.ts` | 79 | 🍌 | `{ id: 'mad-banan', label: 'Banan', emoji: '🍌' },` |
| `src/config/stickers.ts` | 80 | 🍓 | `{ id: 'mad-jordbaer', label: 'Jordbær', emoji: '🍓' },` |
| `src/config/stickers.ts` | 81 | 🥕 | `{ id: 'mad-gulerod', label: 'Gulerod', emoji: '🥕' },` |
| `src/config/stickers.ts` | 82 | 🍞 | `{ id: 'mad-broed', label: 'Brød', emoji: '🍞' },` |
| `src/config/stickers.ts` | 83 | 🧀 | `{ id: 'mad-ost', label: 'Ost', emoji: '🧀' },` |
| `src/config/stickers.ts` | 84 | 🍦 | `{ id: 'mad-is', label: 'Is', emoji: '🍦' },` |
| `src/config/stickers.ts` | 85 | 🍰 | `{ id: 'mad-kage', label: 'Kage', emoji: '🍰' },` |
| `src/config/stickers.ts` | 86 | 🍕 | `{ id: 'mad-pizza', label: 'Pizza', emoji: '🍕' },` |
| `src/config/stickers.ts` | 92 | 🌳 | `emoji: '🌳',` |
| `src/config/stickers.ts` | 94 | 🌳 | `{ id: 'natur-trae', label: 'Træ', emoji: '🌳' },` |
| `src/config/stickers.ts` | 95 | 🌸 | `{ id: 'natur-blomst', label: 'Blomst', emoji: '🌸' },` |
| `src/config/stickers.ts` | 96 | ☀ | `{ id: 'natur-sol', label: 'Sol', emoji: '☀️' },` |
| `src/config/stickers.ts` | 97 | 🌙 | `{ id: 'natur-maane', label: 'Måne', emoji: '🌙' },` |
| `src/config/stickers.ts` | 98 | ⭐ | `{ id: 'natur-stjerne', label: 'Stjerne', emoji: '⭐' },` |
| `src/config/stickers.ts` | 99 | 🌈 | `{ id: 'natur-regnbue', label: 'Regnbue', emoji: '🌈' },` |
| `src/config/stickers.ts` | 100 | ☁ | `{ id: 'natur-sky', label: 'Sky', emoji: '☁️' },` |
| `src/config/stickers.ts` | 101 | 🍄 | `{ id: 'natur-svamp', label: 'Svamp', emoji: '🍄' },` |
| `src/config/stickers.ts` | 102 | 🍁 | `{ id: 'natur-blad', label: 'Blad', emoji: '🍁' },` |
| `src/config/stickers.ts` | 108 | 🌊 | `emoji: '🌊',` |
| `src/config/stickers.ts` | 110 | 🐟 | `{ id: 'hav-fisk', label: 'Fisk', emoji: '🐟' },` |
| `src/config/stickers.ts` | 111 | 🦈 | `{ id: 'hav-haj', label: 'Haj', emoji: '🦈' },` |
| `src/config/stickers.ts` | 112 | 🐳 | `{ id: 'hav-hval', label: 'Hval', emoji: '🐳' },` |
| `src/config/stickers.ts` | 113 | 🐬 | `{ id: 'hav-delfin', label: 'Delfin', emoji: '🐬' },` |
| `src/config/stickers.ts` | 114 | 🦭 | `{ id: 'hav-sael', label: 'Sæl', emoji: '🦭' },` |
| `src/config/stickers.ts` | 115 | 🦀 | `{ id: 'hav-krabbe', label: 'Krabbe', emoji: '🦀' },` |
| `src/config/stickers.ts` | 116 | 🐙 | `{ id: 'hav-blaeksprutte', label: 'Blæksprutte', emoji: '🐙' },` |
| `src/config/stickers.ts` | 117 | 🐢 | `{ id: 'hav-skildpadde', label: 'Skildpadde', emoji: '🐢' },` |
| `src/config/stickers.ts` | 118 | 🐚 | `{ id: 'hav-musling', label: 'Musling', emoji: '🐚' },` |

## B · CHILD-FACING UI — 48 occurrences

| File | Line | Glyphs | Context |
|---|---|---|---|
| `src/App.tsx` | 105 | 🎈 | `<Typography variant="h1" sx={{ fontSize: '4rem', mb: 2 }}>🎈</Typography>` |
| `src/App.tsx` | 107 | 🤔 | `Hovsa! 🤔` |
| `src/App.tsx` | 110 | 🔍 | `Denne side findes ikke 🔍` |
| `src/App.tsx` | 120 | 🏠 | `🏠 Hjem` |
| `src/App.tsx` | 212 | ⚙ | `⚙️ menu (PRD-09 P4). The actual apply-update is the hold-gated menu item, never a` |
| `src/App.tsx` | 220 | ⬆ | `SFX toggle, progress reset, version info, and the gated "⬆️ Opdater app"). Stays` |
| `src/components/common/CelebrationEffect.tsx` | 31 | ⭐🌟✨🎊🎈🏆 | `if (!theme.scene.layers.length) return ['⭐', '🌟', '✨', '🎊', '🎈', '🏆']` |
| `src/components/common/CelebrationEffect.tsx` | 33 | ⭐🌟✨💫🌠🚀 | `case 'twinkle': return ['⭐', '🌟', '✨', '💫', '🌠', '🚀']` |
| `src/components/common/CelebrationEffect.tsx` | 34 | 🫧✨🐠🌊⭐🐚 | `case 'rise': return ['🫧', '✨', '🐠', '🌊', '⭐', '🐚']` |
| `src/components/common/CelebrationEffect.tsx` | 35 | 🍃🍂✨🌿⭐🦋 | `case 'fall': return ['🍃', '🍂', '✨', '🌿', '⭐', '🦋']` |
| `src/components/common/CelebrationEffect.tsx` | 37 | ⭐🌟✨🌈🎈🎊 | `default: return ['⭐', '🌟', '✨', '🌈', '🎈', '🎊']` |
| `src/components/common/LottieCharacter.tsx` | 36 | 🐻 | `bear: '🐻',` |
| `src/components/common/LottieCharacter.tsx` | 37 | 🦉 | `owl: '🦉',` |
| `src/components/common/LottieCharacter.tsx` | 38 | 🦊 | `fox: '🦊',` |
| `src/components/common/LottieCharacter.tsx` | 39 | 🐰 | `rabbit: '🐰'` |
| `src/components/common/Mascot.tsx` | 37 | ⭐ | `correct: '⭐',` |
| `src/components/common/Mascot.tsx` | 39 | 🔥 | `streak: '🔥',` |
| `src/components/common/Mascot.tsx` | 40 | 🎉 | `round: '🎉',` |
| `src/components/common/Mascot.tsx` | 41 | ✨ | `sticker: '✨',` |
| `src/components/common/Mascot.tsx` | 42 | 👉 | `hint: '👉',` |
| `src/components/common/Mascot.tsx` | 43 | 👋 | `welcome: '👋',` |
| `src/components/common/Mascot.tsx` | 85 | 🚀 | `case 'twinkle': return '🚀'` |
| `src/components/common/Mascot.tsx` | 86 | 🐙 | `case 'rise': return '🐙'` |
| `src/components/common/Mascot.tsx` | 87 | 🦕 | `case 'fall': return '🦕'` |
| `src/components/common/Mascot.tsx` | 88 | 🦄 | `default: return '🦄'` |
| `src/components/common/ProgressionCompanion.tsx` | 24 | 🌱🌿🌷🌳🌟 | `export const COMPANION_DEFAULT_STAGES = ['🌱', '🌿', '🌷', '🌳', '🌟'] as const` |
| `src/components/common/RewardOverlay.tsx` | 254 | 🎉 | `{bookDone ? 'Hele bogen er samlet!' : '🎉 Hele siden er samlet!'}` |
| `src/components/common/RewardRing.tsx` | 124 | ✨ | `const emoji = flash ? flash.emoji : next ? next.reward.emoji : '✨'` |
| `src/components/common/RoundResultScreen.tsx` | 228 | 🎉 | `Færdig! 🎉` |
| `src/components/common/RoundResultScreen.tsx` | 257 | ⭐ | `⭐` |
| `src/components/common/RoundResultScreen.tsx` | 285 | 🏆 | `🏆 Ny rekord!` |
| `src/components/common/RoundResultScreen.tsx` | 310 | 🔥 | `🔥 {longestStreak} i træk!` |
| `src/components/common/RoundResultScreen.tsx` | 329 | ✨ | `{/* The next prize, as a silhouette — book full → a gold ✨. */}` |
| `src/components/common/RoundResultScreen.tsx` | 358 | ✨ | `'✨'` |
| `src/components/common/StickerReveal.tsx` | 69 | ✨ | `{isShiny ? 'Skinnende! ✨' : 'Nyt klistermærke!'}` |
| `src/components/common/transition/TransitionOverlay.tsx` | 170 | 🚀 | `🚀` |
| `src/components/common/transition/TransitionOverlay.tsx` | 175 | 🍃🍂🍃🍂 | `{['🍃', '🍂', '🍃', '🍂'].map((leaf, i) => (` |
| `src/components/common/transition/TransitionOverlay.tsx` | 204 | ✨ | `✨` |
| `src/components/home/HomePage.tsx` | 449 | ✨ | `also answers "what am I working toward?". Book full → a gold ✨. */}` |
| `src/components/home/HomePage.tsx` | 479 | ✨ | `'✨'` |
| `src/components/hub/StickerAlbum.tsx` | 106 | ⭐ | `{/* Header: back (left) + the ONE count (right). The old lifetime ⭐ pill is gone (PRD D1` |
| `src/components/hub/StickerAlbum.tsx` | 113 | 📒 | `<StatPill label={`📒 ${totalCollected} / ${REWARD_SLOTS}`} accent={accent} />` |
| `src/components/hub/StickerAlbum.tsx` | 137 | 📖 | `📖 Min Bog` |
| `src/components/hub/StickerAlbum.tsx` | 199 | ✅ | `{done && <span aria-label="komplet">✅</span>}` |
| `src/components/hub/StickerAlbum.tsx` | 261 | 🎉 | `🎉 Hele siden er samlet!` |
| `src/components/hub/StickerAlbum.tsx` | 473 | ✨ | `✨` |
| `src/hooks/useRound.ts` | 18 | ★★ | `starThresholds?: { three: number; two: number } // MISTAKES allowed; default 3★=0, 2★≤2` |
| `src/services/progressStore.ts` | 183 | ★★ | `starThresholds?: { three: number; two: number } // MISTAKES allowed; default 3★=0, 2★≤2` |

## C · theme / section / game data — 40 occurrences

| File | Line | Glyphs | Context |
|---|---|---|---|
| `src/config/categoryThemes.ts` | 55 | 📚 | `emoji: '📚',` |
| `src/config/categoryThemes.ts` | 62 | 🎯 | `emoji: '🎯',` |
| `src/config/categoryThemes.ts` | 69 | 🧠 | `emoji: '🧠',` |
| `src/config/categoryThemes.ts` | 76 | 🧠 | `emoji: '🧠',` |
| `src/config/categoryThemes.ts` | 89 | 📚 | `emoji: '📚',` |
| `src/config/categoryThemes.ts` | 96 | 🎯 | `emoji: '🎯',` |
| `src/config/categoryThemes.ts` | 103 | ➕ | `emoji: '➕',` |
| `src/config/categoryThemes.ts` | 110 | ➖ | `emoji: '➖',` |
| `src/config/categoryThemes.ts` | 117 | ⚖ | `emoji: '⚖️',` |
| `src/config/categoryThemes.ts` | 124 | 🧩 | `emoji: '🧩',` |
| `src/config/categoryThemes.ts` | 131 | 🧠 | `emoji: '🧠',` |
| `src/config/categoryThemes.ts` | 138 | 🧠 | `emoji: '🧠',` |
| `src/config/categoryThemes.ts` | 151 | 🌈 | `emoji: '🌈',` |
| `src/config/categoryThemes.ts` | 158 | 🎯 | `emoji: '🎯',` |
| `src/config/categoryThemes.ts` | 165 | ❓ | `emoji: '❓',` |
| `src/config/categoryThemes.ts` | 172 | 🎨 | `emoji: '🎨',` |
| `src/config/categoryThemes.ts` | 179 | 🌗 | `emoji: '🌗',` |
| `src/config/categoryThemes.ts` | 192 | 👂 | `emoji: '👂',` |
| `src/config/categoryThemes.ts` | 199 | 🔤 | `emoji: '🔤',` |
| `src/config/categoryThemes.ts` | 206 | 🔁 | `emoji: '🔁',` |
| `src/config/categoryThemes.ts` | 213 | 📚 | `emoji: '📚',` |
| `src/config/categoryThemes.ts` | 226 | 📖 | `emoji: '📖',` |
| `src/config/categoryThemes.ts` | 233 | ✏ | `emoji: '✏️',` |
| `src/config/categoryThemes.ts` | 240 | 🎤 | `emoji: '🎤',` |
| `src/theme/tokens/candy.tokens.ts` | 9 | 🍭 | `selectorEmoji: '🍭',` |
| `src/theme/tokens/dino.tokens.ts` | 9 | 🦕 | `selectorEmoji: '🦕',` |
| `src/theme/tokens/helpers.ts` | 118 | 📚 | `alphabet: '📚',` |
| `src/theme/tokens/helpers.ts` | 119 | 🧮 | `math: '🧮',` |
| `src/theme/tokens/helpers.ts` | 120 | 🎨 | `colors: '🎨',` |
| `src/theme/tokens/helpers.ts` | 121 | 🌍 | `english: '🌍',` |
| `src/theme/tokens/helpers.ts` | 122 | 🗣 | `ordleg: '🗣️',` |
| `src/theme/tokens/jungle.tokens.ts` | 9 | 🌴 | `selectorEmoji: '🌴',` |
| `src/theme/tokens/kidTheme.tokens.ts` | 16 | 🌈 | `selectorEmoji: '🌈',` |
| `src/theme/tokens/kidTheme.tokens.ts` | 41 | 📚 | `icon: '📚',` |
| `src/theme/tokens/kidTheme.tokens.ts` | 53 | 🧮 | `icon: '🧮',` |
| `src/theme/tokens/kidTheme.tokens.ts` | 65 | 🎨 | `icon: '🎨',` |
| `src/theme/tokens/kidTheme.tokens.ts` | 77 | 🌍 | `icon: '🌍',` |
| `src/theme/tokens/kidTheme.tokens.ts` | 89 | 🗣 | `icon: '🗣️',` |
| `src/theme/tokens/ocean.tokens.ts` | 8 | 🌊 | `selectorEmoji: '🌊',` |
| `src/theme/tokens/space.tokens.ts` | 9 | 🚀 | `selectorEmoji: '🚀',` |

## D · adult / dev-only UI — 49 occurrences

| File | Line | Glyphs | Context |
|---|---|---|---|
| `src/components/adult/AdultCorner.tsx` | 156 | 🔒 | `<DialogTitle sx={{ fontWeight: 700 }}>Til de voksne 🔒</DialogTitle>` |
| `src/components/adult/AdultCorner.tsx` | 172 | ⬆ | `<ListItemText primary="⬆️ Opdater app (ny version klar)" />` |
| `src/components/adult/AdultCorner.tsx` | 180 | 🐞 | `<ListItemText primary="🐞 Rapportér et problem" />` |
| `src/components/adult/AdultCorner.tsx` | 187 | 🎙 | `<ListItemText primary="🎙️ Stemme-test" />` |
| `src/components/adult/AdultCorner.tsx` | 194 | 🎚 | `<ListItemText primary="🎚️ Sværhedsgrad" />` |
| `src/components/adult/AdultCorner.tsx` | 201 | 🎨 | `<ListItemText primary="🎨 Tema" />` |
| `src/components/adult/AdultCorner.tsx` | 204 | 🔊 | `<ListItemText primary="🔊 Lydeffekter" />` |
| `src/components/adult/AdultCorner.tsx` | 212 | 🎵 | `<ListItemText primary="🎵 Musik" />` |
| `src/components/adult/AdultCorner.tsx` | 227 | ♻ | `<ListItemText primary="♻️ Nulstil al fremgang" />` |
| `src/components/adult/AdultCorner.tsx` | 274 | ✅ | `<Typography sx={{ fontSize: '2.5rem', mb: 1 }}>✅</Typography>` |
| `src/components/adult/BugReportDialog.tsx` | 88 | 🐞 | `<AdultBackHeader title="🐞 Rapportér et problem" onBack={onClose} />` |
| `src/components/adult/BugReportDialog.tsx` | 138 | ✅ | `<Typography sx={{ fontWeight: 700, mb: 1 }}>Tak! Rapporten er sendt ✅</Typography>` |
| `src/components/adult/BugReportDialog.tsx` | 160 | 😕 | `<Typography sx={{ fontWeight: 700, mb: 1 }}>Rapporten kunne ikke sendes 😕</Typography>` |
| `src/components/adult/DifficultyPanel.tsx` | 46 | 🎚 | `<AdultBackHeader title="Sværhedsgrad 🎚️" onBack={onClose} />` |
| `src/components/adult/ThemePanel.tsx` | 43 | 🎨 | `<AdultBackHeader title="Tema 🎨" onBack={onClose} />` |
| `src/components/audit/AuditHarness.tsx` | 339 | ✓ | `<Chip size="small" color="success" variant="outlined" label="prebaked ✓" sx={{ height: 2` |
| `src/components/audit/AuditHarness.tsx` | 341 | ✗ | `<Chip size="small" color="error" variant="outlined" label="prebaked ✗" sx={{ height: 20,` |
| `src/components/audit/AuditHarness.tsx` | 356 | ✗ | `{busyKey === `${clip.key}:nolex` ? <CircularProgress size={14} /> : 'lex ✗'}` |
| `src/components/audit/AuditHarness.tsx` | 395 | ✓ | `✓ OK` |
| `src/components/audit/AuditHarness.tsx` | 398 | ✗ | `✗ Fejl` |
| `src/components/audit/AuditHarness.tsx` | 451 | 🎧 | `🎧 Narration-audit (PRD-11)` |
| `src/components/audit/AuditHarness.tsx` | 514 | ⬇ | `⬇ Download JSON` |
| `src/components/audit/AuditHarness.tsx` | 517 | ✓⚠ | `{saveState === 'saving' ? 'Gemmer…' : saveState === 'saved' ? '✓ Gemt i repo' : saveStat` |
| `src/components/audit/AuditHarness.tsx` | 540 | ⚠ | `⚠️ {errorMsg}` |
| `src/components/common/AdultGate.tsx` | 41 | 🔒 | `title = 'Kun for voksne 🔒',` |
| `src/components/common/AppErrorBoundary.tsx` | 58 | 🙈 | `<div style={{ fontSize: '5rem', lineHeight: 1 }}>🙈</div>` |
| `src/components/common/AppErrorBoundary.tsx` | 80 | 🔄 | `Prøv igen 🔄` |
| `src/components/common/SimplifiedAudioPermission.tsx` | 158 | 🎵 | `Tænd for lyd 🎵` |
| `src/components/common/UpdateBanner.tsx` | 63 | 🎉⚙ | `🎉 Ny version — åbn ⚙️ for at opdatere` |
| `src/components/voicelab/VoiceLab.tsx` | 273 | 🎙 | `🎙️ VoiceLab (Azure)` |
| `src/components/voicelab/VoiceLab.tsx` | 291 | ⚠ | `⚠️ {errorMsg}` |
| `src/components/voicelab/VoiceLab.tsx` | 413 | 🐾 | `🐾 Maskot-lyde` |
| `src/components/voicelab/VoiceLab.tsx` | 439 | 🔊 | `{busyKey === key ? <CircularProgress size={16} /> : '🔊'} {text}` |
| `src/components/voicelab/VoiceLab.tsx` | 451 | 🔊 | `🔊 Rigtige lyde (SFX)` |
| `src/components/voicelab/VoiceLab.tsx` | 478 | 🔊 | `{busyKey === key ? <CircularProgress size={16} /> : '🔊'} {f.label}` |
| `src/components/voicelab/VoiceOverridePanel.tsx` | 86 | 🎙 | `<AdultBackHeader title="🎙️ Stemme-test" onBack={onClose} />` |
| `src/components/voicelab/voicelabData.ts` | 95 | 🐙 | `id: 'octopus', label: 'Blæksprutte', emoji: '🐙', burst: 'bobler',` |
| `src/components/voicelab/voicelabData.ts` | 100 | 🚀 | `id: 'astronaut', label: 'Astronaut', emoji: '🚀', burst: 'stjerner',` |
| `src/components/voicelab/voicelabData.ts` | 105 | 🧸 | `id: 'bear', label: 'Bjørn (Regnbue)', emoji: '🧸', burst: 'stjerner/gnister',` |
| `src/components/voicelab/voicelabData.ts` | 110 | 🦖 | `id: 'dino', label: 'Dinosaur', emoji: '🦖', burst: 'blade',` |
| `src/components/voicelab/voicelabData.ts` | 141 | 🐙 | `id: 'octopus', label: 'Blæksprutte', emoji: '🐙', burst: 'bobler',` |
| `src/components/voicelab/voicelabData.ts` | 156 | 🚀 | `id: 'astronaut', label: 'Astronaut', emoji: '🚀', burst: 'stjerner',` |
| `src/components/voicelab/voicelabData.ts` | 171 | 🦖 | `id: 'dino', label: 'Dinosaur', emoji: '🦖', burst: 'blade',` |
| `src/components/voicelab/voicelabData.ts` | 186 | 🧸 | `id: 'bear', label: 'Bjørn (Regnbue)', emoji: '🧸', burst: 'stjerner/gnister',` |
| `src/contexts/audioPromptPolicy.ts` | 13 | ✕ | `userDismissed: boolean // the user explicitly closed the modal (button or ✕) this sessio` |
| `src/utils/remoteConsole.ts` | 269 | ❌ | `originalConsole('❌ Remote Console API failed:', errorInfo)` |
| `src/utils/remoteConsole.ts` | 296 | ❌ | `originalConsole('❌ Enhanced error logging failed:', {` |
| `src/utils/remoteConsole.ts` | 319 | 🔍 | `this.addLog('info', '🔍 Device Info', deviceInfo)` |
| `src/utils/remoteConsole.ts` | 435 | 🔊 | `message: `🔊 AUDIO DEBUG REPORT - ${context}`,` |

## E · console/log (not UI) — 21 occurrences

| File | Line | Glyphs | Context |
|---|---|---|---|
| `src/components/alphabet/AlphabetLearning.tsx` | 24 | 🎵 | `console.error(`🎵 AlphabetLearning: ${message}`, data)` |
| `src/components/common/UnifiedMemoryGame.tsx` | 153 | 🎵 | `console.error(`🎵 UnifiedMemoryGame: ${message}`, data)` |
| `src/components/common/UnifiedMemoryGame.tsx` | 299 | 🎵 | `console.error('🎵 UnifiedMemoryGame: Matched card audio failed', errorDetails)` |
| `src/components/common/UnifiedMemoryGame.tsx` | 350 | 🎵 | `console.error('🎵 UnifiedMemoryGame: Card reveal audio failed', audioErrorDetails)` |
| `src/components/common/UnifiedQuizGame.tsx` | 32 | 🎵 | `console.error(`🎵 UnifiedQuizGame: ${message}`, data)` |
| `src/components/common/UnifiedQuizGame.tsx` | 540 | 🎵 | `console.error('🎵 UnifiedQuizGame: Error repeating item:', error)` |
| `src/components/farver/FarveQuizGame.tsx` | 103 | 🎵 | `console.error(`🎵 FarveQuizGame: ${message}`, data)` |
| `src/components/farver/FarvejagtGame.tsx` | 121 | 🎵 | `console.error(`🎵 FarvejagtGame: ${message}`, data)` |
| `src/components/farver/FarverLearning.tsx` | 48 | 🎵 | `console.error(`🎵 FarverLearning: ${message}`, data)` |
| `src/components/farver/NuancerGame.tsx` | 101 | 🎵 | `console.error(`🎵 NuancerGame: ${message}`, data)` |
| `src/components/farver/RamFarvenGame.tsx` | 196 | 🎵 | `console.error(`🎵 RamFarvenGame: ${message}`, data)` |
| `src/components/math/ComparisonGame.tsx` | 133 | 🎵 | `console.error(`🎵 ComparisonGame: ${message}`, data)` |
| `src/components/math/MathOperationGame.tsx` | 203 | 🎵 | `console.error(`🎵 ${isAddition ? 'AdditionGame' : 'SubtractionGame'}: ${message}`, data)` |
| `src/components/math/NumberLearning.tsx` | 113 | 🎵 | `console.error(`🎵 NumberLearning: ${message}`, data)` |
| `src/components/ordleg/SpellingGame.tsx` | 164 | 🎵 | `console.error(`🎵 SpellingGame: ${message}`, data)` |
| `src/components/ordleg/SpellingGame.tsx` | 439 | 🎵 | `console.error('🎵 SpellingGame: Error repeating word:', error)` |
| `src/hooks/useUpdateChecker.ts` | 80 | 🔄 | `console.warn('🔄 Update check failed:', errorMessage)` |
| `src/utils/SimplifiedAudioController.ts` | 12 | 🎵 | `console.error(`🎵 SimplifiedAudioController Error: ${message}`, data)` |
| `src/utils/deviceDetection.ts` | 192 | 📱 | `console.log('📱 Device Information:', getDeviceSnapshot())` |
| `src/utils/remoteConsole.ts` | 349 | 🎵 | `console.error(`🎵 Audio Issue [${context}]:`, error, additionalData)` |
| `src/utils/remoteConsole.ts` | 355 | 🍎 | `console.warn(`🍎 iOS Issue [${context}]: ${issue}`, data)` |
