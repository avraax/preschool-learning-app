// `npm run cap:sync` — `npx cap sync ios`, then undo the one thing it gets wrong on Windows.
//
// App Store PRD §4.3 / B1. `cap sync` writes local plugin paths into `ios/App/CapApp-SPM/Package.swift`
// using the HOST's path separator. On Windows that is a backslash, which Swift Package Manager on the
// CI Mac cannot resolve — and the symptom is a package-resolution failure on a remote machine, with
// nothing on Windows ever reading the file. The owner develops on Windows and builds on macOS, so this
// is not an edge case here, it is every sync.
//
// Kept as a script rather than a note in a doc because the note is what fails. `capacitorConfig.test.ts`
// is the backstop if someone runs the bare `npx cap sync ios` anyway.

import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const PACKAGE_SWIFT = path.join(ROOT, 'ios', 'App', 'CapApp-SPM', 'Package.swift')

execFileSync('npx', ['cap', 'sync', 'ios'], { cwd: ROOT, stdio: 'inherit', shell: true })

const before = readFileSync(PACKAGE_SWIFT, 'utf8')
// Only inside `path: "…"` — never touch anything else in a file the CLI owns.
const after = before.replace(/path:\s*"([^"]*)"/g, (whole, p) =>
  p.includes('\\') ? whole.replace(p, p.replace(/\\/g, '/')) : whole,
)

if (after !== before) {
  writeFileSync(PACKAGE_SWIFT, after)
  console.log('cap:sync — normalised Windows path separators in Package.swift')
} else {
  console.log('cap:sync — Package.swift paths already POSIX')
}
