'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { onIdTokenChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { studentAdminAuth, studentAdminDemo } from './student-admin-auth';
import '../student-preview/student-preview.css';
import './student-admin.css';
import MembershipEditor from './membership-editor';
import EnrollmentEditor from './enrollment-editor';
import BulkAccounts from './bulk-accounts';

type Access =
  | { state: 'loading' | 'signed-out' | 'forbidden' | 'error' }
  | { state: 'authorized'; user: User; admin: boolean };

type Notice = { type: 'success' | 'error'; text: string };
type AccountAction = 'link' | 'suspend' | 'provision' | 'recover';
type PublicationAction = 'publish' | 'withdraw';

const enabled = process.env.NEXT_PUBLIC_STUDENT_PORTAL_ADMIN_ENABLED === 'true';
const idPattern = '[A-Za-z0-9_\\-]{1,128}';
const accountActions: Record<AccountAction, string> = {
  link: 'ผูกบัญชีหรือคืนสิทธิ์',
  suspend: 'ระงับสิทธิ์',
  provision: 'สร้างบัญชี',
  recover: 'ออกรหัสผ่านใหม่',
};
const publicationActions: Record<PublicationAction, string> = {
  publish: 'เผยแพร่ผลการเรียน',
  withdraw: 'ถอนการเผยแพร่',
};

export default function StudentAdminPage() {
  const [access, setAccess] = useState<Access>({ state: 'loading' });

  useEffect(() => {
    if (!enabled) return;
    let generation = 0;
    const unsubscribe = onIdTokenChanged(studentAdminAuth(), async (user) => {
      const current = ++generation;
      if (!user) {
        setAccess({ state: 'signed-out' });
        return;
      }
      try {
        const { claims } = await user.getIdTokenResult();
        if (current !== generation) return;
        const admin = claims.admin === true;
        setAccess(admin || claims.studentPublisher === true
          ? { state: 'authorized', user, admin }
          : { state: 'forbidden' });
      } catch {
        if (current === generation) setAccess({ state: 'error' });
      }
    });
    return () => {
      generation++;
      unsubscribe();
    };
  }, []);

  return (
    <main className="student-preview student-admin">
      <header>
        <h1>จัดการ Student Portal</h1>
        <nav aria-label="พื้นที่ทำงาน">
          <Link href="/workspace">พื้นที่ทำงานครู</Link>
          <Link href="/student-admin-preview">ตัวอย่างข้อมูลสมมติ</Link>
        </nav>
      </header>
      {!enabled ? (
        <section><h2>ระบบจัดการนักเรียนยังไม่เปิดให้บริการ</h2></section>
      ) : access.state === 'authorized' ? (
        <>
          {studentAdminDemo && <button type="button" onClick={() => void signOut(studentAdminAuth())}>ออกจากบัญชีทดสอบ</button>}
          <ManagementForms key={access.user.uid + ':' + access.admin} user={access.user} admin={access.admin} />
        </>
      ) : (
        <section>
          {access.state === 'loading' && <p role="status">กำลังตรวจสอบสิทธิ์…</p>}
          {access.state === 'signed-out' && (studentAdminDemo
            ? <DemoSignIn />
            : <Link href="/login">เข้าสู่ระบบด้วยบัญชีเจ้าหน้าที่</Link>)}
          {access.state === 'forbidden' && <p role="alert">บัญชีนี้ไม่มีสิทธิ์จัดการ Student Portal</p>}
          {access.state === 'error' && <p role="alert">ตรวจสอบสิทธิ์ไม่ได้ กรุณาโหลดหน้าใหม่</p>}
        </section>
      )}
    </main>
  );
}

function ManagementForms({ user, admin }: { user: User; admin: boolean }) {
  const [accountAction, setAccountAction] = useState<AccountAction>('provision');
  const [publicationAction, setPublicationAction] = useState<PublicationAction>('publish');
  const [pending, setPending] = useState<'account' | 'publication' | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [issued, setIssued] = useState<{ password: string; uid: string; studentId: string } | null>(null);
  const request = useRef<AbortController | null>(null);
  const useExistingAccount = accountAction === 'link' || accountAction === 'suspend';

  useEffect(() => () => request.current?.abort(), []);

  async function submit(
    target: 'account' | 'publication',
    body: Record<string, string | boolean>,
    confirmation: string,
  ) {
    if (request.current) return;
    setNotice(null);
    setIssued(null);
    if (!window.confirm(confirmation)) return;

    const controller = new AbortController();
    request.current = controller;
    setPending(target);
    try {
      const auth = studentAdminAuth();
      const token = await user.getIdToken();
      if (auth.currentUser?.uid !== user.uid || controller.signal.aborted) return;

      const response = await fetch(target === 'account' ? '/api/student/accounts' : '/api/student/publication', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        cache: 'no-store',
        signal: controller.signal,
        body: JSON.stringify(body),
      });

      if (auth.currentUser?.uid !== user.uid || controller.signal.aborted) return;

      if (!response.ok) {
        const messages: Record<number, string> = {
          400: 'ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบรหัสที่กรอก',
          401: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่',
          403: 'ดำเนินการไม่ได้ กรุณาตรวจสอบสิทธิ์และข้อมูลที่กรอก',
          409: 'ข้อมูลเปลี่ยนแปลง กรุณาตรวจสอบก่อนลองอีกครั้ง',
          429: 'ส่งคำขอบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่',
          503: 'บริการจัดการ Student Portal ยังไม่พร้อมใช้งาน',
        };
        setNotice({ type: 'error', text: messages[response.status] ?? 'ดำเนินการไม่สำเร็จ' });
        return;
      }

      const result = await response.json();
      if (auth.currentUser?.uid !== user.uid || controller.signal.aborted) return;

      if (target === 'account' && result?.ok === true) {
        if (typeof result.password === 'string' && typeof result.uid === 'string') {
          setIssued({ password: result.password, uid: result.uid, studentId: String(body.studentId) });
        }
        setNotice({ type: 'success', text: 'บันทึกบัญชีเรียบร้อย' });
      } else if (target === 'publication' && typeof result?.published === 'number') {
        setNotice({ type: 'success', text: `เผยแพร่แล้ว ${result.published} รายการ` });
      } else if (target === 'publication' && result?.withdrawn === true) {
        setNotice({ type: 'success', text: 'ถอนการเผยแพร่ภาคเรียนแล้ว' });
      } else {
        setNotice({ type: 'error', text: 'ยืนยันผลจากระบบไม่ได้ กรุณาตรวจสอบก่อนส่งคำขออีกครั้ง' });
      }
    } catch {
      if (!controller.signal.aborted) {
        setNotice({ type: 'error', text: 'การเชื่อมต่อขัดข้อง กรุณาตรวจสอบผลก่อนส่งคำขออีกครั้ง' });
      }
    } finally {
      if (request.current === controller) request.current = null;
      if (!controller.signal.aborted) setPending(null);
    }
  }

  function submitAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!admin) return;
    const fields = new FormData(event.currentTarget);
    const studentId = String(fields.get('studentId') ?? '');
    const body: Record<string, string | boolean> = useExistingAccount
      ? { studentId, uid: String(fields.get('uid') ?? ''), active: accountAction === 'link' }
      : { studentId, action: accountAction };
    void submit('account', body, `ยืนยัน${accountActions[accountAction]}ของนักเรียนรหัส ${studentId} หรือไม่`);
  }

  function submitPublication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const studentId = String(fields.get('studentId') ?? '');
    const termId = String(fields.get('termId') ?? '');
    void submit(
      'publication',
      { studentId, termId, action: publicationAction },
      `ยืนยัน${publicationActions[publicationAction]}ของนักเรียนรหัส ${studentId} ภาคเรียน ${termId} หรือไม่`,
    );
  }

  return (
    <>
      {admin && (
        <section aria-labelledby="student-admin-accounts">
          <h2 id="student-admin-accounts">บัญชีนักเรียน</h2>
          <form onSubmit={submitAccount} onChange={() => setIssued(null)}>
            <fieldset disabled={pending !== null}>
              <label>
                การจัดการบัญชี
                <select value={accountAction} onChange={(event) => setAccountAction(event.target.value as AccountAction)}>
                  {Object.entries(accountActions).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <IdInput name="studentId" label="รหัสระเบียนนักเรียน" />
              {useExistingAccount && <IdInput name="uid" label="Firebase UID ของบัญชีนักเรียน" />}
              <button type="submit">{accountActions[accountAction]}</button>
            </fieldset>
          </form>
        </section>
      )}
      {admin && issued && (
        <section aria-labelledby="student-issued-password">
          <h2 id="student-issued-password">รหัสผ่านที่ออกให้</h2>
          <p>ส่งรหัสผ่านให้นักเรียนผ่านช่องทางส่วนตัว แล้วซ่อนรหัสผ่านเมื่อเสร็จ</p>
          <p>รหัสระเบียนนักเรียน <code>{issued.studentId}</code></p>
          <p>Firebase UID <code>{issued.uid}</code></p>
          <p><code data-issued-password>{issued.password}</code></p>
          <button type="button" onClick={() => setIssued(null)}>ซ่อนรหัสผ่าน</button>
        </section>
      )}
      {admin && <BulkAccounts user={user} />}
      <section aria-labelledby="student-admin-publication">
        <h2 id="student-admin-publication">เผยแพร่ผลการเรียน</h2>
        <form onSubmit={submitPublication}>
          <fieldset disabled={pending !== null}>
            <label>
              การเผยแพร่
              <select value={publicationAction} onChange={(event) => setPublicationAction(event.target.value as PublicationAction)}>
                {Object.entries(publicationActions).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <IdInput name="studentId" label="รหัสระเบียนนักเรียน" />
            <IdInput name="termId" label="รหัสภาคเรียน" />
            <button type="submit">{publicationActions[publicationAction]}</button>
          </fieldset>
        </form>
      </section>
      {admin && <EnrollmentEditor user={user} />}
      {admin && <MembershipEditor user={user} />}
      <div aria-live="polite" aria-atomic="true">
        {pending && <p role="status">กำลังดำเนินการ…</p>}
        {notice && <p role={notice.type === 'error' ? 'alert' : 'status'}>{notice.text}</p>}
      </div>
    </>
  );
}


function DemoSignIn() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError(false);
    try {
      await signInWithEmailAndPassword(studentAdminAuth(), String(data.get('email')), String(data.get('password')));
    } catch {
      setError(true);
    } finally {
      form.reset();
      setBusy(false);
    }
  }

  return (
    <form onSubmit={signIn}>
      <fieldset disabled={busy}>
        <legend>เข้าสู่ระบบด้วยบัญชีทดสอบของ Emulator</legend>
        <label>อีเมลทดสอบ <input name="email" type="email" required autoComplete="off" /></label>
        <label>รหัสผ่านทดสอบ <input name="password" type="password" required autoComplete="off" /></label>
        <button type="submit">เข้าสู่ระบบทดสอบ</button>
      </fieldset>
      {error && <p role="alert">เข้าสู่ระบบทดสอบไม่สำเร็จ</p>}
    </form>
  );
}

function IdInput({ name, label }: { name: string; label: string }) {
  return (
    <label>
      {label}
      <input name={name} required pattern={idPattern} maxLength={128} autoComplete="off" spellCheck={false} />
    </label>
  );
}
