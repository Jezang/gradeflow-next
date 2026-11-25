import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {title:'GradeFlow Next | Sakura Edition',description:'ระบบตรวจงาน BY T.Je สำหรับครู · Release Candidate'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="th"><body>{children}</body></html>}