// Runtime binding for the adult surface's owner-only tools. The RULE is pure and lives in
// `src/config/adultSettingsIa.ts` (`showsDevTools`); this file only supplies the three inputs, so the
// rule stays truth-tableable in plain Node while the panes get a single boolean.
//
// `import.meta.env?.` — optional, because this module is reachable from a Node `--test` graph and
// `import.meta.env` is undefined outside Vite (same shape as devHarness.ts).
import { BL_TIER } from '../config/backendTarget'
import { DEV, devHideTools } from './devHarness'
import { showsDevTools } from '../config/adultSettingsIa'

/**
 * True on staging, in local dev and in a harness build; false in the production App Store build.
 *
 * NOT a permission check — there are no roles here. The axis is which BUILD you are looking at, so
 * the owner keeps these tools on `BL Staging` (where he tests) and a parent never sees them.
 */
export const showDevTools = (): boolean =>
  // `?hidetools=1` (dev/harness only) forces the production shape so it can actually be verified —
  // see devHarness. It can only ever turn tools OFF, never on.
  !devHideTools() && showsDevTools(BL_TIER, DEV, false)
