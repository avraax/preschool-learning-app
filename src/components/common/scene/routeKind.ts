// How the persistent world should present behind a given route (see PersistentWorld).
//
// `menu` routes (home + the 5 section selection screens) show the bright, live world with the
// idle mascot. Every deeper route is a `game` screen: the world keeps living but a dim/blur
// scrim fades over it and the idle mascot hides (the in-game GameGuide companion takes over).

export type RouteKind = 'menu' | 'game'

// Home + the five section landing pages. Anything deeper is a play/learning screen.
const MENU_PATHS = new Set(['/', '/alphabet', '/math', '/farver', '/english', '/ordleg'])

export const routeKind = (pathname: string): RouteKind => (MENU_PATHS.has(pathname) ? 'menu' : 'game')

// Home shows the large hero mascot; the section menus show a smaller corner one.
export const isHomeRoute = (pathname: string): boolean => pathname === '/'
