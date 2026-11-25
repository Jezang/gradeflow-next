import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {title:'GradeFlow Next | Sakura Classroom',description:'ระบบตรวจงานสำหรับครู'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="th"><body>{children}</body></html>}