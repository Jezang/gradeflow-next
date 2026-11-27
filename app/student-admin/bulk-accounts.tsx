'use client';

import {useEffect, useRef, useState, type FormEvent} from 'react';
import type {User} from 'firebase/auth';
import {studentAdminAuth} from './student-admin-auth';

type Result =
  | {studentId: string; status: 'issued'; uid: string; password: string}
  | {studentId: string; status: 'unavailable'};

export default function BulkAccounts({user}: {user: User}) {
  const request = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [error, setError] = useState('');
  useEffect(() => () => request.current?.abort(), []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (request.current) return;
    setError('');
    setResults([]);
    const text = new FormData(event.currentTarget).get('studentIds');
    const studentIds = String(text ?? '').trim().split(/\s+/);
    if (studentIds.length > 10 || new Set(studentIds).size !== studentIds.length ||
        studentIds.some(id => !/^[A-Za-z0-9_-]{1,128}$/.test(id))) {
      setError('กรอกรหัสระเบียนที่ไม่ซ้ำกัน 1–10 รายการ');
      return;
    }
    if (!window.confirm(`ยืนยันสร้างบัญชีนักเรียน ${studentIds.length} รายการหรือไม่`)) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    const stillSignedIn = () => !controller.signal.aborted && studentAdminAuth().currentUser?.uid === user.uid;
    try {
      const token = await user.getIdToken();
      if (!stillSignedIn()) return;
      const response = await fetch('/api/student/accounts/bulk', {
        method: 'POST',
        headers: {'Content-Type': 'application/json', Authorization: `Bearer ${token}`},
        body: JSON.stringify({studentIds}),
        signal: controller.signal,
        cache: 'no-store',
      });
      if (!response.ok) throw Error('Batch unavailable');
      const body: {results: Result[]} = await response.json();
      if (stillSignedIn()) setResults(body.results);
    } catch {
      if (stillSignedIn()) setError('สร้างบัญชีแบบกลุ่มไม่สำเร็จ กรุณาตรวจสอบรายชื่อและสถานะบัญชีก่อนลองใหม่');
    } finally {
      request.current = null;
      if (stillSignedIn()) setBusy(false);
    }
  }

  return (
    <section aria-labelledby="student-bulk-accounts">
      <h2 id="student-bulk-accounts">สร้างบัญชีแบบกลุ่ม</h2>
      <form onSubmit={submit} onChange={() => setResults([])}>
        <fieldset disabled={busy}>
          <label>รหัสระเบียนนักเรียน คนละบรรทัด สูงสุด 10 คน
            <textarea name="studentIds" required maxLength={1290} rows={4} />
          </label>
          <button type="submit">สร้างบัญชีแบบกลุ่ม</button>
        </fieldset>
      </form>
      {busy && <p role="status">กำลังสร้างบัญชี…</p>}
      {error && <p role="alert">{error}</p>}
      {results.length > 0 && <>
        <p role="status">สร้างสำเร็จ {results.filter(result => result.status === 'issued').length} จาก {results.length} บัญชี</p>
        <p>เปิดดูรหัสผ่านทีละบัญชีและส่งผ่านช่องทางส่วนตัว</p>
        {results.map(result => result.status === 'issued'
          ? <details key={result.studentId}><summary>{result.studentId}</summary><p><code>{result.password}</code></p></details>
          : <p key={result.studentId}>{result.studentId} · สร้างบัญชีไม่สำเร็จ</p>)}
        <button type="button" onClick={() => setResults([])}>ล้างรหัสผ่านจากหน้าจอ</button>
      </>}
    </section>
  );
}
