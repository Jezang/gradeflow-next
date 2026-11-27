'use client';
import {useState} from 'react';
import {planStudentAccount,type AccountPlan} from '../../lib/student-account-plan';
import '../student-preview/student-preview.css';
const students=[{id:'demo-s1',name:'นักเรียนตัวอย่าง A',room:'ม.2/1'},{id:'demo-s2',name:'นักเรียนตัวอย่าง B',room:'ม.2/2'}];
const accounts=[{uid:'demo-u1',email:'student-a@example.invalid'},{uid:'demo-u2',email:'student-b@example.invalid'}];
export default function StudentAdminPreview(){
 const [plans,setPlans]=useState<AccountPlan[]>([]),[sid,setSid]=useState(students[0].id),[uid,setUid]=useState(accounts[0].uid),[message,setMessage]=useState('');
 function apply(studentId:string,accountUid:string,active:boolean){
 try{const p=planStudentAccount({uid:accountUid,studentId,active,studentExists:students.some(s=>s.id===studentId),authExists:accounts.some(a=>a.uid===accountUid),binding:plans.find(p=>p.binding.uid===accountUid)?.binding??null,owner:plans.find(p=>p.owner.studentId===studentId)?.owner??null});setPlans(prev=>[...prev.filter(x=>x.binding.uid!==accountUid),p]);setMessage(active?'เปิดสิทธิ์บัญชีจำลองแล้ว':'ระงับสิทธิ์บัญชีจำลองแล้ว')}catch{setMessage('ไม่สามารถดำเนินการได้: ตรวจสอบการผูกบัญชีซ้ำ')}
 }
 return <main className="student-preview"><header><small>ADMIN PREVIEW · DEMO ONLY</small><h1>🌸 จัดการบัญชีนักเรียน</h1><p>ข้อมูลสมมติ ไม่เชื่อม Firebase และไม่บันทึกถาวร</p></header><section><h2>ผูกบัญชี</h2><form onSubmit={e=>{e.preventDefault();apply(sid,uid,true)}}><label>นักเรียน<select value={sid} onChange={e=>setSid(e.target.value)}>{students.map(s=><option key={s.id} value={s.id}>{s.name} · {s.room}</option>)}</select></label><label>บัญชี<select value={uid} onChange={e=>setUid(e.target.value)}>{accounts.map(a=><option key={a.uid} value={a.uid}>{a.email}</option>)}</select></label><button>ผูกบัญชีจำลอง</button></form><p role="status">{message}</p></section><section><h2>รายชื่อนักเรียน</h2>{students.map(s=>{const p=plans.find(p=>p.owner.studentId===s.id);return <article key={s.id}><h3>{s.name}</h3><p>{s.room} · {p?p.binding.active?'เปิดใช้งาน':'ระงับสิทธิ์':'ยังไม่ผูกบัญชี'}</p>{p&&<button onClick={()=>apply(s.id,p.binding.uid,!p.binding.active)}>{p.binding.active?'ระงับสิทธิ์':'คืนสิทธิ์'}</button>}</article>})}</section></main>
}
