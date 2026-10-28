import type { CSSProperties } from 'react';

export type IconName = 'projects' | 'people' | 'slides' | 'processing' | 'settings' | 'arrow' | 'search' | 'upload' | 'check' | 'lock' | 'logout';
const paths: Record<IconName, React.ReactNode> = {
  projects: <><path d="M3 7h7l2-3h9v15H3z" /><path d="M3 7V4h7l2 3" /></>,
  people: <><circle cx="9" cy="8" r="3" /><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6M21 21v-3a6 6 0 0 0-4-5" /></>,
  slides: <><rect x="3" y="3" width="18" height="13" rx="2" /><path d="M12 16v5M7 21l5-5 5 5M7 7h10M7 11h6" /></>,
  processing: <><path d="M20 7a9 9 0 0 0-15-2L2 8M2 3v5h5M4 17a9 9 0 0 0 15 2l3-3M22 21v-5h-5" /></>,
  settings: <><path d="M4 7h16M4 17h16" /><circle cx="9" cy="7" r="3" /><circle cx="15" cy="17" r="3" /></>,
  arrow: <><path d="M4 12h16M14 6l6 6-6 6" /></>,
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
  upload: <><path d="M12 16V3M6 9l6-6 6 6M3 15v6h18v-6" /></>,
  check: <path d="m4 12 5 5L20 6" />,
  lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></>,
  logout: <><path d="M10 3H3v18h7M10 12h11M16 7l5 5-5 5" /></>,
};

export function Icon({ name, className, style }: { name: IconName; className?: string; style?: CSSProperties }) {
  return <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>{paths[name]}</svg>;
}
