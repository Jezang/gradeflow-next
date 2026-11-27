'use client';

import {useEffect, useRef, useState, type FormEvent} from 'react';
import type {User} from 'firebase/auth';
import {studentAdminAuth} from './student-admin-auth';
import type {StudentEnrollmentChange} from '../../lib/student-enrollment-change';

const labels = {
  studentId: 'รหัสระเบียนนักเรียน',
  sourceTermId: 'รหัสภาคเรียนต้นทาง',
  sourceRoomId: 'รหัสห้องต้นทาง',
  targetTermId: 'รหัสภาคเรียนปลายทาง',
  targetRoomId: 'รหัสห้องปลายทาง',
};
const idPattern = '[A-Za-z0-9_\\-]{1,128}';
const errors: Record<number, string> = {
  400: 'ตรวจสอบรหัส ภาคเรียน และเวลาที่มีผล',
  401: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่',
  403: 'บัญชีนี้ไม่มีสิทธิ์จัดการการย้ายห้องหรือเลื่อนชั้น',
  404: 'ไม่พบนักเรียน ห้อง ภาคเรียน หรือรายการจัดการสอนที่ต้องใช้',
  409: 'ข้อมูลขัดแย้ง ตรวจสอบรายชื่อ ช่วงเรียน และถอนการเผยแพร่ภาคเรียนปลายทางก่อนลองอีกครั้ง',
  503: 'บริการจัดการการย้ายห้องและเลื่อนชั้นยังไม่พร้อมใช้งาน',
};

export default function EnrollmentEditor({user}: {user: User}) {
  const [action, setAction] = useState<StudentEnrollmentChange['action']>('transfer');
  const [notice, setNotice] = useState<{kind: 'error' | 'success'; text: string}>();
  const [busy, setBusy] = useState(false);
  const request = useRef<AbortController | null>(null);
  const previousAttempt = useRef<{payload: string; operationId: string} | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (request.current) return;
    const fields = new FormData(event.currentTarget);
    const field = (name: string) => String(fields.get(name) ?? '').trim();
    const sourceTermId = field('sourceTermId');
    const input = {
      action,
      studentId: field('studentId'),
      sourceTermId,
      sourceRoomId: field('sourceRoomId'),
      targetTermId: action === 'transfer' ? sourceTermId : field('targetTermId'),
      targetRoomId: field('targetRoomId'),
      effectiveAt: Date.parse(field('effectiveAt') + '+07:00'),
    };
    if (!Number.isFinite(input.effectiveAt) || input.effectiveAt > Date.now() ||
        (action === 'transfer' && input.sourceRoomId === input.targetRoomId) ||
        (action === 'promote' && sourceTermId === input.targetTermId)) {
      setNotice({kind: 'error', text: errors[400]});
      return;
    }

    const actionLabel = action === 'transfer' ? 'ย้ายห้อง' : 'เลื่อนชั้น';
    if (!window.confirm(`ยืนยัน${actionLabel}นักเรียน ${input.studentId} ไปห้อง ${input.targetRoomId} ภาคเรียน ${input.targetTermId} หรือไม่`)) return;
    const payload = JSON.stringify(input);
    const operationId = previousAttempt.current?.payload === payload
      ? previousAttempt.current.operationId
      : crypto.randomUUID();
    previousAttempt.current = {payload, operationId};

    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setNotice(undefined);
    const currentActor = () => !controller.signal.aborted && studentAdminAuth().currentUser?.uid === user.uid;
    try {
      const token = await user.getIdToken();
      if (!currentActor()) return;
      const response = await fetch('/api/student/enrollment', {
        method: 'POST',
        headers: {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'},
        cache: 'no-store',
        body: JSON.stringify({...input, operationId}),
        signal: controller.signal,
      });
      if (!currentActor()) return;
      if (!response.ok) {
        setNotice({kind: 'error', text: errors[response.status] ?? 'บันทึกไม่สำเร็จ'});
        return;
      }
      const result = await response.json();
      if (!currentActor()) return;
      if (result.operationId !== operationId || !Number.isSafeInteger(result.targetCourses) ||
          result.targetCourses < 1 || !Array.isArray(result.termsToPublish)) throw Error('Invalid enrollment response');
      setNotice({kind: 'success', text: `${actionLabel}สำเร็จ เพิ่มรายชื่อปลายทาง ${result.targetCourses} รายวิชา กรุณาเผยแพร่ผลภาคเรียน ${input.targetTermId} ใหม่`});
    } catch {
      if (!controller.signal.aborted) setNotice({kind: 'error', text: 'ยังยืนยันผลไม่ได้ ส่งข้อมูลชุดเดิมอีกครั้งเพื่อตรวจสอบผลโดยไม่บันทึกซ้ำ'});
    } finally {
      request.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  return (
    <section aria-labelledby="student-enrollment-heading">
      <h2 id="student-enrollment-heading">ย้ายห้องและเลื่อนชั้น</h2>
      <p>เตรียมห้องและรายการจัดการสอนปลายทางก่อน หากภาคเรียนปลายทางเผยแพร่แล้ว ให้ถอนการเผยแพร่ก่อนบันทึกและเผยแพร่ใหม่ภายหลัง</p>
      <form onSubmit={submit}>
        <fieldset disabled={busy}>
          <label>ประเภทการเปลี่ยนแปลง
            <select value={action} onChange={event => setAction(event.target.value === 'promote' ? 'promote' : 'transfer')}>
              <option value="transfer">ย้ายห้องในภาคเรียนเดิม</option>
              <option value="promote">เลื่อนชั้นไปภาคเรียนใหม่</option>
            </select>
          </label>
          {Object.entries(labels).map(([name, label]) => (name !== 'targetTermId' || action === 'promote') && (
            <label key={name}>{label}
              <input name={name} required pattern={idPattern} maxLength={128} autoComplete="off" spellCheck={false} />
            </label>
          ))}
          <label>วันที่และเวลาที่มีผล (เวลาไทย)
            <input name="effectiveAt" type="datetime-local" required />
          </label>
          <button type="submit">{action === 'transfer' ? 'ย้ายห้อง' : 'เลื่อนชั้น'}</button>
        </fieldset>
      </form>
      {busy && <p role="status">กำลังบันทึก…</p>}
      {notice && <p role={notice.kind === 'error' ? 'alert' : 'status'}>{notice.text}</p>}
    </section>
  );
}
