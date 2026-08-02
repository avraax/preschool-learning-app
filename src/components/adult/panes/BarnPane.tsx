// "Barn" — everything about the child who is playing (Settings PRD-01 §3 row 1).
//
// ABSORBS three of the old flat rows: "Profiler", "Skift barn" and "Nulstil al fremgang". They were
// scattered across the menu even though all three act on the same subject; NN/g's rule is that a
// control belongs next to the content it relates to, which is also why the progress reset moved here
// from beside the ACCOUNT actions.
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
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  Divider,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import { Check, CircleCheck, Pencil, RotateCcw, Trash2, UserPlus } from 'lucide-react'
import { useAuthContext } from '../../../contexts/AuthContext'
import { useProfiles } from '../../../hooks/useProfiles'
import { useProgress } from '../../../hooks/useProgress'
import { profileStore } from '../../../services/profileStore'
import { avatarArt } from '../../../assets/avatars'
import { REWARD_SLOTS } from '../../../config/stickers'
import { SECTION_LABELS } from '../../../config/adultSectionLabels'
import { adultItem } from '../../../config/adultSettingsIa'
import type { SectionId } from '../../../services/progressStore'
import { AppSkin } from '../../../theme/adultTheme'
import CreateProfileDialog from '../../auth/CreateProfileDialog'
import DestructiveConfirmDialog from './DestructiveConfirmDialog'
import { DangerHeading, PaneSection } from './paneParts'

// Read the required words from the IA declaration rather than typing them here — that module is what
// `adultSettingsIa.test.ts` asserts on, and a hardcoded duplicate would let the guard pass while the
// shipped dialog demanded something else.
const RESET_WORD = adultItem('barn.reset').typeToConfirm!
const DELETE_WORD = adultItem('barn.delete').typeToConfirm!

const SECTION_IDS: SectionId[] = ['alphabet', 'math', 'colors', 'english', 'ordleg']

export interface BarnPaneProps {
  /** Close the whole settings surface — switching child re-attaches the store under the new profile. */
  closeAll: () => void
}

const BarnPane: React.FC<BarnPaneProps> = ({ closeAll }) => {
  const theme = useTheme()
  const auth = useAuthContext()
  const account = useProfiles()
  const progress = useProgress()

  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [resetDone, setResetDone] = useState(false)
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

  const doDelete = useCallback(
    async (id: string) => {
      // Deleting drops this device's local copy of that child's book (the server delete is soft), so
      // the LOCAL verifier is the right authority — same blast radius as a reset, and it still works
      // offline. Inside the adult's ~5-minute window this costs no extra tap.
      if (auth) {
        const ok = await auth.requirePin('resetProgress')
        if (!ok) return
      }
      setBusy(true)
      await profileStore.deleteProfile(id)
      setBusy(false)
      setConfirmDelete(null)
    },
    [auth],
  )

  // ---- "Sådan går det" — every number DERIVED, nothing stored ----------------------------------
  const collected = progress.rewardNumber()
  const next = progress.nextReward()
  const played = SECTION_IDS.filter(
    (s) =>
      progress.bloomFor(s).xp > 0 ||
      (progress.state.progression.explored[s]?.length ?? 0) > 0,
  )

  const deleteTarget = account.profiles.find((p) => p.id === confirmDelete)

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
                      <IconButton
                        aria-label={`Slet ${p.name || 'barn'}`}
                        color="error"
                        onClick={() => setConfirmDelete(p.id)}
                        disabled={busy || account.profiles.length <= 1}
                      >
                        <Trash2 size={17} />
                      </IconButton>
                    </>
                  )}
                </Box>
              )
            })}
          </Stack>
          <Button
            onClick={() => setCreating(true)}
            aria-label="Tilføj et barn"
            startIcon={<UserPlus size={17} />}
            sx={{ mt: 1 }}
          >
            Tilføj et barn
          </Button>
        </PaneSection>

        {/* ---- Destructive strip (§7): per-child, so it sits next to the child ---- */}
        <Box>
          <Divider sx={{ mb: 1.25 }} />
          <DangerHeading />
          <Button
            color="error"
            aria-label="Nulstil al fremgang"
            startIcon={<RotateCcw size={17} />}
            onClick={() => setConfirmReset(true)}
          >
            {activeName ? `Nulstil fremgang for ${activeName}` : 'Nulstil fremgang'}
          </Button>
        </Box>
      </Stack>

      {/* CreateProfileDialog is shared with the boot picker and deliberately keeps the APP skin (§5). */}
      <AppSkin>
        <CreateProfileDialog
          open={creating}
          onDone={() => setCreating(false)}
          onCancel={() => setCreating(false)}
        />
      </AppSkin>

      <DestructiveConfirmDialog
        open={!!confirmDelete}
        title={deleteTarget?.name ? `Slet ${deleteTarget.name}?` : 'Slet barnet?'}
        word={DELETE_WORD}
        actionLabel="Slet"
        busy={busy}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && void doDelete(confirmDelete)}
      >
        {/* "Kontakt os", not "Skriv til os" — the dialog now asks the adult to SKRIVE a word, and two
            different senses of that verb in one box reads as an instruction. */}
        {deleteTarget?.name ? `${deleteTarget.name}s bog` : 'Barnets bog'} og rekorder fjernes fra
        denne enhed. Kontakt os hvis det var et uheld — vi gemmer det stadig på serveren et stykke tid.
      </DestructiveConfirmDialog>

      {/* The PIN already opened this surface, so this is the "are you sure" — but it still routes
          through requirePin('resetProgress'), which re-asks if the ~5-minute window has lapsed. */}
      <DestructiveConfirmDialog
        open={confirmReset}
        // Reset is PER CHILD, so the copy must NAME the child or a parent nukes the wrong kid's book.
        title={activeName ? `Nulstil fremgang for ${activeName}?` : 'Nulstil fremgang?'}
        word={RESET_WORD}
        actionLabel="Nulstil"
        onCancel={() => setConfirmReset(false)}
        onConfirm={async () => {
          if (auth) {
            const ok = await auth.requirePin('resetProgress')
            if (!ok) return
          }
          progress.resetAll()
          setConfirmReset(false)
          setResetDone(true)
        }}
      >
        Dette nulstiller <strong>alle</strong> {activeName ? `${activeName}s ` : ''}klistermærker,
        rekorder og stjerner. Andre børn røres ikke. Lyd, musik og sværhedsgrad beholdes.
      </DestructiveConfirmDialog>

      <Dialog open={resetDone} onClose={() => setResetDone(false)} maxWidth="xs" fullWidth>
        <DialogContent sx={{ textAlign: 'center', py: 4 }}>
          <Typography component="div" sx={{ color: 'success.main', mb: 1, lineHeight: 0 }}>
            <CircleCheck size={36} aria-hidden />
          </Typography>
          <Typography sx={{ fontWeight: 700 }}>Al fremgang er nulstillet.</Typography>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center' }}>
          <Button onClick={() => setResetDone(false)} variant="contained" aria-label="Færdig">
            Færdig
          </Button>
        </DialogActions>
      </Dialog>
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

export default BarnPane
