// The sign-in offer — §3.1 of the Familie IA PRD, and the ONLY place it now appears.
//
// It used to appear TWICE: a `Log ind` promo row pinned above the rail, and a `Konto` rail entry whose
// pane opened with `if (guest) return <this>`. Two doors, one room. The promo row is deleted; this is
// what is left, and it now sits at the TOP of the Familie pane where iOS puts the Apple Account row.
//
// EVERY WORD IS UNCHANGED, deliberately — `.claude/rules/adult-surface.md` §"The account offer" records
// why each line is there and the PRD puts re-litigating it out of scope. The one thing that MOVED is
// the progress-aware sticker count (`promoHint`), which lived on the deleted rail row: it is the
// endowed-progress lever, it is the only concrete number in the offer, and it belongs at the CTA.

import React, { useCallback, useState } from 'react'
import { Box, Button, Stack, Typography } from '@mui/material'
import { Mic, ShieldCheck, TabletSmartphone, Users } from 'lucide-react'
import { startSocialSignIn, type SignInProvider } from '../../../../services/authSignIn'
import { useSignUpProviders } from '../../../../services/signUpProviders'
import { useProgress } from '../../../../hooks/useProgress'
import { PaneSection } from '../paneParts'

/**
 * One "what an account buys you" line: the `LinkRow` shape from `PrivatlivPane` with the chevron and
 * the `onClick` removed, because these are STATEMENTS. Not a `Button`, so it never lands in the tab
 * order between the adult and the sign-in button below it. The icon is decorative — the text carries
 * the meaning.
 *
 * TITLE + HINT, not one line. The first version stated four FEATURES ("Fremgangen følger med til jeres
 * andre enheder"), and a feature is only persuasive to someone who already has the thing it needs — one
 * child on one iPad, which is the median install, matched none of them. The hint carries the OUTCOME,
 * which is the half that answers "why would I?".
 */
const BenefitRow: React.FC<{ icon: React.ReactNode; title: string; hint: string }> = ({
  icon,
  title,
  hint,
}) => (
  <Box sx={{ display: 'flex', alignItems: 'flex-start', py: 0.75 }}>
    <Box sx={{ display: 'flex', color: 'text.secondary', mr: 1.5, pt: 0.25 }}>{icon}</Box>
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography sx={{ fontSize: '0.95rem', fontWeight: 600 }}>{title}</Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', lineHeight: 1.45 }}>
        {hint}
      </Typography>
    </Box>
  </Box>
)

const SignInOffer: React.FC = () => {
  const signUpProviders = useSignUpProviders()
  const progress = useProgress()
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  /**
   * From the UNAUTHENTICATED providers endpoint, not `auth.info.methods` — a guest has no session,
   * so `info` is null here and the Apple button would never render on the one pane that offers it.
   */
  const appleAvailable = signUpProviders.includes('apple')

  // THE OFFER GETS CONCRETE ONCE THERE IS SOMETHING TO LOSE. An identical pitch at 0 rewards and at 40
  // wastes the one moment it is strongest: the endowed-progress effect is why "save your progress"
  // outperforms "create an account", and naming the real number is what makes it land.
  //
  // This is the ONLY place that lever can be pulled. The owner's constraint is that nothing
  // adult-directed appears in front of the parental gate (Kids Guideline 1.3), so a timed prompt during
  // play is out — but the adult is already standing in the adult area, which is fair game.
  //
  // `rewardNumber()` is THE child-facing count (`.claude/rules/rewards-and-progression.md`): never
  // `globalLevel()`, and never as a distance — no "n af 90" on this line.
  //
  // Klistermærker is the ONLY thing left to name: `PerGameStats` and `totals.totalStars` were deleted
  // by Endless Play PRD-01, so "og alle rekorder" would promise to save a thing the app no longer has.
  const rewards = progress.rewardNumber()
  const askLine =
    rewards === 0
      ? 'Så bogen ikke kun ligger på denne iPad'
      : rewards === 1
        ? 'Gem barnets første klistermærke'
        : `Gem barnets ${rewards} klistermærker`

  // `startGoogleSignIn()` returns a `SignInResult` and this call site used to discard it, so a failure
  // showed the adult nothing at all — the button simply did nothing. The lock screen has always
  // surfaced `result.message` (`LockScreen.tsx:128-134`); this mirrors it.
  // `finally`, not a trailing `setBusy(false)`: a throw would otherwise leave the button disabled
  // with no message — a dead grey control, which is strictly worse than the silent one this replaced.
  // It does NOT cover a HANG (report BV9DJ: the shell's `startGoogleSignIn` never settled), and no
  // timeout can — on the web the call deliberately never resolves, because `location.assign` has
  // navigated away by then. A promise that never settles has to be fixed where it hangs.
  const onGuestSignIn = useCallback(async (provider: SignInProvider) => {
    setMessage(null)
    setBusy(true)
    try {
      const result = await startSocialSignIn(provider)
      if (!result.ok) setMessage(result.message ?? 'Login mislykkedes. Prøv igen.')
    } catch {
      setMessage('Login mislykkedes. Prøv igen.')
    } finally {
      setBusy(false)
    }
  }, [])

  return (
    <Stack spacing={2.5}>
      {/* `caps={false}`: this is a sentence, and the small-caps eyebrow renders a sentence as
          shouting. The pane header above it reads "Familie". */}
      <PaneSection title="I spiller uden konto" caps={false}>
        <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6 }}>
          Barnets bog ligger kun her på iPad&apos;en. Der er ingen kopi andre steder.
        </Typography>
      </PaneSection>

      {/* Statements, not links — no chevron, no onClick, no Button wrapper, which also keeps them out
          of the tab order. Face ID and passkeys are deliberately ABSENT: the shell's
          `capacitor://localhost` origin can never satisfy the `boernelaering.dk` rpID, and the
          signed-in sections already say so. Google or the code, nothing else.

          THE ORDER IS THE ARGUMENT. Sync, multiple children and the microphone game are all
          conditional on something a new user may not have — one child on one iPad matches none of
          them, and that is the median install (and the owner's own household). "Bogen er sikret" is
          the only line true for EVERY family, so it leads. It is also the honest one: today a guest
          book dies with the iPad, silently.

          Do NOT reword this into "din fremgang gemmes ikke". It IS saved — it is UNCOPIED, and the
          distinction is the whole point. */}
      <PaneSection title="Med en konto">
        <Stack spacing={0}>
          <BenefitRow
            icon={<ShieldCheck size={19} aria-hidden />}
            title="Bogen er sikret"
            hint="Klistermærkerne er der stadig, hvis iPad'en bliver nulstillet eller skiftet ud."
          />
          <BenefitRow
            // Two devices, not one: a lone `Tablet` rendered as a featureless rectangle beside a
            // line that is specifically about a SECOND device.
            icon={<TabletSmartphone size={19} aria-hidden />}
            title="Den samme bog på flere enheder"
            hint="Barnet kan spille videre på fx en telefon."
          />
          <BenefitRow
            icon={<Users size={19} aria-hidden />}
            title="Plads til flere børn"
            hint="Hvert barn får sin egen bog og sin egen sværhedsgrad."
          />
          <BenefitRow
            icon={<Mic size={19} aria-hidden />}
            title="Mikrofonspillet kan slås til"
            hint={'"Sig et Ord" kræver en konto.'}
          />
        </Stack>
        {/* The moved `promoHint`. It sits AT the ask rather than in the argument above it, because the
            number is what makes the ask concrete — see the comment on `askLine`. */}
        <Typography sx={{ mt: 2, fontWeight: 600, fontSize: '0.95rem' }}>{askLine}</Typography>
        <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap', gap: 1 }}>
          <Button
            variant="contained"
            onClick={() => void onGuestSignIn('google')}
            disabled={busy}
            aria-label="Log ind med Google"
            sx={{ minHeight: 44 }}
          >
            Log ind med Google
          </Button>
          {/* Apple appears only when the server says it is configured (`/family/status` methods).
              Required by App Store Guideline 4.8, which wants a second option collecting no more
              than name + email and allowing the address to be kept private, whenever a third-party
              service sets up the primary account. Passkeys do NOT satisfy it — they can only unlock
              an account that already exists. */}
          {appleAvailable && (
            <Button
              variant="outlined"
              onClick={() => void onGuestSignIn('apple')}
              disabled={busy}
              aria-label="Log ind med Apple"
              sx={{ minHeight: 44 }}
            >
              Log ind med Apple
            </Button>
          )}
        </Stack>
        {message && (
          <Typography role="status" variant="body2" sx={{ display: 'block', fontWeight: 600, mt: 1 }}>
            {message}
          </Typography>
        )}
        {/* THE OBJECTION-REMOVER, and it belongs at the moment of the ask rather than one pane away
            in Privatliv. Cost and data handling are the dominant parental worry for a children's app,
            and this one is genuinely clean — so saying so is not a boast, it is the answer to the
            question the adult is already asking.

            EVERY CLAUSE MUST STAY TRUE. No ads, no analytics/tracking, no in-app purchases, and no
            marketing email — all four are load-bearing claims, mirrored in PrivatlivPane and in the
            App Store description. If any of them ever stops being true, this line goes first. */}
        <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 1.5 }}>
          Gratis. Ingen reklamer, ingen sporing — og vi skriver aldrig til dig.
        </Typography>
        <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 0.5 }}>
          Fremgangen fra denne iPad kan følge med til det første barn, du opretter.
        </Typography>
      </PaneSection>
    </Stack>
  )
}

export default SignInOffer
