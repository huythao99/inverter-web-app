// Member colours of a share group, in member order (same palette as the app).
export const SHARE_PALETTE = [
  '#1D8DFD',
  '#DC740D',
  '#05C742',
  '#8E5CF7',
  '#CC1100',
  '#0266CA',
  '#F4B700',
  '#47566B',
];

export const colorAt = (i: number) => SHARE_PALETTE[i % SHARE_PALETTE.length];
