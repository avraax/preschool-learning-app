// `npm run deploy:staging` — push the working tree to the staging deployment (staging PRD §6.3).
//
// Only needed when something SERVER-side changed. Local development has its own API and does not use
// this deployment; it only shares staging's database.
//
// THREE THINGS THAT ARE NOT OPTIONAL, each learned the expensive way:
//
//   --prod          A Vercel PREVIEW deployment sits behind the SSO wall, so `curl` gets a 302 and
//                   nothing about it can be verified. `--prod` here means "this PROJECT's production
//                   environment", and the project is the staging one — it has nothing to do with
//                   boernelaering.dk.
//   --archive=tgz   A bare `vercel deploy` ABORTS on this repo after several minutes of file hashing;
//                   there are ~1900 prebaked mp3s.
//   the env vars    The CLI resolves its target from `.vercel/project.json`, which is single-valued,
//                   gitignored, and belongs to PRODUCTION. Setting VERCEL_PROJECT_ID/ORG_ID overrides
//                   it without rewriting it. Omit them and this deploys the working tree to
//                   boernelaering.dk — which is exactly the accident this whole PRD exists to prevent.

import { spawnSync, execSync } from 'node:child_process'

const ORG_ID = 'team_GacOLmNdUS9It9R5VRX8EZQH'
const PROJECT_ID = 'prj_ZOnA09yX1vZZ4yXdCH680NmmP8gH' // preschool-learning-app-staging
const STAGING_HOST = 'https://staging.boernelaering.dk'

// `--archive=tgz` uploads a tarball with NO `.git`, so `vite.config.ts`'s generateVersionPlugin runs
// `git rev-parse` on the build machine and falls back to the literal "dev". Every staging deployment
// then reports the same version and two builds are indistinguishable in the adult menu's version chip.
// Resolve the hash HERE, where the repo exists, and hand it over as build environment.
let commit = 'dev'
try {
  commit = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim()
} catch {
  console.warn('[deploy:staging] not a git checkout — the version chip will read "dev"')
}
let dirty = false
try {
  dirty = execSync('git status --porcelain', { encoding: 'utf8' }).trim().length > 0
} catch {
  /* not a git checkout */
}

console.log(`[deploy:staging] project  preschool-learning-app-staging`)
console.log(`[deploy:staging] host     ${STAGING_HOST}`)
console.log(`[deploy:staging] commit   ${commit}${dirty ? ' (working tree is DIRTY — deploying it anyway)' : ''}`)

const r = spawnSync(
  'npx',
  ['vercel', 'deploy', '--prod', '--archive=tgz', '--yes', '--scope', 'allan-brink-vraas-projects'],
  {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      VERCEL_ORG_ID: ORG_ID,
      VERCEL_PROJECT_ID: PROJECT_ID,
      // Read by vite.config.ts's generateVersionPlugin on the build machine.
      BL_COMMIT_SHA: commit,
    },
  },
)

if (r.status !== 0) process.exit(r.status ?? 1)
console.log(`\n[deploy:staging] verify with:`)
console.log(`  curl -s ${STAGING_HOST}/api/version`)
console.log(`  curl -s ${STAGING_HOST}/api/auth/family/providers`)
