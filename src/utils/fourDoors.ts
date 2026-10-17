import { kreaShown } from './kreaShown'

/**
 * The runtime binding of the four-door front page (Category restructure PRD-01 D8). It RIDES the Krea
 * gate on purpose — the four-door shape always contains Krea, and the owner ships both in v1.3 — so
 * there is one gate to delete at release, not two that can disagree. Production (gate off) keeps
 * today's five sections byte-identical.
 */
export const fourDoorsShown = (): boolean => kreaShown()
