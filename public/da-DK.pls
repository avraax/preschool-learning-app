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

</lexicon>
