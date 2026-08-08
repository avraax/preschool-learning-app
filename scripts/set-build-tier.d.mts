// Types for `scripts/set-build-tier.mjs`.
//
// The script stays plain `.mjs` because CI runs it with a bare `node scripts/set-build-tier.mjs` on the
// macOS instance — no type-stripping loader, no build step. But `src/config/buildTiers.test.ts` IMPORTS
// its table rather than re-declaring it (a guard that re-derives its subject agrees with itself while
// the product regresses), and `tsc` needs a declaration to allow that import.

export interface BuildTierSpec {
  /** The iOS bundle identifier this tier signs as. */
  bundleId: string
  /** The HOME-SCREEN name — not the App Store listing name. */
  appName: string
  /** The backend origin baked into the binary, mirroring `src/config/backendTarget.ts`. */
  apiOrigin: string
}

export declare const BUILD_TIERS: Record<'production' | 'staging', BuildTierSpec>

export declare function setBuildTier(
  tier: string,
  options?: { dryRun?: boolean },
): { tier: string; target: BuildTierSpec; changes: string[] }
