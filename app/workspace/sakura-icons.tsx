import type {ReactNode} from 'react';

const glyphs: Record<string, ReactNode> = {
 flower:<><path d="M12 9C4-2 0 9 8 12C-1 16 7 25 12 16C17 25 25 16 16 12C24 9 20-2 12 9Z"/><circle cx="12" cy="12" r="2"/></>,
 sprout:<><path d="M12 21v-9M12 15C3 15 3 5 3 5s9 0 9 10ZM12 12c0-9 9-9 9-9s0 9-9 9Z"/></>,
 home:<><path d="m3 10 9-7 9 7v10H3Z"/><path d="M9 20v-6h6v6"/></>,
 scanner:<><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M3 12h18"/><path d="M8 8v2m4-2v2m4-2v2"/></>,
 students:<><circle cx="9" cy="8" r="3"/><path d="M2 20v-2a7 7 0 0 1 14 0v2M17 5a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 5"/></>,
 teaching:<><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 4v16m3-11h6m-6 4h6"/></>,
 ranking:<><path d="M8 3h8v7a4 4 0 0 1-8 0ZM8 5H4v2a4 4 0 0 0 4 4m8-6h4v2a4 4 0 0 1-4 4m-4 3v5m-4 2h8"/></>,
 reports:<><path d="M6 3h9l4 4v14H6Z"/><path d="M14 3v5h5M9 12h7m-7 4h7"/></>,
 settings:<><circle cx="12" cy="12" r="3"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4M5 5l3 3m8 8 3 3M19 5l-3 3m-8 8-3 3"/><circle cx="12" cy="12" r="8"/></>,
 requests:<><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></>,
 backup:<><path d="M4 4h14l3 3v13H3V4Zm3 0v7h10V4M7 20v-5h10v5"/></>,
 migration:<><path d="M3 7h18m-5-5 5 5-5 5M21 17H3m5-5-5 5 5 5"/></>,
 about:<><circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/></>,
 menu:<path d="M4 6h16M4 12h16M4 18h16"/>,
 logout:<><path d="M11 4H4v16h7m4-12 4 4-4 4m-7-4h11"/></>,
 check:<path d="m5 12 4 4L19 6"/>,
 clock:<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
 chart:<><path d="M4 4v16h16M8 15v-4m4 4V8m4 7V5"/></>,
};
export function SakuraIcon({name}:{name:string}) {
 return <svg className="sakura-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{glyphs[name]??glyphs.about}</svg>;
}
