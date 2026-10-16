/**
 * Whether the Krea section is reachable — its home object, its menu AND every one of its routes
 * (Krea PRD-01 §2.5). Staging only until the owner play-tests it; release is deleting this gate.
 *
 * The `boatGate.ts` shape and for the same reason: `BL_TIER` defaults to `'production'` under
 * `npm run dev`, so a tier-only gate would hide Krea from the owner's own dev machine.
 */
export const showsKrea = (tier: 'staging' | 'production', isDev: boolean, isHarness: boolean): boolean =>
  tier === 'staging' || isDev || isHarness

/** Every Krea route, menu first. A deep link to any of them on production redirects home. */
export const KREA_ROUTES = ['/krea', '/krea/tegn', '/krea/tegnmedmig', '/krea/farvelaeg'] as const
