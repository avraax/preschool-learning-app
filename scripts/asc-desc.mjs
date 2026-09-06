// `npm run desc:check` / `desc:sync` — does App Store Connect hold the same DESCRIPTION as the repo?
//
// The text twin of `asc-shots.mjs`, and it exists for the same reason that one does: **the store listing
// drifts from the app silently.** On 2026-09-05 the owner renamed the adult area from "Til de voksne" to
// "Indstillinger" throughout the app; `docs/app-store/listing.md` was updated in the same commit, and
// the live listing was not. Nothing failed. ASC showed a complete, valid, green description that
// described a screen the app no longer had — which is a Guideline 2.3.1 accuracy problem, and the one
// class of listing defect no test in this repo could see, because there was no check that looked.
//
// `listing.md` IS the source of truth. The canonical block is extracted from it rather than retyped
// here, so "ASC matches the repo" is a fact rather than a claim, and editing the doc is what changes
// the store. Exits non-zero on drift, so it can gate a submission the way `schema:check` gates a deploy.
//
// It PATCHes only `--apply`, prints a line-level diff first either way, and **reads back after writing**:
// a 200 on the PATCH is not proof of what Apple stored.
import { createSign } from 'node:crypto'
import { readFileSync } from 'node:fs'

const APPLY = process.argv.includes('--apply')
const KEY_ID = process.env.ASC_KEY_ID || 'VR8MNH235U'
const ISSUER = process.env.ASC_ISSUER_ID || '62ee49e8-4d0f-4dd1-bb76-84a364d09904'
const KEY_PATH = process.env.ASC_KEY_PATH || 'C:/Users/AllanBrinkVraa/Documents/AppleDeveloper/AuthKey_VR8MNH235U.p8'
const pem = readFileSync(KEY_PATH, 'utf8')

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const now = Math.floor(Date.now() / 1000)
const head = `${b64({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' })}.${b64({ iss: ISSUER, iat: now, exp: now + 1100, aud: 'appstoreconnect-v1' })}`
const sig = createSign('SHA256'); sig.update(head)
// ieee-p1363, not DER — Apple rejects a DER signature.
const token = `${head}.${sig.sign({ key: pem, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`

const api = async (p, init = {}) => {
  const r = await fetch(`https://api.appstoreconnect.apple.com/v1/${p}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  })
  if (!r.ok) { console.error(`${init.method || 'GET'} ${p} -> ${r.status}`, (await r.text()).slice(0, 400)); process.exit(1) }
  return r.status === 204 ? null : r.json()
}

// THE REPO IS THE SOURCE OF TRUTH. Pull the canonical block out of listing.md rather than retyping it,
// so "ASC matches the repo" is a fact and not a claim.
const md = readFileSync('docs/app-store/listing.md', 'utf8')
const start = md.indexOf('Børnelæring er en rolig, dansk læringsapp')
if (start < 0) { console.error('canonical description not found in listing.md'); process.exit(1) }
const end = md.indexOf('\n```', start)
if (end < 0) { console.error('unterminated fence after the description'); process.exit(1) }
const want = md.slice(start, end).replace(/\r\n/g, '\n').trim()

const app = (await api('apps?limit=10')).data[0]
const vers = (await api(`apps/${app.id}/appStoreVersions?limit=5`)).data
const v = vers.find((x) => x.attributes.appStoreState === 'PREPARE_FOR_SUBMISSION') || vers[0]
const locs = (await api(`appStoreVersions/${v.id}/appStoreVersionLocalizations`)).data
const da = locs.find((l) => l.attributes.locale === 'da')
if (!da) { console.error('no da localization'); process.exit(1) }

const have = (da.attributes.description || '').replace(/\r\n/g, '\n').trim()
console.log(`app=${app.attributes.name}  version=${v.attributes.versionString} (${v.attributes.appStoreState})  locale=da`)

if (have === want) { console.log('IN SYNC — description already matches the repo'); process.exit(0) }

// Show exactly which lines differ, so this can never be a silent overwrite.
const a = have.split('\n'), b = want.split('\n')
console.log(`DRIFT — ${Math.max(a.length, b.length)} lines compared`)
for (let i = 0; i < Math.max(a.length, b.length); i++) {
  if (a[i] !== b[i]) { console.log(`  line ${i + 1}\n    ASC : ${a[i] ?? '(missing)'}\n    repo: ${b[i] ?? '(missing)'}`) }
}
if (!APPLY) { console.log('\nDry run. Re-run with --apply to write the repo version to ASC.'); process.exit(2) }

await api(`appStoreVersionLocalizations/${da.id}`, {
  method: 'PATCH',
  body: JSON.stringify({ data: { type: 'appStoreVersionLocalizations', id: da.id, attributes: { description: want } } }),
})
// READ BACK. A 200 on the PATCH is not proof of what is stored.
const after = (await api(`appStoreVersionLocalizations/${da.id}`)).data.attributes.description.replace(/\r\n/g, '\n').trim()
console.log(after === want ? 'APPLIED — read back byte-identical to the repo' : 'MISMATCH AFTER WRITE — ASC did not store what was sent')
process.exit(after === want ? 0 : 1)
