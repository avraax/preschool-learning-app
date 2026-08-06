// The privacy policy is a REVIEW REQUIREMENT, not prose (App Store PRD §3.5 / A2), and a requirement
// that lives only in prose cannot be guarded — an edit that tidies away the word "Neon" is invisible.
//
// So each test below pins one thing Apple's guidelines actually demand. Guideline 5.1.4(b): a Kids
// Category app "must include a privacy policy". 5.1.1(i): the policy must identify what is collected,
// confirm that every third party "will provide the same or equal protection of user data", and "Explain
// its data retention/deletion policies and describe how a user can revoke consent". 5.1.2(i): "You must
// clearly disclose where personal data will be shared with third parties, including with third-party
// AI, and obtain explicit permission before doing so."

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  CONTROLLER,
  EQUAL_PROTECTION_DA,
  EQUAL_PROTECTION_EN,
  PRIVACY_DA,
  PRIVACY_EN,
  PROCESSORS,
  SUPPORT_DA,
} from './legalContent.ts'

const SRC = path.join(import.meta.dirname, '..')

/**
 * Section HEADINGS only.
 *
 * Needed because `textOf` below flattens everything, and a heading check against the flattened text is
 * satisfied by ordinary prose: `/Retsgrundlag/` matched the word "Retsgrundlag**et**" inside a bullet,
 * so renaming the section heading kept the guard green. Found by `/re-break`.
 */
const headingsOf = (doc: { sections: { heading: string }[] }): string[] =>
  doc.sections.map((s) => s.heading)

/** Every word of a document, flattened — headings, paragraphs and bullets alike. */
const textOf = (doc: { title: string; intro: string[]; sections: { heading: string; body?: string[]; bullets?: string[] }[] }): string =>
  [
    doc.title,
    ...doc.intro,
    ...doc.sections.flatMap((s) => [s.heading, ...(s.body ?? []), ...(s.bullets ?? [])]),
  ].join('\n')

test('the policy names all four processors, in BOTH languages', () => {
  // PRD §3.5 lists exactly these. Apple never sees the Danish page's contents in review notes, so the
  // English one has to carry the same disclosure — a reviewer reads English.
  const da = textOf(PRIVACY_DA)
  const en = textOf(PRIVACY_EN)
  for (const needle of ['Google Cloud Speech-to-Text', 'Azure AI Speech', 'Neon', 'Vercel']) {
    assert.ok(da.includes(needle), `the Danish policy never names ${needle}`)
    assert.ok(en.includes(needle), `the English policy never names ${needle}`)
  }
  // Guard the guard: the loop above passes vacuously if PROCESSORS is emptied and the names happen to
  // survive in some other paragraph.
  assert.equal(PROCESSORS.length, 4)
})

test('every processor says what it actually receives', () => {
  for (const p of PROCESSORS) {
    assert.ok(p.da.trim().length > 40, `${p.id} has no real Danish description`)
    assert.ok(p.en.trim().length > 40, `${p.id} has no real English description`)
  }
})

test('the equal-protection confirmation 5.1.1(i) requires is present in both languages', () => {
  assert.ok(textOf(PRIVACY_DA).includes(EQUAL_PROTECTION_DA))
  assert.ok(textOf(PRIVACY_EN).includes(EQUAL_PROTECTION_EN))
  // And it says the thing, not merely that processors exist.
  assert.match(EQUAL_PROTECTION_DA, /samme eller tilsvarende beskyttelse/)
  assert.match(EQUAL_PROTECTION_EN, /same or equal protection/)
})

test('the policy explains retention, deletion AND how to withdraw consent', () => {
  const da = textOf(PRIVACY_DA).toLowerCase()
  assert.ok(da.includes('slet'), 'no deletion path described')
  assert.ok(da.includes('nulstil fremgang'), 'the in-app per-child reset is not named')
  assert.ok(da.includes('slet kontoen helt'), 'the in-app account deletion is not named')
  // 5.1.1(i) asks specifically for revoking consent, and here that IS turning the microphone back off.
  assert.ok(
    /trækker samtykket tilbage|slå mikrofonen fra/.test(da),
    'the policy never says how to withdraw microphone consent',
  )
})

test('the policy states the microphone is OFF by default and names Google as the recipient', () => {
  // The single most consequential claim on the page: it is what makes §3.6's design legible to a
  // reviewer. If the default ever changes, this test is the thing that should stop the change.
  const da = textOf(PRIVACY_DA)
  assert.match(da, /slået FRA|slået fra som standard/)
  assert.match(da, /Google Cloud Speech-to-Text/)
  assert.match(da, /gemmes ikke/)
})

test('the policy promises no ads, no tracking and no analytics', () => {
  // These are Guideline 1.3 claims about a Kids Category app, and they are true today (the repo ships no
  // analytics SDK — the `amplitude` matches are the parallax token). Keep them true.
  const da = textOf(PRIVACY_DA).toLowerCase()
  for (const claim of ['reklame', 'sporing', 'analyse']) {
    assert.ok(da.includes(claim), `the policy does not address "${claim}"`)
  }
})

// ---- GDPR Article 13, item by item ---------------------------------------------------------------
//
// Verified against the article text (gdpr-info.eu/art-13-gdpr, read 2026-08-06). These are the items
// that were MISSING from the first draft and are easy to lose again in an edit.

test('the policy states a LEGAL BASIS for each kind of processing — Art 13(1)(c)', () => {
  const da = textOf(PRIVACY_DA)
  // Against the HEADINGS, not the flattened text — see `headingsOf`.
  assert.ok(
    headingsOf(PRIVACY_DA).some((h) => h === 'Retsgrundlag'),
    `no legal-basis section — headings are: ${headingsOf(PRIVACY_DA).join(' | ')}`,
  )
  // Named articles, not a vague "vi har lov til det".
  for (const basis of ['litra b', 'litra a', 'litra f']) {
    assert.ok(da.includes(basis), `no processing is attributed to Article 6(1)(${basis.slice(-1)})`)
  }
})

test('the policy addresses THIRD-COUNTRY TRANSFERS — Art 13(1)(f)', () => {
  // Google, Microsoft and Vercel are US companies. EU regions are configured, but that is not the same
  // as "no transfer", and the safeguard has to be named.
  const da = textOf(PRIVACY_DA)
  assert.match(da, /uden for EU|USA/)
  assert.match(da, /standardkontraktbestemmelser/, 'no transfer safeguard named')
  assert.match(da, /Data Privacy Framework/)
})

test('the policy lists the full set of data-subject rights — Art 13(2)(b)-(d)', () => {
  const da = textOf(PRIVACY_DA).toLowerCase()
  for (const [right, needle] of [
    ['access', 'indsigt'],
    ['rectification', 'rettet'],
    ['erasure', 'slettet'],
    ['restriction/objection', 'begrænses'],
    ['portability', 'maskinlæsbart'],
    ['withdraw consent', 'trække et samtykke tilbage'],
    ['complain to the DPA', 'datatilsynet'],
  ] as const) {
    assert.ok(da.includes(needle), `the ${right} right is not stated`)
  }
})

test('the policy states there is no automated decision-making — Art 13(2)(f)', () => {
  assert.match(textOf(PRIVACY_DA), /ingen automatiske afgørelser|ingen profilering/)
})

// ---- Disclosures the CODE forces, found by auditing claims against the repo -----------------------

test('the automatic failed-sign-in upload is disclosed, screenshot and all', () => {
  // `src/services/authDiagnostics.ts` uploads a report WITH a screenshot on a failed sign-in, with no
  // user action. The first draft disclosed the manual report and the crash report and missed this one
  // entirely — an undisclosed automatic transmission that includes an image.
  for (const [lang, doc] of [['Danish', PRIVACY_DA], ['English', PRIVACY_EN]] as const) {
    const t = textOf(doc)
    assert.match(t, /login mislykkes|sign-in fails/, `${lang}: the failed-sign-in upload is undisclosed`)
    assert.match(t, /automatisk|automatically/, `${lang}: it does not say the upload is automatic`)
  }
})

test('the synthetic nature of the voice is disclosed', () => {
  // Microsoft's Code of Conduct for AI Services (v4.0, 2026-05-01), Responsible AI requirement 3:
  // customers must "Disclose when the output … is generated by AI, including the synthetic nature of
  // generated voices". Every line the app speaks is Azure TTS output.
  assert.match(textOf(PRIVACY_DA), /syntetisk/)
  assert.match(textOf(PRIVACY_EN), /synthetic/)
})

test('the guest claim does not overstate silence', () => {
  // The app still fetches itself from Vercel and polls /api/version, so "nothing is sent anywhere" was
  // false as written. An IP address is personal data; the honest claim is about the CHILD's data.
  const da = textOf(PRIVACY_DA)
  assert.ok(!da.includes('Der sendes ingen personoplysninger nogen steder'), 'the absolute claim is back')
  assert.match(da, /IP-adresse/, 'the policy does not admit the server sees an IP')
})

test('the support page is not an empty website', () => {
  // Guideline 2.1(a) explicitly scrubs "empty websites… and other temporary content", so a placeholder
  // support page is a rejection. Require real answers, not just a mail address.
  const text = textOf(SUPPORT_DA)
  assert.ok(text.includes(CONTROLLER.email), 'no way to reach a human')
  const answers = SUPPORT_DA.sections.flatMap((s) => s.bullets ?? [])
  assert.ok(answers.length >= 5, `only ${answers.length} support answers — that reads as a placeholder`)
  assert.ok(text.length > 900, 'the support page is too thin to be a real support page')
})

test('neither page uses the work email or the work domain', () => {
  // Standing owner instruction: this project never uses abv@cyberpilot.io or cyberpilot.io. A privacy
  // policy is the single worst place to leak an employer's domain, since it is published on the store
  // page as the controller's contact.
  const all = [textOf(PRIVACY_DA), textOf(PRIVACY_EN), textOf(SUPPORT_DA), CONTROLLER.email].join('\n')
  assert.ok(!/cyberpilot/i.test(all), 'the work domain appears in a published document')
  assert.equal(CONTROLLER.email, 'allanvraa@gmail.com')
})

test('both public pages are actually routed, at the paths App Store Connect will be given', () => {
  // The content existing is not the same as the URL resolving, and the URL is what Apple fetches. Two
  // mount points have to agree: App.tsx (signed in) and PublicPages.tsx (no account at all).
  const app = readFileSync(path.join(SRC, 'App.tsx'), 'utf8')
  assert.match(app, /path="\/privatliv"/)
  assert.match(app, /path="\/support"/)
  const publicPages = readFileSync(path.join(SRC, 'components/legal/PublicPages.tsx'), 'utf8')
  assert.match(publicPages, /'\/support'/)
})
