// "Profiler" — add / rename / delete children, and switch between them.
//
// Switching MID-SESSION is PIN-gated (`requirePin('switchProfile')` — LOCAL, so it works on a plane,
// because the blast radius is this device's own state). Picking at BOOT is not gated: a child choosing
// their own avatar is the point (accounts PRD §7.2 / §7.4).
//
// Deletion is soft on the server, so an accidental "Slet" stays recoverable — but it does drop this
// device's local copy of that child's book, so it is behind its own confirmation.

import React, { useCallback, useEffect, useState } from 'react'
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemText,
  TextField,
  Typography,
} from '@mui/material'
import { Check, Pencil, Trash2 } from 'lucide-react'
import { useAuthContext } from '../../contexts/AuthContext'
import { useProfiles } from '../../hooks/useProfiles'
import { profileStore } from '../../services/profileStore'
import CreateProfileDialog from '../auth/CreateProfileDialog'
import { avatarArt } from '../../assets/avatars'

export interface ProfilesPanelProps {
  open: boolean
  onClose: () => void
}

const ProfilesPanel: React.FC<ProfilesPanelProps> = ({ open, onClose }) => {
  const auth = useAuthContext()
  const account = useProfiles()
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) void profileStore.refreshRoster()
  }, [open])

  const onSwitch = useCallback(
    async (id: string) => {
      if (!auth || id === account.activeProfileId) return
      const ok = await auth.requirePin('switchProfile')
      if (!ok) return
      profileStore.selectProfile(id)
      onClose()
    },
    [auth, account.activeProfileId, onClose],
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

  const doDelete = useCallback(async (id: string) => {
    setBusy(true)
    await profileStore.deleteProfile(id)
    setBusy(false)
    setConfirmDelete(null)
  }, [])

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Profiler</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
            Hvert barn har sin egen bog, sine egne rekorder og sin egen sværhedsgrad.
          </Typography>
          {account.error && (
            <Typography role="alert" color="error" sx={{ mb: 1.5, fontWeight: 600 }}>
              {account.error}
            </Typography>
          )}

          <List sx={{ py: 0 }}>
            {account.profiles.map((p) => {
              const isActive = p.id === account.activeProfileId
              return (
                <ListItem
                  key={p.id}
                  data-profile-row={p.id}
                  sx={{ px: 0, gap: 1, minHeight: 56 }}
                  secondaryAction={
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <IconButton
                        aria-label={`Omdøb ${p.name || 'barn'}`}
                        onClick={() => {
                          setEditingId(p.id)
                          setDraftName(p.name ?? '')
                        }}
                        disabled={busy}
                      >
                        <Pencil size={18} />
                      </IconButton>
                      <IconButton
                        aria-label={`Slet ${p.name || 'barn'}`}
                        color="error"
                        onClick={() => setConfirmDelete(p.id)}
                        disabled={busy || account.profiles.length <= 1}
                      >
                        <Trash2 size={18} />
                      </IconButton>
                    </Box>
                  }
                >
                  <Box
                    component="img"
                    src={avatarArt(p.avatarId)}
                    alt=""
                    draggable={false}
                    sx={{ width: 40, height: 40, objectFit: 'contain', userSelect: 'none', flex: '0 0 auto' }}
                  />
                  {editingId === p.id ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flex: 1 }}>
                      <TextField
                        size="small"
                        value={draftName}
                        onChange={(e) => setDraftName(e.target.value)}
                        sx={{ '& input': { userSelect: 'text', WebkitUserSelect: 'text' } }}
                        slotProps={{ htmlInput: { 'aria-label': 'Fornavn', maxLength: 24 } }}
                      />
                      <IconButton
                        aria-label="Gem navnet"
                        onClick={() => void saveName(p.id)}
                        disabled={busy}
                      >
                        <Check size={18} />
                      </IconButton>
                    </Box>
                  ) : (
                    <ListItemText
                      primary={p.name || '—'}
                      secondary={isActive ? 'Spiller nu' : undefined}
                      onClick={() => void onSwitch(p.id)}
                      sx={{ cursor: isActive ? 'default' : 'pointer' }}
                    />
                  )}
                </ListItem>
              )
            })}
          </List>

          <Button
            onClick={() => setCreating(true)}
            aria-label="Tilføj et barn"
            sx={{ mt: 1, textTransform: 'none' }}
          >
            Tilføj et barn
          </Button>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} aria-label="Luk">
            Luk
          </Button>
        </DialogActions>
      </Dialog>

      <CreateProfileDialog
        open={creating}
        onDone={() => setCreating(false)}
        onCancel={() => setCreating(false)}
      />

      <Dialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Slet barnet?</DialogTitle>
        <DialogContent>
          <Typography>
            Barnets bog og rekorder fjernes fra denne enhed. Skriv til os hvis det var et uheld — vi
            gemmer det stadig på serveren et stykke tid.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(null)} aria-label="Annullér">
            Annullér
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => confirmDelete && void doDelete(confirmDelete)}
            disabled={busy}
            aria-label="Slet"
          >
            Slet
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

export default ProfilesPanel
