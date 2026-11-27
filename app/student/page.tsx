'use client';

import {useEffect, useState, type FormEvent} from 'react';
import {onAuthStateChanged, type User} from 'firebase/auth';
import {studentAuth} from '../../lib/firebase';
import {readStudentTerms, readStudentWorks, studentSignIn, studentSignOut} from '../../lib/student-portal-client';
import {StudentDashboard} from './student-dashboard';
import '../student-preview/student-preview.css';
import './student.css';

const enabled = process.env.NEXT_PUBLIC_STUDENT_PORTAL_ENABLED === 'true';

type Session =
  | {state: 'checking' | 'error' | 'signed-out'}
  | {state: 'signed-in'; user: User};

export default function StudentPage() {
  const [session, setSession] = useState<Session>({state: 'checking'});
  const [authAttempt, setAuthAttempt] = useState(0);
  const [theme, setTheme] = useState<'sakura' | 'mint'>('sakura');

  useEffect(() => {
    if (!enabled) return;
    try {
      return onAuthStateChanged(studentAuth(), (user) => {
        setSession(user ? {state: 'signed-in', user} : {state: 'signed-out'});
      }, () => setSession({state: 'error'}));
    } catch {
      setSession({state: 'error'});
    }
  }, [authAttempt]);

  return (
    <main className="student-preview student-portal" data-theme={theme}>
      <header id="student-overview">
        <span className="student-avatar" aria-hidden="true">🌸</span>
        <h1>ระบบนักเรียน</h1>
      </header>
      {!enabled ? (
        <section>
          <h2>ยังไม่เปิดให้บริการ</h2>
          <a href="/student-preview">ทดลองหน้าจอจำลอง</a>
        </section>
      ) : session.state === 'checking' ? (
        <p role="status">กำลังตรวจสอบบัญชี…</p>
      ) : session.state === 'error' ? (
        <section>
          <p role="alert">ตรวจสอบบัญชีไม่ได้</p>
          <button type="button" onClick={() => {
            setSession({state: 'checking'});
            setAuthAttempt((attempt) => attempt + 1);
          }}>ลองอีกครั้ง</button>
        </section>
      ) : session.state === 'signed-in' ? (
        <StudentDashboard
          key={session.user.uid}
          readTerms={readStudentTerms}
          readWorks={readStudentWorks}
          signOut={studentSignOut}
          theme={theme}
          setTheme={setTheme}
        />
      ) : (
        <StudentLogin />
      )}
    </main>
  );
}

function StudentLogin() {
  const [studentNumber, setStudentNumber] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      await studentSignIn(studentNumber, password);
    } catch {
      setMessage('เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจสอบรหัสประจำตัวและรหัสผ่าน หรือติดต่อผู้ดูแลโรงเรียน');
    } finally {
      setPassword('');
      setBusy(false);
    }
  }

  return (
    <section>
      <h2>เข้าสู่ระบบ</h2>
      <form className="student-portal-form" onSubmit={login}>
        <label>
          รหัสประจำตัวนักเรียน
          <input inputMode="numeric" pattern="[0-9]{1,32}" maxLength={32} autoComplete="username" required
            disabled={busy} value={studentNumber} onChange={(event) => setStudentNumber(event.target.value)} />
        </label>
        <label>
          รหัสผ่าน
          <input type="password" autoComplete="current-password" required
            disabled={busy} value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        <button type="submit" disabled={busy}>{busy ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}</button>
      </form>
      {message && <p role="alert">{message}</p>}
      <p>เข้าครั้งแรกหรือลืมรหัสผ่าน ให้ติดต่อผู้ดูแลโรงเรียน</p>
    </section>
  );
}
