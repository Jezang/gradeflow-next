'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { User } from 'firebase/auth';
import { studentAdminAuth } from './student-admin-auth';
import { parseStudentMembershipWindows, type StudentMembershipWindow } from '../../lib/student-membership-windows';

const ids = {
  studentId: 'รหัสระเบียนนักเรียน',
  termId: 'รหัสภาคเรียน',
  courseId: 'รหัสรายการจัดการสอน',
};
const bangkokOffset = 7 * 60 * 60 * 1000;

type Scope = Record<keyof typeof ids, string>;
type DateWindow = { key: number; from: string; until: string };
type Membership = { scope: Scope; version: number; usesLegacyRoster: boolean; windows: DateWindow[] };

function toBangkokInput(time: number) {
  return new Date(time + bangkokOffset).toISOString().slice(0, -1);
}

export default function MembershipEditor({ user }: { user: User }) {
  const [membership, setMembership] = useState<Membership | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const nextKey = useRef(0);
  const request = useRef<AbortController | null>(null);

  useEffect(() => () => request.current?.abort(), []);

  async function loadMembership(scope: Scope, changes?: { expectedVersion: number; windows: StudentMembershipWindow[] }) {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const token = await user.getIdToken();
      const currentActor = () => !controller.signal.aborted && studentAdminAuth().currentUser?.uid === user.uid;
      if (!currentActor()) return;
      const url = '/api/student/membership' + (changes ? '' : '?' + new URLSearchParams(scope));
      const response = await fetch(url, {
        method: changes ? 'POST' : 'GET',
        headers: { Authorization: `Bearer ${token}`, ...(changes && { 'Content-Type': 'application/json' }) },
        body: changes ? JSON.stringify({ ...scope, ...changes }) : undefined,
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!currentActor()) return;
      if (!response.ok) {
        const errors: Record<number, string> = {
          400: 'ตรวจสอบรหัสและช่วงวันที่อีกครั้ง',
          401: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่',
          403: 'บัญชีนี้ไม่มีสิทธิ์จัดการช่วงเรียน',
          404: 'ไม่พบระเบียนนักเรียนหรือรายการจัดการสอนในภาคเรียนนี้',
          409: 'ตรวจสอบสถานะการเผยแพร่ผลการเรียนแล้วโหลดข้อมูลช่วงเรียนล่าสุด',
          503: 'บริการจัดการช่วงเรียนยังไม่พร้อมใช้งาน',
        };
        setError(errors[response.status] ?? 'ดำเนินการไม่สำเร็จ');
        return;
      }
      const result = await response.json();
      if (!currentActor()) return;
      if (!Number.isSafeInteger(result.version) || result.version < 0) throw Error('Invalid membership response');
      const windows = result.windows === null ? null : parseStudentMembershipWindows(result.windows);
      setMembership({
        scope,
        version: result.version,
        usesLegacyRoster: windows === null,
        windows: (windows ?? []).map(({ from, until }) => ({
          key: nextKey.current++,
          from: toBangkokInput(from),
          until: until === null ? '' : toBangkokInput(until),
        })),
      });
      if (changes) setMessage('บันทึกช่วงเรียนแล้ว');
    } catch {
      if (!controller.signal.aborted) setError('ยืนยันผลจากระบบไม่ได้ กรุณาโหลดข้อมูลอีกครั้ง');
    } finally {
      if (request.current === controller) request.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void loadMembership({
      studentId: String(data.get('studentId') ?? ''),
      termId: String(data.get('termId') ?? ''),
      courseId: String(data.get('courseId') ?? ''),
    });
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!membership || request.current) return;
    let windows: StudentMembershipWindow[];
    try {
      windows = parseStudentMembershipWindows(membership.windows.map(({ from, until }) => ({
        from: Date.parse(from + '+07:00'),
        until: until ? Date.parse(until + '+07:00') : null,
      })));
    } catch {
      setError('เรียงช่วงเรียนจากเก่าไปใหม่และตรวจสอบวันที่เริ่ม สิ้นสุด และช่วงที่ทับซ้อนกัน');
      return;
    }
    const confirmation = windows.length
      ? 'ยืนยันบันทึกช่วงเรียนและใช้ช่วงเหล่านี้คำนวณผลที่เผยแพร่หรือไม่'
      : 'ยืนยันกำหนดว่านักเรียนไม่มีช่วงเรียนในรายวิชานี้หรือไม่';
    if (window.confirm(confirmation)) void loadMembership(membership.scope, { expectedVersion: membership.version, windows });
  }

  function updateWindow(key: number, field: 'from' | 'until', value: string) {
    setMembership(current => current && ({
      ...current,
      windows: current.windows.map(row => row.key === key ? { ...row, [field]: value } : row),
    }));
  }

  return (
    <section aria-labelledby="student-admin-membership">
      <h2 id="student-admin-membership">ช่วงเรียนในรายวิชา</h2>
      <form onSubmit={search}>
        <fieldset disabled={busy || membership !== null}>
          {Object.entries(ids).map(([name, label]) => (
            <label key={name}>{label}
              <input name={name} required pattern={'[A-Za-z0-9_\\-]{1,128}'} maxLength={128} autoComplete="off" spellCheck={false} />
            </label>
          ))}
          <button type="submit">โหลดช่วงเรียน</button>
        </fieldset>
      </form>
      {membership && (
        <form onSubmit={save}>
          <fieldset disabled={busy}>
            <p>{membership.usesLegacyRoster
              ? 'รายวิชานี้ใช้รายชื่อผู้เรียนเดิมสำหรับนักเรียนคนนี้ การบันทึกจะใช้ช่วงเรียนที่ระบุแทน'
              : 'ระบบใช้ช่วงเรียนที่บันทึกสำหรับนักเรียนคนนี้'}</p>
            <p>ใช้เวลาไทย (UTC+7) เว้นเวลาสิ้นสุดไว้หากยังเรียนอยู่</p>
            {membership.windows.map(({ key, from, until }, index) => (
              <fieldset key={key}>
                <legend>ช่วงที่ {index + 1}</legend>
                <label>เริ่มเรียน
                  <input required type="datetime-local" step={0.001} value={from} onChange={(event) => updateWindow(key, 'from', event.target.value)} />
                </label>
                <label>สิ้นสุด
                  <input type="datetime-local" step={0.001} value={until} onChange={(event) => updateWindow(key, 'until', event.target.value)} />
                </label>
                <button type="button" onClick={() => setMembership({ ...membership, windows: membership.windows.filter(row => row.key !== key) })}>ลบช่วงที่ {index + 1}</button>
              </fieldset>
            ))}
            <button type="button" disabled={membership.windows.length >= 450} onClick={() => setMembership({
              ...membership, windows: [...membership.windows, { key: nextKey.current++, from: '', until: '' }],
            })}>เพิ่มช่วงเรียน</button>
            <button type="submit">บันทึกช่วงเรียน</button>
            <button type="button" onClick={() => { setMembership(null); setMessage(''); setError(''); }}>กลับไปค้นหา</button>
          </fieldset>
        </form>
      )}
      {busy && <p role="status">กำลังจัดการช่วงเรียน…</p>}
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
