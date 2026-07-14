// The "menu" surfaces: home + the five section landing pages. Shared so the section list can't
// drift between the two consumers that classify routes:
//   • scene/routeKind.ts — a `menu` route shows the bright live world; anything else dims to `game`.
//   • services/musicClient.ts — the music bed plays on menu surfaces only.
// Each consumer may EXTEND this list: the music bed additionally plays on `/album` (a reward hub),
// while the scene deliberately treats `/album` as a dimmed content screen. Only the shared section
// list lives here — the `/album` difference is intentional, not drift.
export const SECTION_MENU_PATHS = ['/', '/alphabet', '/math', '/farver', '/english', '/ordleg'] as const
