'use client';
import dynamic from 'next/dynamic';
const BrowserPage = dynamic(() => import('./browser-page'), {ssr:false, loading:()=> <main><p>กำลังโหลด GradeFlow Next…</p></main>});
export default function Page(){return <BrowserPage/>;}
