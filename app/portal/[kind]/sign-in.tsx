'use client';

import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { portalAuth } from '../../../lib/firebase';
import type { PortalResult } from '../../../lib/portal-access';
import type { PortalKind } from '../../../lib/portal-release-policy';

export default function PortalSignIn({ kind }: { kind: PortalKind }) {
  const [results, setResults] = useState<PortalResult[] | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const emailInput = useRef<HTMLInputElement>(null);
  const passwordInput = useRef<HTMLInputElement>(null);
  const advisor = kind === 'advisor';

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const email = emailInput.current?.value.trim() ?? '';
    const password = passwordInput.current?.value ?? '';
    form.reset();
    setPending(true);
    setMessage('');

    try {
      const auth = portalAuth();
      const { user } = await signInWithEmailAndPassword(auth, email, password);
      try {
        const response = await fetch('/api/portal/' + kind, {
          headers: { Authorization: 'Bearer ' + await user.getIdToken() },
          cache: 'no-store',
        });
        if (!response.ok) throw new Error('Portal access denied');
        setResults((await response.json()).results);
      } finally {
        await signOut(auth);
      }
    } catch {
      setResults(null);
      setMessage('เปิดพอร์ทัลไม่ได้ กรุณาตรวจสอบบัญชีหรือติดต่อโรงเรียน');
    } finally {
      setPending(false);
    }
  }

  if (results) {
    return (
      <section className="panel">
        <header>
          <h2>ผลการเรียนที่เผยแพร่แล้ว</h2>
          <button onClick={() => setResults(null)}>ปิดผลการเรียน</button>
        </header>
        {results.length === 0 ? <p>ยังไม่มีผลการเรียนที่เผยแพร่</p> : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead><tr>
                {advisor && <th scope="col">นักเรียน</th>}
                <th scope="col">รายวิชา</th>
                <th scope="col">รายการประเมิน</th>
                <th scope="col">คะแนน</th>
              </tr></thead>
              <tbody>
                {results.map((row, index) => (
                  <tr key={index}>
                    {advisor && <td>{row.studentName} ({row.studentId})</td>}
                    <td>{row.course}</td>
                    <td>{row.assessment}</td>
                    <td>{row.score === null ? 'ยังไม่ให้คะแนน' : row.score + ' / ' + row.maxScore}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    );
  }

  return (
    <form className="panel login" method="post" onSubmit={signIn}>
      <p>ใช้บัญชีที่โรงเรียนจัดให้ หากลืมรหัสผ่าน โปรดติดต่อโรงเรียน</p>
      <label>อีเมล<input autoComplete="username" type="email" id="portal-email" ref={emailInput} required disabled={pending} /></label>
      <label>รหัสผ่าน<input autoComplete="current-password" type="password" id="portal-password" ref={passwordInput} required disabled={pending} /></label>
      <button className="primary" disabled={pending}>{pending ? 'กำลังตรวจสอบบัญชี…' : 'เปิดผลการเรียน'}</button>
      {message && <p role="alert">{message}</p>}
    </form>
  );
}
