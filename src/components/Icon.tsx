import type { CSSProperties } from 'react';
const paths = {
  city: 'M3 21h18M5 21V8l6-4v17m3 0V3l5 3v15M8 10h.01M8 14h.01M8 18h.01M16 8h.01M16 12h.01M16 16h.01',
  dashboard: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  projects: 'M3 7h18v13H3zM8 7V4h8v3M3 12h18M10 12v3h4v-3',
  map: 'm9 18-6 3V6l6-3 6 3 6-3v15l-6 3-6-3Zm0 0V3m6 18V6',
  pin: 'M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0ZM12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
  alert: 'm12 3 10 18H2L12 3Zm0 6v5m0 3h.01',
  reports: 'M7 3h10l4 4v14H3V3h4Zm10 0v5h4M7 12h10M7 16h6',
  search: 'M21 21l-5-5M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14',
  plus: 'M12 5v14M5 12h14',
  arrow: 'M5 12h14m-6-6 6 6-6 6',
  back: 'M19 12H5m6-6-6 6 6 6',
  chevron: 'm9 5 7 7-7 7',
  check: 'm5 12 4 4L19 6',
  clock: 'M12 8v4l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18',
  refresh: 'M20 7V3m0 4h-4M4 17v4m0-4h4M5 7a8 8 0 0 1 14-1l1 1M4 17l1 1a8 8 0 0 0 14-1',
  menu: 'M3 6h18M3 12h18M3 18h18',
  close: 'm6 6 12 12M6 18 18 6',
  logout: 'M9 4H4v16h5m6-13 5 5-5 5M9 12h11',
  shield: 'M12 3 3 6v5c0 5 9 10 9 10s9-5 9-10V6l-9-3Zm-4 9 3 3 5-6',
  layers: 'm12 3 10 6-10 6L2 9l10-6ZM2 13l10 6 10-6M2 17l10 6 10-6',
  settings: 'M4 6h16M4 12h16M4 18h16M8 3v6m8 0v6m-6 0v6',
  calendar: 'M4 5h16v16H4zM8 3v4m8-4v4M4 10h16',
  info: 'M12 10v6m0-9h.01M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  edit: 'm14 5 5 5M4 20l4-1L21 6l-4-4L4 15v5ZM3 21h18',
  link: 'm10 14 4-4m-7 7-1 1a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m2-2 1-1a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0',
} as const;
export type IconName = keyof typeof paths;
export function Icon({name, size = 20, className = '', style}: {name: IconName; size?: number; className?: string; style?: CSSProperties}) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}><path d={paths[name]}/></svg>;
}
