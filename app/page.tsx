import Link from 'next/link';
import {RELEASE_LABEL, EDITION} from '../lib/release';
import './workspace/garden.css';
import './sakura-home.css';

const features = [
 {icon:'▣', title:'Smart Scanner', description:'รับงานและให้คะแนนด้วยรหัส กล้อง หรือ USB', tone:'rose', label:'01 · ตรวจงาน'},
 {icon:'🏆', title:'Sakura Champions', description:'ติดตามการส่งงานและคะแนนของแต่ละห้อง', tone:'mint', label:'02 · ติดตามผล'},
 {icon:'📄', title:'Reports', description:'จัดทำรายงานคะแนนและป้ายบาร์โค้ด', tone:'lilac', label:'03 · รายงาน'},
 {icon:'💾', title:'Backup Center', description:'สำรองและตรวจสอบความถูกต้องของข้อมูล', tone:'peach', label:'04 · ข้อมูล'},
];

function SakuraArt() {
 return <svg className="home-art" viewBox="0 0 350 250" aria-hidden="true" focusable="false">
  <ellipse cx="181" cy="220" rx="139" ry="21" fill="#b9d8c5" opacity=".65"/>
  <path d="M24 203Q86 162 147 197T325 176V219H24Z" fill="#b0d6bd"/>
  <path d="M82 211Q100 125 80 45M94 119Q137 84 152 47M85 100Q53 73 40 46" stroke="#aa8575" strokeWidth="12" strokeLinecap="round" fill="none"/>
  {[[35,45],[63,35],[87,58],[117,34],[151,49],[57,85],[116,91],[170,70],[86,15]].map(([x,y],i)=>
   <g key={i} fill={i%2?'#e8a2bc':'#f7c8d7'}>{[0,72,144,216,288].map(a=><ellipse key={a} cx={x} cy={y-10} rx="11" ry="15" transform={'rotate('+a+' '+x+' '+y+')'}/>)}<circle cx={x} cy={y} r="4" fill="#f6d493"/></g>)}
  <ellipse cx="238" cy="214" rx="76" ry="12" fill="#87b99a" opacity=".55"/>
  <path d="M173 148L170 90L210 115Q237 105 264 115L303 90L300 148Q300 203 237 203Q173 203 173 148Z" fill="#fffaf6" stroke="#9c7885" strokeWidth="3.5" strokeLinejoin="round"/>
  <path d="M181 107L184 132L203 119M291 107L288 132L270 119" fill="#efb1c7"/>
  <circle cx="214" cy="151" r="5" fill="#476255"/><circle cx="263" cy="151" r="5" fill="#476255"/>
  <ellipse cx="200" cy="166" rx="10" ry="6" fill="#efb6c7"/><ellipse cx="277" cy="166" rx="10" ry="6" fill="#efb6c7"/>
  <path d="M229 161Q238 170 247 161" stroke="#9c7885" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
  <path d="M210 186Q224 177 238 190Q252 177 268 186V220Q252 211 238 221Q224 211 210 220Z" fill="#e9a4bf" stroke="#a67b8c" strokeWidth="2"/>
  <path d="M238 190V221" stroke="#fff6f7" strokeWidth="2"/>
  <g fill="#f2b7cb"><ellipse cx="310" cy="43" rx="7" ry="13" transform="rotate(30 310 43)"/><ellipse cx="265" cy="62" rx="6" ry="11" transform="rotate(-25 265 62)"/></g>
  <path d="M322 110v20m-10-10h20M193 31v16m-8-8h16" stroke="#fff" strokeWidth="3" strokeLinecap="round"/>
 </svg>;
}

export default function Home() {
 return <div className="shell garden sakura-home">
  <aside className="home-sidebar">
   <Link href="/" className="home-brand"><span aria-hidden="true">🌸</span><span>GradeFlow <b>Next</b><small>SAKURA CLASSROOM</small></span></Link>
   <div className="home-sidebar-copy">ตรวจงาน BY T.Je</div>
   <nav aria-label="เมนูหลัก">
    <Link href="/" aria-current="page"><span aria-hidden="true">⌂</span> ภาพรวม</Link>
    <Link href="/login"><span aria-hidden="true">↗</span> เข้าสู่ระบบ</Link>
    <Link href="/workspace"><span aria-hidden="true">▣</span> พื้นที่ทำงาน</Link>
    <Link href="/register"><span aria-hidden="true">✉</span> ลงทะเบียนครู</Link>
    <Link href="/demo"><span aria-hidden="true">☆</span> ทดลองข้อมูลจำลอง</Link>
   </nav>
   <div className="home-sidebar-note"><span aria-hidden="true">🌱</span><strong>เติบโตไปด้วยกัน</strong><small>{RELEASE_LABEL} · {EDITION}</small></div>
  </aside>
  <main id="main-content">
   <header className="home-header"><div><small>GRADE FLOW / {EDITION}</small><h1>ยินดีต้อนรับคุณครู</h1></div><span className="pill">{RELEASE_LABEL}</span></header>
   <section className="hero home-hero">
    <div className="home-hero-copy"><span className="home-kicker">SAKURA CLASSROOM · BY T.Je</span><h2>ทุกการส่งงาน<br/>คือการเติบโต <span aria-hidden="true">🌸</span></h2><p>พื้นที่ตรวจงานแสนอบอุ่น จัดการรายวิชา ให้คะแนน และติดตามความก้าวหน้าของนักเรียนได้ในที่เดียว</p>
     <div className="home-actions"><Link href="/login" className="primary">เข้าสู่ระบบจริง <span aria-hidden="true">→</span></Link><Link href="/demo" className="home-secondary">ทดลองใช้งาน</Link></div>
    </div>
    <SakuraArt/>
   </section>
   <section aria-labelledby="features-heading"><div className="home-section-title"><div><small>TEACHER TOOLKIT</small><h2 id="features-heading">เครื่องมือสำหรับคุณครู</h2></div><span className="muted">4 โมดูลหลัก</span></div>
    <div className="home-features">{features.map(({icon,title,description,tone,label})=><article className={'panel home-feature '+tone} key={title}><span className="home-feature-icon" aria-hidden="true">{icon}</span><small>{label}</small><h3>{title}</h3><p>{description}</p></article>)}</div>
   </section>
   <section className="panel home-start"><div><small>LET'S GET STARTED</small><h2>เริ่มต้นใช้งานในห้องเรียนของคุณ</h2><p>เข้าสู่ระบบด้วยบัญชีที่ได้รับอนุมัติ หรือลงทะเบียนเพื่อส่งคำขอเป็นครู</p></div><div className="home-actions"><Link className="primary" href="/register">ลงทะเบียนครู</Link><Link className="home-secondary" href="/demo">ดู Dashboard ตัวอย่าง</Link></div></section>
   <p className="home-notice"><strong>Release Candidate</strong> · ใช้ข้อมูลจำลองสำหรับตรวจรับก่อนนำข้อมูลนักเรียนจริงเข้า ระบบกู้คืนคะแนนจริงยังไม่เปิดใช้</p>
   <footer>GradeFlow Next · {RELEASE_LABEL} · {EDITION}</footer>
  </main>
 </div>;
}
