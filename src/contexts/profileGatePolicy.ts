// Pure decision for WHICH onboarding surface the profile gate shows — none, the picker, or the
// mandatory "add a child" dialog.
//
// Same directory, same shape and the same reason as authGatePolicy.ts and audioPromptPolicy.ts: this is
// three booleans that are easy to get wrong inside a component and impossible to get wrong here. It was
// extracted after the condition WAS wrong in a way no test could see.
//
// THE RULE THAT WAS MISSING: "no children" and "we have not asked yet" are different states, and only
// the first may raise an un-dismissible dialog.
//
//   * The roster is hydrated from a localStorage cache, so a cold boot starts with `profiles: []`.
//   * `utils/storageReset.ts` deliberately wipes that cache once per device for the accounts release.
//   * So on the first sign-in of this build, an account whose children were created on ANOTHER device
//     starts at `profiles: []` — and the old condition read that as "this family has no children" and
//     raised the mandatory create dialog for the length of a network round trip. On a slow connection an
//     adult can act on it and create a duplicate child.
//
// `rosterSettled` is the fix: it is true once a roster refresh has ANSWERED, either way.

import type { AccountState } from '../services/profileStore.ts'

export type ProfileGateSurface = 'none' | 'picker' | 'create'

/** What the gate must render. `creating` = the adult asked for the create dialog deliberately. */
export function profileGateSurface(
  account: Pick<AccountState, 'status' | 'profiles' | 'rosterSettled'>,
  creating = false,
): ProfileGateSurface {
  // An explicit request wins: the adult tapped "Lav en ny profil" and is owed the dialog.
  if (creating) return 'create'
  if (account.status === 'signed-out') return 'none'
  // MANDATORY: a real, answered, empty roster. There is nobody to play as.
  if (account.rosterSettled && account.profiles.length === 0) return 'create'
  // More than one child and none chosen ⇒ "Hvem spiller?". One child boots straight in, which is what
  // keeps "the child never sees a login screen" true.
  if (account.status === 'choosing' && account.profiles.length > 0) return 'picker'
  return 'none'
}

/** True for the surfaces that must claim `authUiOpen` (they block, so the audio modal stands down). */
export const profileGateBlocks = (surface: ProfileGateSurface): boolean => surface !== 'none'
