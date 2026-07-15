# Narration audit (PRD-11)

The `/audit` harness (dev-only route, `src/components/audit/`) plays every clip in the closed
narration set so a native Danish ear can flag each **OK / wrong** and capture a verdict + note. It is
the systematic discovery mechanism for the pronunciation audit and stays useful for re-verification
after fixes.

## How to run it

1. Start both dev servers (Windows PowerShell, not WSL):
   - `npm run dev:api` (Azure TTS proxy on :3001 — needs `.env.local` creds for **live** playback)
   - `npm run dev` (Vite on :5173)
2. Open <http://localhost:5173/audit>.
3. Listen through each group. For every clip: **✓ OK** or **✗ Fejl**, plus a note and (optionally) a
   candidate IPA / respelling.

Prebaked `.ogg` playback (the default — "as the child hears it") works without Azure creds. The
**Tving live**, **lex ✗**, **alt. stemme**, and **candidate IPA** controls call Azure and need creds.

## Where verdicts live (three layers, PRD-11 §3.5)

- **localStorage** (`bornelaering-narration-audit-v1`) — instant, per-browser scratch.
- **Download JSON** — a portable snapshot.
- **Committed checklist** — the harness auto-saves to the dev-server (`POST /api/audit-save`), which
  writes this folder:
  - `narration-audit.json` — machine source of truth (keyed by TTS cache key).
  - `narration-audit.md` — a git-reviewable rendered summary.

  These two files are generated (do not hand-edit) and are the seed of the audited-OK manifest +
  regression guard in PRD-11 §6.

## Groups

Letters (29) · Numbers (0–100 at 1.05× and 1.2×) · Phrases (success / encouragement / score / game
titles) · Colours (hues / shades / object lines) · Mixed (sticker reveals + representative dynamic
math facts, score lines, colour-mix reveals) · English (all words).

The closed (prebaked) set comes from the shared enumerator `shared-narration-clips.js` — the exact
list `prebake-tts.mjs` bakes — so each row maps 1:1 to a prebaked file (or is flagged **dynamic /
live-only**).
