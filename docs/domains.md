# Domain shortlist (.dk)

Candidate domains for Børnelæring, with an availability check and the reasoning behind the ranking.

**Availability verified 2026-07-31** against the Punktum dk (ex DK Hostmaster) whois at
`whois.dk-hostmaster.dk:43`. Every entry below returned a conclusive *"No entries found for the
selected source."* — see [Re-checking availability](#re-checking-availability) to re-run.

> Registry availability only. **Trademark not checked** — `bogstavbanden` in particular is the kind of
> name an existing children's book series or app may already own. Check the Danish trademark register
> (Patent- og Varemærkestyrelsen) before committing to a brand name.

## Danish special characters (æ ø å) — recommendation

Punktum dk supports æ/ø/å in .dk domains, and `børnelæring.dk` is free (punycode
`xn--brnelring-k3a7q.dk`). **Don't make an IDN the primary domain:**

1. **Punycode leaks** everywhere the name isn't rendered by a browser — TLS certificates, email
   addresses, analytics referrers, the Vercel dashboard, QR generators. `xn--brnelring-k3a7q.dk` is
   unbrandable and reads like phishing.
2. **"Børnelæring" has two plausible ASCII spellings** — `bornelaering` (ø→o) and `boernelaering`
   (ø→oe). A Danish parent might type either, so covering the brand costs **three** registrations.
3. **Word-of-mouth cost** — telling another parent the address means spelling it out. For a kids' app
   that's the main distribution channel.
4. **Non-Danish keyboards** (a guest iPad, a device set to English) can't easily type æøå.

The one real upside: a Danish iOS keyboard has æøå on the home row, so for a parent on an iPad it is
effortless.

**Prefer a name whose Danish spelling contains no æøå at all**, so exactly one spelling exists. If the
*Børnelæring* brand is kept, buy all three variants and 301-redirect the IDN and the `oe` form to
`bornelaering.dk`.

### Trap: every "leg og …" compound

The most obvious Danish name for this app — *"leg og lær"* → `legoglaer.dk` — contains the literal
string **"lego"**. So does `legogtal.dk`. The LEGO Group is Danish and enforces aggressively.
**Avoid all `leg og …` compounds.**

## Shortlist — available, ordered by relevance

| # | Domain | Why it fits | æøå in the real word? |
|---|---|---|---|
| 1 | `bornelaering.dk` | Exact match for the app's name, already in `manifest.json` and the `<title>`. | ø + æ → **buy the 3-pack** (`boernelaering.dk` + `børnelæring.dk`, both also free) |
| 2 | `bogstavogtal.dk` | "Bogstav og tal" — literally the app's subtitle *"Alfabetet og Tal"*, and the two biggest sections. One unambiguous spelling. | None ✅ |
| 3 | `laerogleg.dk` | *"Lær og leg"* — the most idiomatic Danish phrase for exactly this product. Best pure marketing name. | æ only (→`ae` is the standard, low ambiguity); `lærogleg.dk` also free |
| 4 | `abcogtal.dk` | Short, punchy, same promise as #2 — and "ABC" is readable by a child mid-way through the alphabet section. | None ✅ |
| 5 | `klartilskole.dk` | *"Klar til skole"* — the parent-facing reason to install, and precisely the 5–7 age target. | None ✅ |
| 6 | `laeringsspil.dk` | "Læringsspil" is the term Danish parents actually google. Category SEO. | æ only |
| 7 | `bogstavspil.dk` | Descriptive category name for the Alfabetet + Ordleg half of the app. | None ✅ |
| 8 | `talogabc.dk` | Clean short mirror of #4; good as a redirect twin. | None ✅ |
| 9 | `snartskolebarn.dk` | *"Snart skolebarn"* — warm, parent-facing, captures the whole purpose in two words. | None ✅ |
| 10 | `bogstavbanden.dk` | The most *brandable* option — characterful, suits the mascot and themed worlds rather than describing features. | None ✅ |

**If buying exactly one:** `bogstavogtal.dk` — æøå-free, single spelling, says what the app does.
**If buying one for marketing:** `laerogleg.dk` — far more memorable, at the cost of one `ae`.
**If protecting the brand:** the `bornelaering.dk` / `boernelaering.dk` / `børnelæring.dk` trio.

## Also available (not shortlisted)

Checked and free, kept here so they don't need re-checking:
`bornelaer.dk` · `boernelaer.dk` · `laereleg.dk` · `laerleg.dk` · `legelaer.dk` · `laermedleg.dk` ·
`laerelegen.dk` · `laeringsleg.dk` · `abcogleg.dk` · `alfabetleg.dk` · `talleg.dk` · `stavleg.dk` ·
`taljagt.dk` · `legmedord.dk` · `legmedtal.dk` · `mitalfabet.dk` · `laerbogstaver.dk` ·
`laerespil.dk` · `dansklaering.dk` · `smaalaering.dk` · `minlaeringsbog.dk` · `laeringsbogen.dk` ·
`vidensleg.dk` · `legestunden.dk` · `duergod.dk` · `dygtigbarn.dk` · `klogebarn.dk` ·
`abc123spil.dk` · `bogstavbanden.dk`

Rejected on grounds other than availability:
- `forskoleleg.dk` (free) — **misspelling**: it's *førskole*. A learning app can't ship a spelling error.
- `minbogstav.dk` (free) — **wrong gender**: *bogstav* is neuter, so it's *mit* bogstav.
- `legoglaer.dk`, `legogtal.dk` — contain "lego" (see the trap above).

## Taken (do not re-check)

`ordleg.dk` (2023) · `bogstavleg.dk` (2013) · `legmedbogstaver.dk` (2022) · `abcleg.dk` (2005) ·
`skoleklar.dk` (2011) · `bogstavjagt.dk` (1999) · `talspil.dk` (1998) · `talogbogstaver.dk` (2019) ·
`farveleg.dk` (2023, deactivated — could free up)

## Re-checking availability

`.dk` has **no RDAP service** — port-43 whois is the only programmatic source, and it **rate-limits**,
returning a bare banner with no verdict. A naive checker reads that as "registered". Any script must
treat *only* two responses as conclusive — `No entries found` (available) or a `Domain:` line (taken) —
and retry anything else with backoff. Sanity-check both directions with a known-taken domain
(`dk-hostmaster.dk`) and a known-free nonsense string.

```js
// node script.mjs bogstavogtal.dk børnelæring.dk
import net from 'node:net'
const ascii = (d) => new URL('http://' + d).hostname  // IDN → punycode

const whois = (domain) => new Promise((resolve) => {
  const sock = net.createConnection(43, 'whois.dk-hostmaster.dk')
  let out = ''
  const done = (r) => { try { sock.destroy() } catch {} ; resolve(r) }
  sock.setTimeout(15000)
  sock.on('connect', () => sock.write(domain + '\r\n'))
  sock.on('data', (d) => { out += d })
  sock.on('end', () => done(out))
  sock.on('timeout', () => done(out || 'TIMEOUT'))
  sock.on('error', (e) => done('ERROR ' + e.message))
})

const classify = (raw) => {
  if (/no entries found/i.test(raw)) return 'AVAILABLE'
  if (/^Domain:/mi.test(raw)) return 'TAKEN ' + (raw.match(/^Registered:\s*(.+)$/mi)?.[1] ?? '')
  return 'UNKNOWN'  // rate limited / partial — retry, never assume taken
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
for (const d of process.argv.slice(2)) {
  let v = 'UNKNOWN'
  for (let i = 1; i <= 3 && v === 'UNKNOWN'; i++) {
    v = classify(await whois(ascii(d)))
    if (v === 'UNKNOWN') await sleep(4000 * i)
  }
  console.log(d.padEnd(24), v)
  await sleep(1500)
}
```

## Registration notes

- `.dk` registration requires **MitID** or a signed declaration — no anonymous registration.
- Registrant details are public in whois unless privacy is requested (a private individual can have
  address details hidden; the name stays public).
