// Non-mutating Fisher-Yates shuffle. Returns a NEW array — never sorts the input in place.
//
// The Farver games read from shared, module-scope educational config (e.g. `DANISH_OBJECTS` in
// colorContent.ts). Sorting those arrays in place with `.sort(() => Math.random() - 0.5)` both
// biases the result AND permanently scrambles the shared data for every other consumer for the
// rest of the session (e.g. FarverLearning's example-object order). Use this instead.
// `rnd` exists so the PURE generators in `src/config/mathProblems.ts` can be sampled deterministically
// from a test (a seeded source instead of Math.random) without a second shuffle implementation.
// Callers in components omit it and get Math.random exactly as before.
export function shuffle<T>(arr: readonly T[], rnd: () => number = Math.random): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default shuffle
