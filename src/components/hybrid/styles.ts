// Lớp Tailwind dùng chung cho các khối của hybrid.
export const CARD = 'bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-white/60';
export const INPUT =
  'w-full min-w-0 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500';
const BTN =
  'inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg disabled:opacity-50 transition-colors';
export const BTN_PRIMARY = `${BTN} bg-blue-600 text-white hover:bg-blue-700`;
export const BTN_SECONDARY = `${BTN} border border-gray-300 text-gray-700 hover:bg-gray-50`;
export const BTN_DANGER = `${BTN} border border-red-200 text-red-600 hover:bg-red-50`;
