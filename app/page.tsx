import Link from 'next/link';
import {SakuraIcon} from './workspace/sakura-icons';
import {SakuraAnimalAvatar} from './workspace/sakura-animals';
import {RELEASE_LABEL, EDITION} from '../lib/release';
import './workspace/garden.css';
import './sakura-home.css';

const features = [
 {icon:'scanner', title:'Smart Scanner', description:'รับงานและให้คะแนนด้วยรหัส กล้อง หรือ USB', tone:'rose', label:'01 · ตรวจงาน'},
 {icon:'ranking', title:'Sakura Champions', description:'ติดตามการส่งงานและคะแนนของแต่ละห้อง', tone:'mint', label:'02 · ติดตามผล'},
 {icon:'reports', title:'Reports', description:'จัดทำรายงานคะแนนและป้ายบาร์โค้ด', tone:'lilac', label:'03 · รายงาน'},
 {icon:'backup', title:'Backup Center', description:'สำรองและตรวจสอบความถูกต้องของข้อมูล', tone:'peach', label:'04 · ข้อมูล'},
];

export default function Home() {
 return <div className="shell garden sakura-home">
  <aside className="home-sidebar">
   <Link href="/" className="home-brand"><span aria-hidden="true"><SakuraAnimalAvatar animal="cat"/></span><span>GradeFlow <b>Next</b><small>SAKURA CLASSROOM</small></span></Link>
   <div className="home-sidebar-copy">ตรวจงาน BY T.Je</div>
   <nav aria-label="เมนูหลัก">
    <Link href="/" aria-current="page"><span aria-hidden="true"><SakuraIcon name="home"/></span> ภาพรวม</Link>
    <Link href="/login"><span aria-hidden="true"><SakuraIcon name="logout"/></span> เข้าสู่ระบบ</Link>
    <Link href="/workspace"><span aria-hidden="true"><SakuraIcon name="scanner"/></span> พื้นที่ทำงาน</Link>
    <Link href="/register"><span aria-hidden="true"><SakuraIcon name="requests"/></span> ลงทะเบียนครู</Link>
    <Link href="/demo"><span aria-hidden="true"><SakuraIcon name="chart"/></span> ทดลองข้อมูลจำลอง</Link>
   </nav>
   <div className="home-sidebar-note"><span aria-hidden="true"><SakuraIcon name="sprout"/></span><strong>เติบโตไปด้วยกัน</strong><small>{RELEASE_LABEL} · {EDITION}</small></div>
  </aside>
  <main id="main-content">
   <header className="home-header"><div><small>GRADE FLOW / {EDITION}</small><h1>ยินดีต้อนรับคุณครู</h1></div><span className="pill">{RELEASE_LABEL}</span></header>
   <section className="hero home-hero home-scenic-hero">
    <div className="home-hero-copy"><span className="home-kicker">SAKURA CLASSROOM · BY T.Je</span><h2>ทุกการส่งงาน<br/>คือการเติบโต</h2><p>พื้นที่ตรวจงานแสนอบอุ่น จัดการรายวิชา ให้คะแนน และติดตามความก้าวหน้าของนักเรียนได้ในที่เดียว</p>
     <div className="home-actions"><Link href="/login" className="primary">เข้าสู่ระบบจริง <span aria-hidden="true">→</span></Link><Link href="/demo" className="home-secondary">ทดลองใช้งาน</Link></div>
    </div>
   </section>
   <section aria-labelledby="features-heading"><div className="home-section-title"><div><small>TEACHER TOOLKIT</small><h2 id="features-heading">เครื่องมือสำหรับคุณครู</h2></div><span className="muted">4 โมดูลหลัก</span></div>
    <div className="home-features">{features.map(({icon,title,description,tone,label})=><article className={'panel home-feature '+tone} key={title}><span className="home-feature-icon" aria-hidden="true"><SakuraIcon name={icon}/></span><small>{label}</small><h3>{title}</h3><p>{description}</p></article>)}</div>
   </section>
   <section className="panel home-start"><div><small>LET'S GET STARTED</small><h2>เริ่มต้นใช้งานในห้องเรียนของคุณ</h2><p>เข้าสู่ระบบด้วยบัญชีที่ได้รับอนุมัติ หรือลงทะเบียนเพื่อส่งคำขอเป็นครู</p></div><div className="home-actions"><Link className="primary" href="/register">ลงทะเบียนครู</Link><Link className="home-secondary" href="/demo">ดู Dashboard ตัวอย่าง</Link></div></section>
   <p className="home-notice"><strong>Release Candidate</strong> · ใช้ข้อมูลจำลองสำหรับตรวจรับก่อนนำข้อมูลนักเรียนจริงเข้า ระบบกู้คืนคะแนนจริงยังไม่เปิดใช้</p>
   <footer>GradeFlow Next · {RELEASE_LABEL} · {EDITION}<div style={{marginTop:8}}><Link href="/privacy">นโยบายความเป็นส่วนตัว</Link> · <Link href="/terms">ข้อกำหนดการใช้งาน</Link></div></footer>
  </main>
 </div>;
}
