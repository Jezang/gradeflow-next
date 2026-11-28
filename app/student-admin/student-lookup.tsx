'use client';

import {useState, type FormEvent} from 'react';
import type {User} from 'firebase/auth';
import {studentAdminAuth} from './student-admin-auth';

export function StudentLookup({user, select}: {user:User; select:(id:string)=>void}) {
  const [code,setCode] = useState('');
  const [result,setResult] = useState<{id:string;name:string;active:boolean}|null>(null);
  const [message,setMessage] = useState('');
  const [busy,setBusy] = useState(false);

  async function search(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setResult(null);
    setMessage('');
    select('');
    try {
      const token = await user.getIdToken();
      if (studentAdminAuth().currentUser !== user) return;
      const response = await fetch('/api/student/lookup',{
        method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
        body:JSON.stringify({code}),
      });
      if (studentAdminAuth().currentUser !== user) return;
      if (response.status === 404) setMessage('ไม่พบนักเรียนรหัสนี้');
      else if (response.status === 409) setMessage('พบรหัสซ้ำ กรุณาตรวจสอบทะเบียนนักเรียน');
      else if (!response.ok) throw Error('Lookup failed');
      else {
        const student = await response.json();
        if (studentAdminAuth().currentUser !== user) return;
        setResult(student);
      }
    } catch {
      setMessage('ค้นหาไม่ได้ กรุณาลองอีกครั้ง');
    } finally {
      setBusy(false);
    }
  }

  return <section aria-labelledby="student-lookup-heading">
    <h2 id="student-lookup-heading">Smart Student Manager</h2>
    <form onSubmit={search}>
      <label>รหัสประจำตัวนักเรียน
        <input value={code} onChange={event => {setCode(event.target.value);setResult(null);setMessage('');select('')}} inputMode="numeric" pattern="[0-9]{1,32}" maxLength={32} required disabled={busy}/>
      </label>
      <button disabled={busy}>{busy?'กำลังค้นหา…':'ค้นหา'}</button>
    </form>
    {message && <p role="status">{message}</p>}
    {result && <p><strong>{result.name}</strong> · {result.active?'กำลังศึกษา':'ไม่ใช้งาน'} · <button type="button" onClick={() => select(result.id)}>ใช้ระเบียนนี้</button></p>}
  </section>;
}
