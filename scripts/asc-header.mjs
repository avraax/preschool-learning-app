// `npm run header:check` / `header:upload` — does the version being edited in App Store Connect carry
// docs/app-store/header/header-universal.png as BOTH its product-page header and its search-results asset?
//
// The third twin of `asc-shots.mjs` and `asc-desc.mjs`, for the "Header and Search Results" tab Apple
// added in October 2026 (shown on iOS/iPadOS 27+). One universal 16:9 image fills both placements; build
// it with `npm run header:build`. The asset lives in the app's ASSET LIBRARY and is attached to a version
// localization by a PLACEMENT, one per placement type — so the image survives across versions in the
// library, but each new version needs its placements made again (like screenshots, they are per version).
//
// Apple has no checksum on library images (`sourceFileChecksum` is rejected), so "same file" here means
// same fileName AND same fileSize — the comparison Apple's own API leaves us. The file name carries no
// version, so a re-composed image with an identical byte count would pass; vanishingly rare for a 10 MB
// PNG, and `header:upload --force` re-uploads regardless.
//
// Needs the ASC API key — same key, same rules as asc-shots.mjs (the .p8 never enters the repo).
import { createSign } from 'node:crypto'
import { readFileSync, statSync } from 'node:fs'
import { basename } from 'node:path'

const KEY_ID = process.env.ASC_KEY_ID || 'VR8MNH235U'
const ISSUER = process.env.ASC_ISSUER_ID || '62ee49e8-4d0f-4dd1-bb76-84a364d09904'
const KEY_PATH = process.env.ASC_KEY_PATH ||
  'C:/Users/AllanBrinkVraa/Documents/AppleDeveloper/AuthKey_VR8MNH235U.p8'
const PROD_BUNDLE_ID = 'com.vraa.earlylearning'
const FILE = 'docs/app-store/header/header-universal.png'
const PLACEMENTS = ['PRODUCT_PAGE_HEADER_ASSET', 'APP_STORE_SEARCH_RESULTS_ASSET']

const pem = readFileSync(KEY_PATH, 'utf8')
const jwt = () => {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const now = Math.floor(Date.now() / 1000)
  const h = b64({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' })
  const b = b64({ iss: ISSUER, iat: now, exp: now + 1100, aud: 'appstoreconnect-v1' })
  const s = createSign('SHA256'); s.update(`${h}.${b}`); s.end()
  return `${h}.${b}.${s.sign({ key: pem, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`
}
const api = async (p, init = {}) => {
  const r = await fetch('https://api.appstoreconnect.apple.com' + p, {
    ...init, headers: { Authorization: 'Bearer ' + jwt(), 'Content-Type': 'application/json' },
  })
  const t = await r.text()
  if (!r.ok) throw new Error(`${init.method || 'GET'} ${p} → ${r.status}: ${t.slice(0, 500)}`)
  return t ? JSON.parse(t) : null
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const upload = process.argv.includes('--upload')
const force = process.argv.includes('--force')
const fileName = basename(FILE), fileSize = statSync(FILE).size

const apps = await api('/v1/apps?limit=50')
const app = (apps.data || []).find((a) => a.attributes.bundleId === PROD_BUNDLE_ID)
if (!app) { console.error(`no app with bundleId ${PROD_BUNDLE_ID} — refusing to guess`); process.exit(1) }
const vers = await api(`/v1/apps/${app.id}/appStoreVersions?limit=10`)
const ver = (vers.data || []).find((v) => v.attributes.appStoreState === 'PREPARE_FOR_SUBMISSION')
if (!ver) { console.error('no version in PREPARE_FOR_SUBMISSION — create the next version first'); process.exit(1) }
const locs = await api(`/v1/appStoreVersions/${ver.id}/appStoreVersionLocalizations`)
const da = (locs.data || []).find((l) => l.attributes.locale === 'da')
if (!da) { console.error('no da localization on that version'); process.exit(1) }
console.log(`${app.attributes.name} — version ${ver.attributes.versionString} (${ver.attributes.appStoreState})\n`)

const readPlacements = async () => {
  const r = await api(`/v1/appStoreVersionLocalizations/${da.id}/placements?include=image&limit=50`)
  const imgs = new Map((r.included || []).filter((x) => x.type === 'appAssetLibraryImages').map((x) => [x.id, x]))
  return (r.data || []).map((p) => ({ p, img: imgs.get(p.relationships?.image?.data?.id) }))
}
const matches = ({ img }) => img?.attributes?.fileName === fileName && img?.attributes?.fileSize === fileSize

let current = await readPlacements()
const stale = PLACEMENTS.filter((t) => force || !current.some((c) => c.p.attributes.placementType === t && matches(c)))
for (const t of PLACEMENTS) {
  const c = current.find((x) => x.p.attributes.placementType === t)
  const what = c ? `${c.img?.attributes?.fileName ?? '?'} (${c.img?.attributes?.fileSize ?? '?'} B, ${c.p.attributes.state ?? '?'})` : 'none'
  console.log(`${t.padEnd(32)} ${stale.includes(t) ? 'STALE' : 'OK   '} ${what}`)
}
if (!stale.length) { console.log('\nApp Store Connect matches the repo.'); process.exit(0) }
if (!upload) { console.log(`\n${stale.length} placement(s) differ — run: npm run header:upload`); process.exit(1) }

// 1. Reserve, upload and commit the image in the app's asset library. No specId: Apple derives the
//    allowed placements from the pixel size (5244x2950 = universal, both placements).
const buf = readFileSync(FILE)
const res = await api('/v1/appAssetLibraryImages', { method: 'POST', body: JSON.stringify({ data: {
  type: 'appAssetLibraryImages',
  attributes: { category: 'CREATIVE_ASSETS', fileName, fileSize, referenceName: `Header ${ver.attributes.versionString}` },
  relationships: { assetLibrary: { data: { type: 'appAssetLibraries', id: app.id } } } } }) })
const imageId = res.data.id
for (const op of res.data.attributes.uploadOperations || []) {
  const hdrs = {}; for (const h of op.requestHeaders || []) hdrs[h.name] = h.value
  const up = await fetch(op.url, { method: op.method, headers: hdrs, body: buf.subarray(op.offset, op.offset + op.length) })
  if (!up.ok) throw new Error(`upload → ${up.status}`)
}
await api(`/v1/appAssetLibraryImages/${imageId}`, { method: 'PATCH', body: JSON.stringify({ data: {
  type: 'appAssetLibraryImages', id: imageId, attributes: { uploaded: true } } }) })
console.log(`\n    uploaded ${fileName} → library image ${imageId}`)

// 2. Wait out post-processing; placing too early fails with STATE_ERROR.ASSET_IN_POST_PROCESSING.
let state = ''
for (let i = 0; i < 60; i++) {
  const a = (await api(`/v1/appAssetLibraryImages/${imageId}`)).data.attributes
  state = a.state ?? a.assetDeliveryState?.state ?? ''
  const errs = a.assetDeliveryState?.errors ?? a.stateDetails
  if (/FAILED|ERROR/.test(state)) throw new Error(`processing failed: ${state} ${JSON.stringify(errs)}`)
  if (state && !/UPLOAD|PROCESSING|AWAITING/.test(state)) break
  await sleep(5000)
}
console.log(`    processed (${state})`)

// 3. Swap the placements on this version: drop the old ones for these types, attach the new image.
for (const c of current.filter((x) => stale.includes(x.p.attributes.placementType))) {
  await api(`/v1/appAssetLibraryPlacements/${c.p.id}`, { method: 'DELETE' })
}
for (const t of stale) {
  await api('/v1/appAssetLibraryPlacements', { method: 'POST', body: JSON.stringify({ data: {
    type: 'appAssetLibraryPlacements', attributes: { placementType: t },
    relationships: {
      image: { data: { type: 'appAssetLibraryImages', id: imageId } },
      appStoreVersionLocalization: { data: { type: 'appStoreVersionLocalizations', id: da.id } },
    } } }) })
  console.log(`    placed as ${t}`)
}

current = await readPlacements()
const ok = PLACEMENTS.every((t) => current.some((c) => c.p.attributes.placementType === t && matches(c)))
console.log(ok ? '\nPlaced and read back. Apple reviews it with the version.' : '\nRead-back MISMATCH — run header:check')
process.exit(ok ? 0 : 1)
