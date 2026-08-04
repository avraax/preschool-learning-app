// Resolve hook: let plain-node runs load the SERVER tree, whose relative imports carry the `.js`
// extension that Vercel's per-file TypeScript compilation actually emits.
//
// WHY THIS EXISTS (and why it must not be "simplified" away):
// Vercel compiles each `api/**` + `lib/**` file to a sibling `.js` and copies the tree into the
// function — it does NOT bundle, and it does NOT rewrite import specifiers. So `import … from
// '../lib/session.ts'` ships verbatim into `api/profiles.js` and dies at runtime with
// ERR_MODULE_NOT_FOUND, because only `lib/session.js` exists there. The accounts release shipped
// exactly that: every auth/profiles/progress/tts/stt endpoint was a 500 in production from the day it
// landed, while dev-server.js (plain node, type-stripping, real `.ts` files on disk) worked fine.
// `api/bug-report.ts` was the survivor precisely because it already used `'../lib/server-utils.js'`.
//
// So the server graph now says `.js`, which is what the deployed artifact needs. Node's own ESM
// resolver, however, wants the name that is really on disk (`.ts`) — it does no extension
// substitution (verified: `import './dep.js'` against a `dep.ts` throws ERR_MODULE_NOT_FOUND, while
// `'./dep.ts'` loads). This hook closes exactly that gap, and only that gap: a relative `.js`
// specifier that does not exist, whose `.ts` sibling does, resolves to the `.ts`.
//
// Both spellings therefore land on the SAME resolved URL, so a module imported as `.js` from
// `api/progress.ts` and as `.ts` from a test is one instance, not two.

import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

function onDisk(url) {
  try {
    return existsSync(fileURLToPath(url))
  } catch {
    return false
  }
}

export async function resolve(specifier, context, nextResolve) {
  const relative = specifier.startsWith('./') || specifier.startsWith('../')
  if (relative && specifier.endsWith('.js') && context.parentURL) {
    try {
      const asIs = new URL(specifier, context.parentURL)
      if (!onDisk(asIs)) {
        const swapped = `${specifier.slice(0, -3)}.ts`
        if (onDisk(new URL(swapped, context.parentURL))) {
          return nextResolve(swapped, context)
        }
      }
    } catch {
      /* fall through to the default resolver — never mask a real resolution error */
    }
  }
  return nextResolve(specifier, context)
}
