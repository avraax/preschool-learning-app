// The paper's LOGICAL size (Krea PRD-01 §4.2): every stroke, guide and tap lives in these units, never
// pixels. Here in config, not in the canvas engine, because the guided subjects (`kreaShapes.ts`) map
// onto it and they are in the narration enumerator's plain-Node import graph.
export const PAPER_W = 1200
export const PAPER_H = 900
