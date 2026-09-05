// "Børn" — who is playing, how it is going, and the roster (Familie IA PRD §3.2).
//
// This is the old `BarnPane` minus its destructive strip: `Nulstil fremgang` and `Slet barnet` moved
// into the `Farligt for {navn}` block at the bottom of the merged pane (§3.5). The per-row BIN went
// with them — it sat one control away from the rename pencil on adjacent rows, which is exactly the
// adjacency NN/g warns about, and "delete" was never in this section's job description.
//
// ABSORBED three of the old flat rows: "Profiler", "Skift barn" and "Nulstil al fremgang". They were
// scattered across the menu even though all three act on the same subject; NN/g's rule is that a
// control belongs next to the content it relates to, which is also why the progress reset moved here
// from beside the ACCOUNT actions — and now, one merge later, they are in the same pane.
//
// "Skift barn" is absorbed rather than kept: the old top-level row called `profileStore.clearSelection()`
// un-gated, which raised the boot picker. Tapping another child here switches directly via
// `requirePin('switchProfile')` — the rule ProfilesPanel already applied. The un-gated BOOT path
// (ProfilePicker, raised by ProfileGate) is untouched; only the mid-session shortcut goes away, and it
// lived inside a PIN-gated surface anyway.
//
// "Sådan går det" is READ-ONLY and fully DERIVED — no new state, no new persistence — and it is THREE
// ROWS on purpose: how far he is, what is next, what he has played. That is what a parent asks.
//
// It is the one place the DISTANCE legitimately belongs (Reward Horizon PRD-01 §4.6) — the parent is
// the literate party, and "6 af 72" is exactly what the child-facing surfaces must never show. The
// count is `progressStore.rewardNumber()` (rewards HANDED OVER), never
// `collectedFromLevel(globalLevel())`, which is the debt CEILING and reads one ahead of the book while
// a ceremony is pending.
//
// **Do not put `globalLevel()` back here.** §4.6 asked for a "Niveau" row and it shipped for exactly
// one review cycle: level 1 is an empty book, so the level is ALWAYS stickers + 1 and can never agree
// with the number beside it or with the ring in the corner. The owner read it as a bug within seconds
// of seeing "6" in the ring and "Niveau 7" in the pane — which is the same off-by-one this PRD spent
// its whole design removing from the child's side. `Samlet XP` (no scale a parent can read),
// `Stjerner i alt` (≈ rounds played, so near-duplicate) and a per-section bloom row (five numbers on
// an unlabelled 0-4 scale) went with it. All four are still one `progress.*` call away if a future
// diagnostic surface needs them; none belongs on the page a parent opens.

import React, { useCallback, useEffect, useState } from 'react'
import { Box, Button, Divider, IconButton, Stack, TextField, Typography } from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import { Check, Pencil, UserPlus } from 'lucide-react'
import { useAuthContext } from '../../../../contexts/AuthContext'
import { useProfiles } from '../../../../hooks/useProfiles'
import { useProgress } from '../../../../hooks/useProgress'
import { profileStore } from '../../../../services/profileStore'
import { avatarArt } from '../../../../assets/avatars'
import { REWARD_SLOTS } from '../../../../config/stickers'
import { SECTION_LABELS } from '../../../../config/adultSectionLabels'
import type { SectionId } from '../../../../services/progressStore'
import { AppSkin } from '../../../../theme/adultTheme'
import CreateProfileDialog from '../../../auth/CreateProfileDialog'
import { PaneSection } from '../paneParts'

const SECTION_IDS: SectionId[] = ['alphabet', 'math', 'colors', 'english', 'ordleg']

export interface BoernSectionProps {
  /** Close the whole settings surface — switching child re-attaches the store under the new profile. */
  closeAll: () => void
}

const BoernSection: React.FC<BoernSectionProps> = ({ closeAll }) => {
  const theme = useTheme()
  const auth = useAuthContext()
  const account = useProfiles()
  const progress = useProgress()
  /** No account: child profiles are the account feature, so "Tilføj et barn" cannot succeed here. */
  const guest = auth?.phase === 'guest'

  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void profileStore.refreshRoster()
  }, [])

  const active = account.profiles.find((p) => p.id === account.activeProfileId)
  const activeName = active?.name

  const onSwitch = useCallback(
    async (id: string) => {
      if (!auth || id === account.activeProfileId) return
      const ok = await auth.requirePin('switchProfile')
      if (!ok) return
      profileStore.selectProfile(id)
      closeAll()
    },
    [auth, account.activeProfileId, closeAll],
  )

  const saveName = useCallback(
    async (id: string) => {
      setBusy(true)
      await profileStore.updateProfile(id, { name: draftName.trim() || null })
      setBusy(false)
      setEditingId(null)
    },
    [draftName],
  )

  // ---- "Sådan går det" — every number DERIVED, nothing stored ----------------------------------
  const collected = progress.rewardNumber()
  const next = progress.nextReward()
  const played = SECTION_IDS.filter(
    (s) =>
      progress.bloomFor(s).xp > 0 ||
      (progress.state.progression.explored[s]?.length ?? 0) > 0,
  )

  return (
    <>
      <Stack spacing={2.5}>
        {/* ---- Who is playing, and how it is going ---- */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            p: 1.5,
            borderRadius: 2,
            bgcolor: alpha(theme.palette.primary.main, 0.07),
          }}
        >
          {active && (
            <Box
              component="img"
              src={avatarArt(active.avatarId)}
              alt=""
              draggable={false}
              sx={{ width: 56, height: 56, objectFit: 'contain', userSelect: 'none', flex: '0 0 auto' }}
            />
          )}
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 700, fontSize: '1.1rem' }}>
              {activeName || 'Ingen valgt'}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Spiller nu
            </Typography>
          </Box>
        </Box>

        <PaneSection title="Sådan går det">
          <SummaryRow label="Klistermærker" value={`${collected} af ${REWARD_SLOTS}`} />
          <SummaryRow label="Næste belønning" value={next ? next.reward.label : 'Bogen er fuld'} />
          <SummaryRow
            label="Har spillet"
            value={played.length ? played.map((s) => SECTION_LABELS[s]).join(' · ') : 'Ikke begyndt endnu'}
          />
        </PaneSection>

        {/* ---- The roster ---- */}
        <PaneSection
          title="Børn"
          hint="Hvert barn har sin egen bog, sine egne rekorder og sin egen sværhedsgrad."
        >
          {account.error && (
            <Typography role="alert" color="error" sx={{ mb: 1, fontWeight: 600, fontSize: '0.85rem' }}>
              {account.error}
            </Typography>
          )}
          <Stack divider={<Divider flexItem />}>
            {account.profiles.map((p) => {
              const isActive = p.id === account.activeProfileId
              const editing = editingId === p.id
              return (
                <Box
                  key={p.id}
                  data-profile-row={p.id}
                  sx={{ display: 'flex', alignItems: 'center', gap: 1, minHeight: 52, py: 0.5 }}
                >
                  <Box
                    component="img"
                    src={avatarArt(p.avatarId)}
                    alt=""
                    draggable={false}
                    sx={{ width: 34, height: 34, objectFit: 'contain', userSelect: 'none', flex: '0 0 auto' }}
                  />
                  {editing ? (
                    <>
                      <TextField
                        size="small"
                        value={draftName}
                        onChange={(e) => setDraftName(e.target.value)}
                        // Page roots set userSelect:none; inheriting that breaks iOS selection/paste.
                        sx={{ flex: 1, '& input': { userSelect: 'text', WebkitUserSelect: 'text' } }}
                        slotProps={{ htmlInput: { 'aria-label': 'Fornavn', maxLength: 24 } }}
                      />
                      <IconButton aria-label="Gem navnet" onClick={() => void saveName(p.id)} disabled={busy}>
                        <Check size={18} />
                      </IconButton>
                    </>
                  ) : (
                    <>
                      <Box
                        component={isActive ? 'div' : 'button'}
                        type={isActive ? undefined : 'button'}
                        onClick={isActive ? undefined : () => void onSwitch(p.id)}
                        aria-label={isActive ? undefined : `Skift til ${p.name || 'barn'}`}
                        sx={{
                          flex: 1,
                          minWidth: 0,
                          textAlign: 'left',
                          border: 'none',
                          background: 'none',
                          font: 'inherit',
                          color: 'inherit',
                          p: 0,
                          minHeight: 44,
                          cursor: isActive ? 'default' : 'pointer',
                        }}
                      >
                        <Typography sx={{ fontWeight: 600, fontSize: '0.95rem' }}>
                          {p.name || '—'}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          {isActive ? 'Spiller nu' : 'Tryk for at skifte'}
                        </Typography>
                      </Box>
                      <IconButton
                        aria-label={`Omdøb ${p.name || 'barn'}`}
                        onClick={() => {
                          setEditingId(p.id)
                          setDraftName(p.name ?? '')
                        }}
                        disabled={busy}
                      >
                        <Pencil size={17} />
                      </IconButton>
                    </>
                  )}
                </Box>
              )
            })}
          </Stack>
          {/* A GUEST IS NOT OFFERED THIS AT ALL (Børn picker PRD-01 §2.8). It used to render with a
              "Kræver en konto" hint that scrolled to the sign-in offer — "say the price before the
              work", which was right while the offer lived in a different rail group. Since the
              Barn+Konto merge that offer is a few centimetres ABOVE this row in the same pane, and its
              `Plads til flere børn` line already says what an account buys, so the row had become a
              second pointer to something already on screen.
              `createProfile`'s own guard stays as the backstop; this was never a substitute for it.

              THIS IS ALSO THE ONLY REMAINING WAY IN. The boot picker's un-gated create button is gone
              (§2.3), so adding a child happens here — behind the parental gate — or through the
              mandatory first-run dialog. Do not re-add one to an un-gated surface. */}
          {!guest && (
            <Button
              onClick={() => setCreating(true)}
              aria-label="Tilføj et barn"
              startIcon={<UserPlus size={17} />}
              sx={{ mt: 1, textAlign: 'left', justifyContent: 'flex-start' }}
            >
              Tilføj et barn
            </Button>
          )}
        </PaneSection>
      </Stack>

      {/* CreateProfileDialog is shared with the boot picker and deliberately keeps the APP skin (§5). */}
      <AppSkin>
        <CreateProfileDialog
          open={creating}
          onDone={() => setCreating(false)}
          onCancel={() => setCreating(false)}
        />
      </AppSkin>
    </>
  )
}

const SummaryRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, minHeight: 30 }}>
    <Typography sx={{ flex: '0 0 auto', width: 132, color: 'text.secondary', fontSize: '0.875rem' }}>
      {label}
    </Typography>
    <Typography sx={{ flex: 1, minWidth: 0, fontWeight: 600, fontSize: '0.9rem' }}>{value}</Typography>
  </Box>
)

export default BoernSection
