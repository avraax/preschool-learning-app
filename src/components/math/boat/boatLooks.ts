/** Boat types rotate per boat — pure visual variety, nothing to collect (Harbour PRD-01 §2.2.13). */
export const BOAT_LOOKS = [
  { name: 'kutter', hull: '#D9483B', stripe: '#FFFFFF', trim: '#8C2A22' },
  { name: 'færge', hull: '#F2B632', stripe: '#FFFFFF', trim: '#A8761A' },
  { name: 'slæbebåd', hull: '#24406E', stripe: '#F28C28', trim: '#132544' },
  { name: 'fragtskib', hull: '#7FB8E0', stripe: '#FFFFFF', trim: '#3F7AA6' },
] as const
