// Registers the `.js`→`.ts` resolve hook (see js-to-ts-resolve-hooks.mjs for the whole why).
//
// Must be loaded with `node --import ./scripts/js-to-ts-resolve.mjs …`, NOT as a plain import inside
// an entry file: ESM resolves an entry's whole import graph before executing any of it, so a
// registration performed in the entry body comes too late for its own siblings.

import { register } from 'node:module'

register('./js-to-ts-resolve-hooks.mjs', import.meta.url)
