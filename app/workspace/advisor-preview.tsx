'use client';
import {useRef,useState} from 'react';
import {collection,getDocsFromServer,query,limit,doc,getDocFromServer,where} from 'firebase/firestore';
import {firebaseServices} from '../../lib/firebase';
import {advisorPreview,type AdvisorWork} from '../../lib/advisor-preview';

export default function AdvisorPreview({uid}:{uid:string}){
 const [courses,setCourses]=useState<{id:string;name:string}[]>([]),[course,setCourse]=useState(''),[busy,setBusy]=useState(false),[status,setStatus]=useState(''),[report,setReport]=useState<ReturnType<typeof advisorPreview>|null>(null);
 const locked=useRef(false);
 async function read(action:'courses'|'report'){
  if(locked.current)return;
  locked.current=true;setBusy(true);setReport(null);setStatus('กำลังอ่านข้อมูลจากเซิร์ฟเวอร์…');
  try{
   const {db,auth}=firebaseServices();
   const checkOwner=async()=>{
    if(auth.currentUser?.uid!==uid)throw Error('บัญชีเปลี่ยน กรุณาเข้าสู่ระบบใหม่');
    const profile=await getDocFromServer(doc(db,'profiles',uid));
    if(profile.metadata.hasPendingWrites||profile.data()?.role!=='super_admin'||profile.data()?.active!==true)throw Error('เฉพาะเจ้าของระบบ');
   };
   await checkOwner();
   if(action==='courses'){
    setCourse('');setCourses([]);
    const docs=await getDocsFromServer(query(collection(db,'teachingAssignments'),where('active','==',true),limit(501)));
    if(docs.size>500||docs.metadata.hasPendingWrites)throw Error('ข้อมูลรายวิชาเกินขีดจำกัดหรือยังไม่พร้อม');
    setCourses(docs.docs.map(d=>({id:d.id,name:[d.data().subjectId,d.data().roomId,d.data().termId].join(' · ')})));
    setStatus('เลือกรายวิชาและห้องที่ต้องการจำลอง');
   }else{
    if(!courses.some(c=>c.id===course))throw Error('กรุณาเลือกรายวิชา');
    const base=doc(db,'teachingAssignments',course);
    const selected=await getDocFromServer(base);
    if(selected.metadata.hasPendingWrites||selected.data()?.active!==true)throw Error('รายวิชาไม่เปิดใช้งาน');
    const [roster,works]=await Promise.all([
     getDocsFromServer(query(collection(base,'roster'),limit(501))),
     getDocsFromServer(query(collection(base,'work'),where('active','==',true),limit(41)))
    ]);
    if(roster.size>500||works.size>40||roster.metadata.hasPendingWrites||works.metadata.hasPendingWrites)throw Error('ข้อมูลยังไม่พร้อม หรือเกินขีดจำกัด 500 นักเรียน / 40 งาน');
    const assignments:AdvisorWork[]=[];
    for(const w of works.docs){
     const records=await getDocsFromServer(query(collection(w.ref,'submissions'),limit(501)));
     if(records.size>500||records.metadata.hasPendingWrites)throw Error('ข้อมูลคะแนนยังไม่พร้อมหรือเกินขีดจำกัด');
     const d=w.data();
     assignments.push({id:w.id,title:String(d.title),maxScore:d.maxScore,active:d.active,records:records.docs.map(r=>({id:r.id,score:r.data().score,submitted:r.data().submitted}))});
    }
    const result=advisorPreview(roster.docs.map(r=>({id:r.id,name:String(r.data().name),active:r.data().active})),assignments);
    await checkOwner();
    setReport(result);setStatus('อ่านข้อมูลสำเร็จ · ไม่ได้แก้ไขคะแนนหรือเผยแพร่รายงาน');
   }
  }catch(e){setReport(null);setStatus(e instanceof Error?e.message:'อ่านข้อมูลไม่ได้')}
  finally{locked.current=false;setBusy(false)}
 }
 return <section className="panel">
  <small>ADVISOR PORTAL · OWNER PREVIEW</small>
  <h2>ตัวอย่างรายงานครูที่ปรึกษา</h2>
  <p>เฉพาะเจ้าของระบบ · ยังไม่มีลิงก์สำหรับบุคคลอื่น · ข้อมูลอ่านอย่างเดียว</p>
  <div className="filters"><button type="button" disabled={busy} onClick={()=>void read('courses')}>โหลดรายวิชา</button>
   <label>รายวิชาและห้อง<select disabled={busy} value={course} onChange={e=>{setCourse(e.target.value);setReport(null);setStatus('')}}><option value="">เลือกรายวิชา</option>{courses.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
   <button type="button" className="primary" disabled={busy||!course} onClick={()=>void read('report')}>ดูตัวอย่างรายงาน</button>
  </div>
  <p role="status" aria-live="polite">{status}</p>
  {report&&<><div className="checking-counts"><span>นักเรียน<strong>{report.students.length}</strong></span><span>งานที่เปิดใช้<strong>{report.works.length}</strong></span><span>นักเรียนมีงานยังไม่ส่ง<strong>{report.students.filter(s=>s.missing>0).length}</strong></span></div>
  <p>คะแนนสะสมเฉพาะงานที่ตรวจแล้ว ไม่ใช่เกรดสุดท้าย · 0 คือคะแนนจริง · รอคะแนนและยังไม่ส่งไม่ใช่ศูนย์</p>
  <div className="score-table-scroll" role="region" aria-label="รายงานคะแนนตัวอย่าง" tabIndex={0}><table><thead><tr><th>นักเรียน</th><th>คะแนนสะสม</th><th>ยังไม่ส่ง</th><th>รอคะแนน</th>{report.works.map(w=><th key={w.id}>{w.title} ({w.maxScore})</th>)}</tr></thead><tbody>{report.students.map(s=><tr key={s.id}><td>{s.name}<br/><small>{s.id}</small></td><td>{s.graded?s.points+' / '+s.possible:'—'}</td><td>{s.missing}</td><td>{s.pending}</td>{s.cells.map(c=><td key={c.workId}>{c.state==='graded'?c.score:c.state==='pending'?'รอคะแนน':'ยังไม่ส่ง'}</td>)}</tr>)}</tbody></table></div>
  <small>รายงานอ่านหลายชุดข้อมูล ไม่ใช่ภาพถ่าย ณ เวลาเดียวกัน ควรหยุดแก้คะแนนขณะตรวจรับ</small></>}
 </section>
}
