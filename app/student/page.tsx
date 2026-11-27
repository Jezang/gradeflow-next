'use client';
import {useState,useEffect,useRef,type FormEvent} from 'react';
import {studentSignIn,studentSignOut,readStudentWorks,readStudentTerms} from '../../lib/student-portal-client';
import {studentAuth} from '../../lib/firebase';
import {onAuthStateChanged} from 'firebase/auth';
import {studentProgress,studentWorkState,type StudentWork} from '../../lib/student-foundation';
import '../student-preview/student-preview.css';
const enabled=process.env.NEXT_PUBLIC_STUDENT_PORTAL_ENABLED==='true';
const labels={graded:'ตรวจแล้ว',pending:'ส่งแล้ว รอคะแนน',missing:'ยังไม่ส่ง',leave:'ลา',absent:'ขาด',revision:'อยู่ในช่วงแก้งาน',overdue:'เลยกำหนด'};
export default function StudentPage(){
 const [uid,setUid]=useState(''),[ready,setReady]=useState(false),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[term,setTerm]=useState(''),[works,setWorks]=useState<StudentWork[]>([]),[loaded,setLoaded]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const [terms,setTerms]=useState<{id:string;label:string}[]>([]),[termsReady,setTermsReady]=useState(false);
 const generation=useRef(0);
 useEffect(()=>{if(!enabled)return;return onAuthStateChanged(studentAuth(),u=>{generation.current++;setUid(u?.uid??'');setTerms([]);setTerm('');setTermsReady(false);setWorks([]);setLoaded(false);setBusy(false);setMessage('');setReady(true)})},[]);
 useEffect(()=>{if(!uid)return;let cancelled=false;readStudentTerms().then(rows=>{if(!cancelled){setTerms(rows);setTerm(rows[0]?.id??'');setTermsReady(true)}}).catch(()=>{if(!cancelled)setMessage('ไม่สามารถโหลดภาคเรียนได้ กรุณาเข้าสู่ระบบใหม่')});return()=>{cancelled=true}},[uid]);
 async function login(e:FormEvent){e.preventDefault();setBusy(true);setMessage('');try{await studentSignIn(email,password)}catch{setMessage('เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจสอบบัญชี')}finally{setPassword('');setBusy(false)}}
 async function load(e:FormEvent){e.preventDefault();const ticket=++generation.current;setWorks([]);setLoaded(false);setBusy(true);setMessage('');try{const rows=await readStudentWorks(term);if(ticket===generation.current){setWorks(rows);setLoaded(true)}}catch{if(ticket===generation.current)setMessage('ไม่สามารถอ่านข้อมูลได้ กรุณาติดต่อผู้ดูแล')}finally{if(ticket===generation.current)setBusy(false)}}
 async function logout(){generation.current++;setWorks([]);setLoaded(false);setBusy(true);try{await studentSignOut()}catch{setMessage('ออกจากระบบไม่สำเร็จ กรุณาลองอีกครั้ง')}finally{setBusy(false)}}
 const p=studentProgress(works);
 return <main className="student-preview"><header><span className="student-avatar">🌸</span><small>GRADEFLOW · SAKURA CLASSROOM</small><h1>ระบบนักเรียน</h1></header>
 {!enabled?<section><h2>ยังไม่เปิดให้บริการ</h2><p>ระบบกำลังเตรียมความพร้อม</p><a href="/student-preview">ทดลองหน้าจอจำลอง</a></section>:!ready?<p>กำลังตรวจสอบบัญชี…</p>:!uid?<section><h2>เข้าสู่ระบบ</h2><form onSubmit={login}><label>อีเมล<input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label>รหัสผ่าน<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></label><button disabled={busy}>เข้าสู่ระบบ</button></form></section>:<><section><button disabled={busy} onClick={logout}>ออกจากระบบ</button><form onSubmit={load}><label>ภาคเรียน<select required disabled={!termsReady||busy} value={term} onChange={e=>{generation.current++;setTerm(e.target.value);setWorks([]);setLoaded(false)}}><option value="">{termsReady?"เลือกภาคเรียน":"กำลังโหลด…"}</option>{terms.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}</select></label>{termsReady&&terms.length===0&&<p>ยังไม่มีภาคเรียนที่เผยแพร่</p>}<button disabled={busy||!term||!termsReady}>ดูงานของฉัน</button></form></section>{loaded&&<><section className="student-metrics">{[[p.total,'งานทั้งหมด'],[p.submitted,'ส่งแล้ว'],[p.outstanding,'งานค้าง'],[p.points+' / '+p.possible,'คะแนนที่ตรวจแล้ว']].map(([n,l])=><div key={l}><strong>{n}</strong><small>{l}</small></div>)}</section><section className="student-champion"><h2>🌸 Sakura Champions</h2><p>ส่งงานแล้ว {p.submitted} จาก {p.total} งาน</p><progress max={Math.max(1,p.total)} value={p.submitted}/></section><section><h2>งานของฉัน</h2>{works.length===0&&<p>ไม่พบงานในภาคเรียนนี้</p>}{works.map(w=><article key={w.id}><small>{w.course}</small><h3>{w.title}</h3><p>{labels[studentWorkState(w,Date.now())]}</p><p>คะแนน {w.score??'—'} / {w.maxScore}</p></article>)}</section></>}</>}
 {message&&<p role="alert">{message}</p>}</main>
}
