// Compare the App Store screenshots in App Store Connect against docs/app-store/shots/, and upload
// them when they differ.
//
// WHY A CHECKSUM AND NOT A GLANCE. Twice in one day ASC held a screenshot that looked completely
// right: same filename, same pixel dimensions, `COMPLETE` state — and the wrong image. Once it was
// the whole set, a month stale (the floating gear the app no longer has); once it was the rail shot,
// re-taken locally after the adult-surface merge and never uploaded. Nothing about the ASC page can
// show you this. `sourceFileChecksum` vs a local md5 can.
//
// The rail shot in particular goes stale on any adult-surface change, because it IS the rail — it was
// invalidated three times in a single day.
//
//   npm run shots:check    compare only; exits non-zero on any mismatch
//   npm run shots:upload   replace a whole set and pin the display order
//
// Needs the ASC API key. Key id + issuer are safe to hold here; the .p8 never enters the repo
// (.gitignore refuses *.p8) and its contents are never printed. See .claude/rules/ios-shell.md.
import { createSign, createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

const KEY_ID = process.env.ASC_KEY_ID || 'VR8MNH235U'
const ISSUER = process.env.ASC_ISSUER_ID || '62ee49e8-4d0f-4dd1-bb76-84a364d09904'
const KEY_PATH = process.env.ASC_KEY_PATH ||
  'C:/Users/AllanBrinkVraa/Documents/AppleDeveloper/AuthKey_VR8MNH235U.p8'

const SETS = [
  { name: 'APP_IPAD_PRO_3GEN_129', id: 'f1ebc587-9f9b-4aed-8599-7da4dc150df5',
    files: ['ipad-1-menu.png','ipad-2-alfabet.png','ipad-3-tal.png','ipad-4-farver.png','ipad-5-bog.png','ipad-6-voksne.png'] },
  { name: 'APP_IPHONE_67', id: 'ebf20760-fafe-4af4-835b-07463fe62a61',
    files: ['iphone-1-menu.png','iphone-2-alfabet.png','iphone-3-tal.png','iphone-4-farver.png','iphone-5-bog.png','iphone-6-voksne.png'] },
]
const DIR = 'docs/app-store/shots/'

const pem = readFileSync(KEY_PATH, 'utf8')
let token = null, issued = 0
const jwt = () => {
  if (token && Date.now() - issued < 800000) return token
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const now = Math.floor(Date.now() / 1000)
  const h = b64({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' })
  const b = b64({ iss: ISSUER, iat: now, exp: now + 1100, aud: 'appstoreconnect-v1' })
  const s = createSign('SHA256'); s.update(`${h}.${b}`); s.end()
  // ieee-p1363, not the default DER — Apple rejects a DER signature.
  token = `${h}.${b}.${s.sign({ key: pem, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`
  issued = Date.now()
  return token
}
const api = async (p, init = {}) => {
  const r = await fetch('https://api.appstoreconnect.apple.com' + p, {
    ...init, headers: { Authorization: 'Bearer ' + jwt(), 'Content-Type': 'application/json', ...(init.headers || {}) },
  })
  const t = await r.text()
  if (!r.ok) throw new Error(`${init.method || 'GET'} ${p} → ${r.status}: ${t.slice(0, 300)}`)
  return t ? JSON.parse(t) : null
}
const md5 = (f) => createHash('md5').update(readFileSync(DIR + f)).digest('hex')

const upload = process.argv.includes('--upload')
let bad = 0

for (const set of SETS) {
  const shots = await api(`/v1/appScreenshotSets/${set.id}/appScreenshots`)
  const remote = new Map((shots.data || []).map((s) => [s.attributes.fileName, s]))
  const stale = set.files.filter((f) => (remote.get(f)?.attributes?.sourceFileChecksum || '').toLowerCase() !== md5(f))
  if (!stale.length) { console.log(`${set.name.padEnd(24)} OK — all ${set.files.length} match`); continue }
  bad += stale.length
  console.log(`${set.name.padEnd(24)} ${stale.length} STALE: ${stale.join(', ')}`)
  if (!upload) continue

  // Replace the WHOLE set: a set holds at most 10, so uploading before deleting can overflow, and the
  // display order has to be re-pinned afterwards anyway.
  for (const s of shots.data || []) await api(`/v1/appScreenshots/${s.id}`, { method: 'DELETE' })
  const ids = []
  for (const f of set.files) {
    const buf = readFileSync(DIR + f)
    const res = await api('/v1/appScreenshots', { method: 'POST', body: JSON.stringify({ data: {
      type: 'appScreenshots', attributes: { fileName: f, fileSize: buf.length },
      relationships: { appScreenshotSet: { data: { type: 'appScreenshotSets', id: set.id } } } } }) })
    for (const op of res.data.attributes.uploadOperations || []) {
      const hdrs = {}; for (const h of op.requestHeaders || []) hdrs[h.name] = h.value
      const up = await fetch(op.url, { method: op.method, headers: hdrs, body: buf.subarray(op.offset, op.offset + op.length) })
      if (!up.ok) throw new Error(`upload ${f} → ${up.status}`)
    }
    await api(`/v1/appScreenshots/${res.data.id}`, { method: 'PATCH', body: JSON.stringify({ data: {
      type: 'appScreenshots', id: res.data.id, attributes: { uploaded: true, sourceFileChecksum: md5(f) } } }) })
    ids.push(res.data.id)
    console.log(`    uploaded ${f}`)
  }
  // Upload order is not guaranteed to be the DISPLAY order.
  await api(`/v1/appScreenshotSets/${set.id}/relationships/appScreenshots`, { method: 'PATCH',
    body: JSON.stringify({ data: ids.map((id) => ({ type: 'appScreenshots', id })) }) })
  console.log(`    order pinned (${ids.length})`)
}

if (bad && !upload) {
  console.log(`\n${bad} screenshot(s) differ from the repo — run: npm run shots:upload`)
  process.exit(1)
}
console.log(upload && bad ? '\nUploaded. Re-run npm run shots:check to confirm.' : '\nApp Store Connect matches the repo.')
