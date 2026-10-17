/**
 * The runtime binding of the four-door front page (Category restructure PRD-01 D8). It rode the Krea
 * staging gate until both shipped together in v1.3; the gate is gone, so the doors are always on. The
 * call sites still take the flag (the five-section branch is dead code awaiting cleanup).
 */
export const fourDoorsShown = (): boolean => true
