# Theme Worlds — UI Polish Backlog (cross-layer)

Tracks the "keep the UI up with the immersive experience" upgrades and **which layers each
must be applied to**, so a fix done on the home page is repeated on menus (P3) and game
screens (P4). Tick a box when that layer is done.

Layers: **Home** (`App.tsx` HomePage) · **Menus** (`GameSelectionLayout`, all `*Selection.tsx`)
· **Games** (quiz/learning components + headers) · **Global** (shared chrome).

| # | Item | Home | Menus (P3) | Games (P4) | Notes |
|---|------|:----:|:----------:|:----------:|-------|
| 1 | **Soft-3D section icons** (replace emoji 📚🧮🎨🌍🗣️ with custom soft-3D icons to match the world) | ☑ | ☐ | ☐ | Art done: 5 magenta-keyed WebP in `src/assets/themes/icons/`, exported via `sectionIconImages`. Home cards wired. **TODO menus (P3):** GameSelectionLayout header icon + apply where section icons appear. **TODO games (P4):** game headers. Icons are theme-constant (one set, all skins). |
| 2 | **Title treatment** ("Børnelæring" / section titles get an underwater glow/halo so text isn't bare) | ☑ | ☐ | ☐ | Home title done (immersive glow). Menu header titles + game headers should get a matching treatment when those layers are themed. |
| 3 | **Theme selector → scene thumbnail** (replace 🌊 emoji chip with the world thumbnail) | ☑ | n/a | n/a | Selector only lives on home. Done. |
| 4 | **Version chip subtlety** (more translucent, less jarring on the scene) | ☑ | ☑ | ☑ | `VersionDisplay` is global/fixed → one change covers all layers. Done. |

## Also remember at later phases
- **Menus (P3):** render `<ThemeScene/>` + glassy materials behind `GameSelectionLayout`
  cards; apply the title treatment to the menu header; smaller idle mascot (optional).
- **Games (P4):** keep calm — theme colours + ONE light static motif only; apply title
  treatment to game headers; NO scene/parallax/mascot. Add the soft-3D icons in headers.
- Repeat the **whole world build** (scene + mascot + glass + title font) for every theme in P2.
