<?xml version="1.0" encoding="UTF-8"?>
<!--
  Danish pronunciation lexicon (W3C PLS 1.0) for Azure AI Speech.

  Referenced from SSML via <lexicon uri="https://<app-host>/da-DK.pls"/>. The app serves this
  file from /public, so once deployed it is reachable at e.g.
  https://preschool-learning-app.vercel.app/da-DK.pls and the server auto-derives that URL from
  the request host (see shared-azure-tts.js -> lexiconUriForRequest). Set AZURE_LEXICON_URI to
  override. (Azure cannot fetch http://localhost, so the lexicon is skipped in local dev.)

  HOW TO EXTEND (owner workflow - PRD section 8):
    1. In /voicelab, toggle "Udtale-leksikon" off/on to A/B a word on the chosen voice.
    2. For any word that sounds wrong, add a <lexeme> below with the correct IPA.
    3. grapheme matching is CASE-SENSITIVE; the app speaks word content in lowercase.
    4. Letter NAMES are handled in code (getDanishLetterName), so they do NOT need entries here.
    5. STOD: use the symbol U+0294 (LATIN LETTER GLOTTAL STOP), e.g. "hun" + that symbol. Azure
       da-DK REJECTS the look-alike U+02C0 modifier letter ("Unknown phoneme"). Verified-OK da-DK
       IPA symbols include the stod glottal stop, soft-d, the uvular r, the open-o, and primary
       stress. A SINGLE rejected phoneme can fail SSML parsing, so only use verified symbols.
    6. Keep this file UTF-8. Limits: 30 KB (F0 tier); one locale per file; chars are not billed.

  Ships intentionally minimal: only well-established fixes. Expand from the audition defect list.
-->
<lexicon version="1.0" xmlns="http://www.w3.org/2005/01/pronunciation-lexicon"
         alphabet="ipa" xml:lang="da-DK">

  <!-- "hund" (dog) carries stod; without it Azure can read it like "hun" (she).
       Uses the U+0294 glottal stop, the stod symbol Azure da-DK accepts (verified). -->
  <lexeme><grapheme>hund</grapheme><phoneme>hunʔ</phoneme></lexeme>

  <!-- "fire" (4) is a HOMOGRAPH with English "fire", and Azure da-DK code-switches on it: the owner
       heard Plus Opgaver ask "Hvad er FIRE plus to" with the burning kind (2026-09-05, on the
       production TestFlight build).

       AUDITIONED BEFORE THIS ENTRY EXISTED (scripts/audition-fire.mjs), and the result is why the fix
       is a lexeme rather than a rephrasing:
         * the BARE word "fire" was already correct — so this is not a spelling problem in isolation
         * only the SENTENCE was wrong — the context is what demotes it
         * an inline <phoneme> with this IPA fixed the sentence
       That last point matters, because audio-system.md's general rule says a context-driven misread
       usually CANNOT be respelled. Here it can, and the audition is the evidence. A lexeme applies to
       the grapheme everywhere, so it fixes the 123 sentence clips without harming the 2 bare ones.

       ˈfiːʌ was auditioned too and the owner judged it equally good; ˈfiːɐ is kept as the more
       standard transcription of the Danish soft final vowel. Recorded so neither looks like a typo.

       Rejected: "Hvad er fire, plus to" (comma phrasing) — it works, but it changes the LINE, which
       would alter the prompt for every addition/subtraction question rather than fixing one word. -->
  <lexeme><grapheme>fire</grapheme><phoneme>ˈfiːɐ</phoneme></lexeme>

</lexicon>
