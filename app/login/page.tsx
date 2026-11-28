import Link from 'next/link';
import './sakura.css';

export default function Login() {
  return <main className="sakura-login">
    <section className="sakura-art">
      <h2>GradeFlow Next</h2>
      <p>ทุกการส่งงานคือการเติบโต</p>
    </section>
    <section className="sakura-form">
      <Link href="/">← หน้าแรก</Link>
      <h1>เข้าสู่ระบบ</h1>
      <p>เลือกประเภทบัญชี</p>
      <Link className="auth-action primary" href="/login/teacher">ครูและผู้ดูแลระบบ</Link>
      {process.env.NEXT_PUBLIC_STUDENT_PORTAL_ENABLED === 'true' &&
        <Link className="auth-action" href="/student">นักเรียน</Link>}
    </section>
  </main>;
}
