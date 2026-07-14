// Non-mutating Fisher-Yates shuffle. Returns a NEW array — never sorts the input in place.
//
// The Farver games read from shared, module-scope educational config (e.g. `DANISH_OBJECTS` in
// colorContent.ts). Sorting those arrays in place with `.sort(() => Math.random() - 0.5)` both
// biases the result AND permanently scrambles the shared data for every other consumer for the
// rest of the session (e.g. FarverLearning's example-object order). Use this instead.
export function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default shuffle
