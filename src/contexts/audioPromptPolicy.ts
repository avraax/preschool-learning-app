// Pure decision for whether the big blocking "Tænd for lyd" permission modal should (re)appear.
// Extracted from SimplifiedAudioContext so the iOS re-arm bug is unit-testable.
//
// The bug it fixes: on iOS the AudioContext routinely flips to suspended/interrupted right after the
// unlock gesture, which sets needsUserAction=true / isWorking=false again. If the modal keyed only on
// those two, it re-popped 1.5s after every dismiss — so neither "Start lyd nu" nor the ✕ could keep
// it closed. Once audio has unlocked once OR the user has closed it, we must never auto-re-show it;
// silent recovery on the next interaction handles later suspensions.
export interface AudioPromptInputs {
  needsUserAction: boolean
  isWorking: boolean
  hasUnlockedOnce: boolean // audio has successfully unlocked at least once this session
  userDismissed: boolean // the user explicitly closed the modal (button or ✕) this session
}

export function shouldShowAudioPrompt(s: AudioPromptInputs): boolean {
  return s.needsUserAction && !s.isWorking && !s.hasUnlockedOnce && !s.userDismissed
}
