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

  <!-- "fly" (aeroplane) is the SAME code-switch class as "fire" above, caught the same way: the owner
       heard the sticker ceremony say "Nyt klistermærke! Fly" with the English verb (2026-09-06).

       MEASURED before the entry existed, with the calibrated control the `fire` incident bought:
         * forcing a Danish IPA onto "fire" is byte-IDENTICAL to the live output — the lexeme above
           already fixes it, which proves the method can tell "already right" from "wrong"
         * forcing one onto "Fly" is DIFFERENT, in BOTH lines that say it ("Nyt klistermærke! Fly" and
           the bare "Fly" tapped in Min Bog) — so Azure's default is not the Danish reading
       Two clips, no more: `collectNarrationClips()` was grepped rather than guessed at.

       THE VOWEL IS /y/, NOT /iː/. Danish `y` is the close front ROUNDED vowel, so "fly" rhymes with
       ny/by — [flyʔ]. Written down because the first attempt at this entry used ˈfliːʔ ("flee"), which
       is a plausible-looking transcription and simply wrong; it was caught only because the candidates
       went past the owner's ear. Same U+0294 stød as `hund` above.

       WHY IT WAS MISSED FOR SO LONG: `scripts/audition-homographs.mjs` exists to catch exactly this and
       did not contain `fly`. Its candidate list had been built from words appearing in QUIZ sentences,
       and sticker labels are narrated too (`rewardLine(label)`) — a whole spoken surface outside the
       sweep. The list now includes the sticker labels that are also English words. -->
  <lexeme><grapheme>fly</grapheme><phoneme>flyʔ</phoneme></lexeme>

</lexicon>
