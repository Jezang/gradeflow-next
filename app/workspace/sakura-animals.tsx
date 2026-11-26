import type {ReactNode} from 'react';

export type SakuraAnimal = 'cat' | 'rabbit' | 'bear' | 'panda';
const animals: SakuraAnimal[] = ['cat', 'rabbit', 'bear', 'panda'];

// Decorative only. No student identifier is included in the rendered SVG.
export function SakuraAnimalAvatar({animal}: {animal: SakuraAnimal}) {
 const isCat=animal==='cat', isRabbit=animal==='rabbit', isPanda=animal==='panda';
 const fur=isCat?'#fffaf2':isRabbit?'#fff8fb':isPanda?'#fffaf4':'#e8c6a7';
 const outline='#896f78';
 const ears: ReactNode=isCat
  ? <><path d="M15 30 12 9Q13 6 16 9L31 23M49 30 52 9Q51 6 48 9L33 23" fill={fur}/><path d="m17 14 2 11 8-4m20-7-2 11-8-4" fill="#efb9c8" stroke="none"/></>
  : isRabbit
  ? <><rect x="17" y="3" width="12" height="29" rx="6" fill={fur}/><rect x="35" y="3" width="12" height="29" rx="6" fill={fur}/><rect x="21" y="7" width="4" height="18" rx="2" fill="#efb9c8" stroke="none"/><rect x="39" y="7" width="4" height="18" rx="2" fill="#efb9c8" stroke="none"/></>
  : <><circle cx="15" cy="24" r="10" fill={isPanda?'#666575':fur}/><circle cx="49" cy="24" r="10" fill={isPanda?'#666575':fur}/>{!isPanda&&<><circle cx="15" cy="24" r="4.5" fill="#efb9b2" stroke="none"/><circle cx="49" cy="24" r="4.5" fill="#efb9b2" stroke="none"/></>}</>;
 return <svg className="sakura-animal" viewBox="0 0 64 72" aria-hidden="true" focusable="false">
  <ellipse cx="32" cy="66" rx="23" ry="4" fill="#806475" opacity=".13"/>
  <g stroke={outline} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round">
   <path d="M20 48Q12 56 17 63Q32 68 47 63Q52 56 44 48Z" fill={isPanda?'#777483':fur}/>
   <ellipse cx="32" cy="58" rx="10" ry="7" fill="#fff9ee" stroke="none"/>
   {ears}
   <path d="M8 37Q8 19 32 19Q56 19 56 37Q56 54 32 54Q8 54 8 37Z" fill={fur}/>
   {isPanda&&<g fill="#73717d" stroke="none"><ellipse cx="21" cy="36" rx="7" ry="8" transform="rotate(22 21 36)"/><ellipse cx="43" cy="36" rx="7" ry="8" transform="rotate(-22 43 36)"/></g>}
   <g stroke="none"><circle cx="22" cy="36" r="2.7" fill={isPanda?'#fffaf4':'#524b58'}/><circle cx="42" cy="36" r="2.7" fill={isPanda?'#fffaf4':'#524b58'}/><ellipse cx="15.5" cy="43" rx="4.6" ry="2.8" fill="#efb1bf"/><ellipse cx="48.5" cy="43" rx="4.6" ry="2.8" fill="#efb1bf"/></g>
   <path d="M30 41Q32 44 34 41M32 44Q28 48 26 45M32 44Q36 48 38 45" fill="none" strokeWidth="1.4"/>
   {isCat&&<path d="m9 37-5-1m6 5-5 1m50-5 5-1m-6 5 5 1" strokeWidth="1.2"/>}
   <path d="M27 54 32 58 37 54" fill="#c2dcc7" stroke="#87ad9b" strokeWidth="1.2"/>
  </g>
  <g transform="translate(48 18)"><g fill="#f1b4cf">{[0,72,144,216,288].map(a=><ellipse key={a} cx="0" cy="-3.7" rx="2.7" ry="4" transform={'rotate('+a+')'}/>)}</g><circle r="2" fill="#f9d686"/></g>
 </svg>;
}

export function SakuraRankMedal({rank}:{rank:number}) {
 const tone=rank===1?'#e5b453':rank===2?'#a8b9cf':'#d39d7f';
 return <svg className="sakura-medal" viewBox="0 0 36 42" aria-hidden="true" focusable="false">
  <path d="M7 2h9l4 15-8 6Z" fill="#c397ba"/><path d="M29 2h-9l-4 15 8 6Z" fill="#a0c7bc"/>
  <circle cx="18" cy="26" r="13" fill={tone} stroke="#8a7078" strokeWidth="1"/>
  <circle cx="18" cy="26" r="10" fill="none" stroke="#fff7ea" strokeWidth="1.4"/>
  <text x="18" y="30.5" textAnchor="middle" fontFamily="system-ui,sans-serif" fontSize="13" fontWeight="800" fill="#433a46">{rank}</text>
 </svg>;
}

// Cycle decorative species without deriving them from names, IDs or other personal fields.
export function animalAt(index:number):SakuraAnimal {return animals[((index%animals.length)+animals.length)%animals.length];}
