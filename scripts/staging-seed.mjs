// `npm run staging:seed -- --children "Emil:fox:12,Ida:owl:3"` — put a believable family in the
// staging database (staging PRD W6).
//
//   Name:avatarId:slots   repeated, comma-separated.
//     Name      the child's first name (Danish letters welcome)
//     avatarId  an id from src/config/avatars.ts — `fox`, never a glyph, whatever the COLUMN is called
//     slots     how many rewards the book should already hold
//
// NOTHING HERE REIMPLEMENTS THE PROGRESS MODEL. The document comes from `defaultPersisted()`, the XP
// from `xpForSlots()` — the same function the `?rewards=n` dev harness uses — and the result is checked
// with `progressInvariantViolations()` before it is written. A seeded profile is therefore
// indistinguishable from a played one, which is the only thing that makes seeding worth having: a
// hand-built document tests the seeder, not the app.

import { randomUUID } from 'node:crypto'
import { assertStagingDatabase, dbHost, scriptPool } from './lib/db-tier.mjs'
import { defaultPersisted, progressInvariantViolations, SCHEMA_VERSION } from '../src/config/progressSchema.ts'
import { collectedFromLevel, levelFromXp, xpForSlots } from '../src/config/progression.ts'
import { AVATAR_IDS, normalizeAvatarId } from '../src/config/avatars.ts'

const pool = scriptPool()

// THE GATE, before any other statement. Nothing below runs against a database that has not said, in
// its own tables, that it is staging.
await assertStagingDatabase(pool)

const argOf = (name) => {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}

const spec = argOf('--children')
if (!spec) {
  console.error(
    'usage: npm run staging:seed -- --children "Emil:fox:12,Ida:owl:3"\n' +
      `  avatar ids: ${AVATAR_IDS.join(', ')}`,
  )
  process.exit(2)
}

const children = spec
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
  .map((entry) => {
    const [name, avatar, slots] = entry.split(':')
    if (!name) throw new Error(`[staging:seed] no name in ${JSON.stringify(entry)}`)
    const wanted = Number(slots ?? 0)
    if (!Number.isInteger(wanted) || wanted < 0) {
      throw new Error(`[staging:seed] slots must be a non-negative integer in ${JSON.stringify(entry)}`)
    }
    // `normalizeAvatarId` is an ALLOW-LIST and falls back to the default; say so rather than silently
    // seeding a fox when the caller asked for a dragon.
    const avatarId = normalizeAvatarId(avatar)
    if (avatar && avatarId !== avatar) {
      console.warn(`[staging:seed] unknown avatar ${JSON.stringify(avatar)} -> ${avatarId}`)
    }
    return { name, avatarId, slots: wanted }
  })

const email = (process.env.AUTH_ALLOWED_EMAILS ?? '').split(',')[0]?.trim().toLowerCase()
if (!email) {
  throw new Error('[staging:seed] AUTH_ALLOWED_EMAILS is empty — the adult would be refused at sign-in')
}

console.log(`[staging:seed] database ${dbHost()}`)
console.log(`[staging:seed] adult    ${email}`)

try {
  const now = new Date()

  // --- the adult. Upsert by email so re-seeding adds children to the SAME account rather than
  //     orphaning the previous one behind a second user row with the same address.
  const existing = await pool.query(`select "id" from "user" where lower("email") = $1 limit 1`, [email])
  let userId = existing.rows[0]?.id
  if (userId) {
    console.log(`[staging:seed] adult already exists (${userId})`)
  } else {
    userId = randomUUID()
    await pool.query(
      `insert into "user" ("id","name","email","emailVerified","createdAt","updatedAt")
       values ($1,$2,$3,$4,$5,$6)`,
      [userId, 'Staging Voksen', email, true, now, now],
    )
    console.log(`[staging:seed] adult created (${userId})`)
  }

  // --- the children
  for (const child of children) {
    const profileId = randomUUID()
    await pool.query(
      `insert into "childProfile" ("id","userId","name","avatarEmoji","createdAt")
       values ($1,$2,$3,$4,$5)`,
      // The column is called avatarEmoji and holds an avatar ID. Expect the name to lie; never write a
      // glyph back (.claude/rules/auth.md).
      [profileId, userId, child.name, child.avatarId, now],
    )

    // The v4 document, built the way the app builds it.
    const doc = defaultPersisted(profileId, `seed-${profileId.slice(0, 8)}`, now.getTime())
    if (child.slots > 0) {
      const xp = xpForSlots(child.slots)
      // A per-device G-Counter ledger, not a scalar — one seed device holding the whole amount.
      doc.ledger[doc.sync.originDevice] = { xp, slots: child.slots, bloom: {} }
      doc.stickers.grantedSlots = child.slots
      doc.stickers.seenThroughSlot = child.slots
      // The ceremony is what grants, and a seeded child must not open the app behind an overlay for
      // rewards they never watched arrive — so mark the level they have reached as celebrated.
      doc.progression.lastCelebratedLevel = levelFromXp(xp).level
      doc.progression.updatedAt = now.getTime()
    }

    // `grantedSlots <= collectedFromLevel(globalLevel())` is an INEQUALITY, and the gap is a pending
    // ceremony. Assert the real checker rather than trusting the arithmetic above.
    const violations = progressInvariantViolations(doc)
    if (violations.length) {
      throw new Error(
        `[staging:seed] the document for ${child.name} violates the progress invariants:\n  ` +
          violations.join('\n  '),
      )
    }
    const level = levelFromXp(doc.ledger[doc.sync.originDevice]?.xp ?? 0).level
    if (doc.stickers.grantedSlots > collectedFromLevel(level)) {
      throw new Error(`[staging:seed] ${child.name}: grantedSlots exceeds what the level allows`)
    }

    await pool.query(
      `insert into "profileProgress" ("id","profileId","doc","rev","epoch","updatedAt")
       values ($1,$2,$3,$4,$5,$6)`,
      [randomUUID(), profileId, JSON.stringify(doc), doc.sync.rev, doc.sync.epoch, now],
    )
    console.log(
      `[staging:seed] ${child.name} (${child.avatarId}) — ${child.slots} sticker(s), schema v${SCHEMA_VERSION}`,
    )
  }

  console.log('[staging:seed] done')
} finally {
  await pool.end()
}
