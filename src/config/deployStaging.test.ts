import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// `vercel deploy --archive=tgz` uploads a tarball with no `.git`, so the version plugin's
// `git rev-parse` fails on the build machine and every staging deployment reports the literal "dev" —
// two builds then look identical in the adult menu's version chip and in every bug report.
//
// The hash is resolved locally and handed over, and HOW it is handed over is the whole guard: the build
// runs on VERCEL's machine, so a variable put in this process's environment reaches the CLI and dies
// there. It has to be `--build-env`. That shipped wrong once and was only caught by curling the
// deployed /api/version.

const src = readFileSync('scripts/deploy-staging.mjs', 'utf8')
  .replace(/\r\n/g, '\n')
  .split('\n')
  .map((line) => line.replace(/(^|\s)\/\/.*$/, '')) // the rationale must not satisfy the guard
  .join('\n')

test('the commit hash is passed as a BUILD env, not a local one', () => {
  assert.match(src, /'--build-env'/, 'BL_COMMIT_SHA must ride --build-env or the remote build never sees it')
  assert.match(src, /`BL_COMMIT_SHA=\$\{commit\}`/)
  // And NOT in the spawn's `env`, where it looks right and does nothing.
  const spawnEnv = src.slice(src.indexOf('env: {'), src.indexOf('if (r.status'))
  assert.doesNotMatch(
    spawnEnv,
    /BL_COMMIT_SHA/,
    'BL_COMMIT_SHA in the process env is the bug — the CLI reads it, the build machine does not',
  )
})

test('the deploy still targets the staging project explicitly', () => {
  // `.vercel/project.json` is PRODUCTION's and single-valued, so these two are the only thing standing
  // between `npm run deploy:staging` and a production deployment.
  const spawnEnv = src.slice(src.indexOf('env: {'), src.indexOf('if (r.status'))
  assert.match(spawnEnv, /VERCEL_ORG_ID: ORG_ID/)
  assert.match(spawnEnv, /VERCEL_PROJECT_ID: PROJECT_ID/)
})
