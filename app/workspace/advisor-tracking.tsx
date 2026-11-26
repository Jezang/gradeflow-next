'use client';
import {useEffect,useRef,useState} from 'react';
import {collection,doc,getDocsFromServer,query,where,limit,setDoc,serverTimestamp} from 'firebase/firestore';
import {firebaseServices} from '../../lib/firebase';
import type {Role} from '../../lib/access';
import {attendanceFor,bangkokInput,deadlineLabels,deadlineState,timestampMillis} from '../../lib/work-tracking';
type Option={id:string;name:string};
type Entry={key:string;name:string;student:string;course:string;work:string;status:string;due:number|null;revision:number|null;submitted:boolean};
export default function AdvisorTracking({uid,role}:{uid:string;role:Role}){
 const owner=role==='super_admin',admin=role!=='teacher';
 const [rooms,setRooms]=useState<Option[]>([]),[teachers,setTeachers]=useState<Option[]>([]),[room,setRoom]=useState(''),[teacher,setTeacher]=useState(''),[grantRoom,setGrantRoom]=useState(''),[entries,setEntries]=useState<Entry[]|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[search,setSearch]=useState(''),[filter,setFilter]=useState('outstanding');
 const lock=useRef(false);
 async function execute(fn:()=>Promise<void>){if(lock.current)return;lock.current=true;setBusy(true);try{await fn()}catch(e){setMessage(e instanceof Error?e.message:'อ่านข้อมูลไม่ได้')}finally{lock.current=false;setBusy(false)}}
 async function loadRooms(){await execute(async()=>{
  setEntries(null);setRoom('');setRooms([]);setTeachers([]);const {db}=firebaseServices();
  if(admin){const rs=await getDocsFromServer(query(collection(db,'rooms'),where('active','==',true),limit(501)));if(rs.size>500)throw Error('ห้องเรียนเกินขีดจำกัด');setRooms(rs.docs.map(d=>({id:d.id,name:String(d.data().name)})));
   if(owner){const ps=await getDocsFromServer(query(collection(db,'profiles'),where('role','==','teacher'),limit(501)));if(ps.size>500)throw Error('ครูเกินขีดจำกัด');setTeachers(ps.docs.filter(d=>d.data().active===true).map(d=>({id:d.id,name:String(d.data().name||d.id)})))}
  }else{const rs=await getDocsFromServer(query(collection(db,'advisorAssignments',uid,'rooms'),limit(101)));if(rs.size>100)throw Error('ห้องที่ได้รับมอบหมายเกินขีดจำกัด');setRooms(rs.docs.filter(d=>d.data().active===true).map(d=>({id:d.id,name:d.id})))}
  setMessage('โหลดรายการห้องแล้ว');
 })}
 useEffect(()=>{void loadRooms()},[uid,role]);
 async function grant(active:boolean){if(!owner||!teacher||!grantRoom)return;await execute(async()=>{
  if(!window.confirm((active?'ให้':'ยกเลิก')+'สิทธิ์ดูข้อมูลห้อง '+grantRoom+' สำหรับครูที่เลือก?'))return;
  const {db}=firebaseServices();await setDoc(doc(db,'advisorAssignments',teacher,'rooms',grantRoom),{roomId:grantRoom,active,updatedBy:uid,updatedAt:serverTimestamp()});setMessage(active?'มอบหมายสิทธิ์ดูห้องแล้ว':'ยกเลิกสิทธิ์แล้ว');
 })}
 async function load(){if(!room)return;await execute(async()=>{
  setEntries(null);const {db}=firebaseServices(),selectedRoom=room;
  const courses=await getDocsFromServer(query(collection(db,'teachingAssignments'),where('roomId','==',selectedRoom),where('active','==',true),limit(41)));
  if(courses.size>40||courses.metadata.hasPendingWrites)throw Error('รายวิชาเกิน 40 หรือข้อมูลยังไม่พร้อม');
  const result:Entry[]=[];let workCount=0;
  for(const c of courses.docs){
   const [roster,works]=await Promise.all([getDocsFromServer(query(collection(c.ref,'roster'),limit(501))),getDocsFromServer(query(collection(c.ref,'work'),where('active','==',true),limit(41)))]);
   if(roster.size>500||works.size>40||roster.metadata.hasPendingWrites||works.metadata.hasPendingWrites||(workCount+=works.size)>100)throw Error('ข้อมูลเกินขีดจำกัด: 500 นักเรียน/รายวิชา, 100 งาน/ห้อง');
   const people=roster.docs.filter(d=>d.data().active===true);
   for(const w of works.docs){
    const [subs,att]=await Promise.all([getDocsFromServer(query(collection(w.ref,'submissions'),limit(501))),getDocsFromServer(query(collection(w.ref,'attendance'),limit(501)))]);
    if(subs.size>500||att.size>500||subs.metadata.hasPendingWrites||att.metadata.hasPendingWrites)throw Error('สถานะงานเกินขีดจำกัดหรือยังไม่พร้อม');
    const byId=new Map(subs.docs.map(d=>[d.id,d.data()])),marks=new Map(att.docs.map(d=>[d.id,d.data().status]));
    const d=w.data();
    for(const p of people){const s=byId.get(p.id),submitted=s?.submitted===true,a=attendanceFor(submitted,marks.get(p.id),s?.auditId?undefined:s?.legacy?.status);result.push({key:c.id+'/'+w.id+'/'+p.id,name:String(p.data().name),student:p.id,course:String(c.data().subjectId)+' · '+String(c.data().termId),work:String(d.title),status:submitted?(s?.score===null?'ส่งแล้ว รอคะแนน':'ตรวจแล้ว'):a==='leave'?'ลา':a==='absent'?'ขาด':'ยังไม่ส่ง',submitted,due:timestampMillis(d.deadline),revision:timestampMillis(d.revisionDeadline)});}
   }
  }
  setEntries(result);setMessage('อ่านข้อมูลสำเร็จ · กดโหลดใหม่เมื่อต้องการอัปเดต');
 })}
 const now=Date.now();const rows=entries?.filter(e=>(filter==='all'||(filter==='outstanding'&&!e.submitted)||(filter==='overdue'&&!e.submitted&&deadlineState(false,e.due,e.revision,now)==='overdue'))&&(e.name+' '+e.student+' '+e.course+' '+e.work).toLowerCase().includes(search.toLowerCase()))??[];
 return <section className="panel"><h2>ติดตามการส่งงาน · ครูที่ปรึกษา</h2><p>ดูสถานะข้ามรายวิชาในห้องที่ได้รับสิทธิ์เท่านั้น ไม่สามารถแก้คะแนนจากหน้านี้</p>
 {owner&&<details className="panel"><summary>จัดการสิทธิ์ครูที่ปรึกษา (เจ้าของระบบ)</summary><div className="filters"><label>ครู<select value={teacher} disabled={busy} onChange={e=>setTeacher(e.target.value)}><option value="">เลือกครู</option>{teachers.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label><label>ห้อง<select value={grantRoom} disabled={busy} onChange={e=>setGrantRoom(e.target.value)}><option value="">เลือกห้อง</option>{rooms.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label><button disabled={busy||!teacher||!grantRoom} onClick={()=>void grant(true)}>ให้สิทธิ์ดูห้อง</button><button disabled={busy||!teacher||!grantRoom} onClick={()=>void grant(false)}>ยกเลิกสิทธิ์</button></div><small>สิทธิ์นี้ให้เข้าถึงรายชื่อ งาน และบันทึกการส่ง/คะแนนของห้องแบบอ่านอย่างเดียว ไม่ให้สิทธิ์แก้ไข</small></details>}
 <div className="filters"><button disabled={busy} onClick={()=>void loadRooms()}>โหลดห้องใหม่</button><label>ห้องเรียน<select value={room} disabled={busy} onChange={e=>{setRoom(e.target.value);setEntries(null)}}><option value="">เลือกห้อง</option>{rooms.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label><button disabled={busy||!room} className="primary" onClick={()=>void load()}>โหลดสถานะทุกวิชา</button></div><p role="status">{message}</p>
 {entries&&<><div className="checking-counts"><span>รายการงาน-นักเรียน<strong>{entries.length}</strong></span><span>ส่งแล้ว<strong>{entries.filter(e=>e.submitted).length}</strong></span><span>ยังไม่ส่งรวมลา/ขาด<strong>{entries.filter(e=>!e.submitted).length}</strong></span><span>เกินกำหนด<strong>{entries.filter(e=>!e.submitted&&deadlineState(false,e.due,e.revision,now)==='overdue').length}</strong></span></div>
 <div className="filters"><label>ค้นหา<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ชื่อ รหัส วิชา งาน"/></label><label>แสดง<select value={filter} onChange={e=>setFilter(e.target.value)}><option value="outstanding">ยังไม่ส่ง / ลา / ขาด</option><option value="overdue">เลยกำหนดแก้งาน</option><option value="all">ทั้งหมด</option></select></label></div><p>พบ {rows.length} รายการ · แสดงสูงสุด 500 รายการต่อการค้นหา</p>
 <div className="score-table-scroll"><table><thead><tr><th>นักเรียน</th><th>วิชา / งาน</th><th>สถานะ</th><th>กำหนดส่ง / แก้</th></tr></thead><tbody>{rows.slice(0,500).map(e=><tr key={e.key}><td>{e.name}<br/><small>{e.student}</small></td><td>{e.course}<br/>{e.work}</td><td style={{color:e.submitted?'#087b55':e.status==='ลา'?'#906000':e.status==='ขาด'?'#a33b22':'#b52443'}}>{e.status}<br/><small>{deadlineLabels[deadlineState(e.submitted,e.due,e.revision,now)]}</small></td><td>{bangkokInput(e.due).replace('T',' ')||'—'}<br/>{bangkokInput(e.revision).replace('T',' ')||'—'}</td></tr>)}</tbody></table></div><small>เวลาประเทศไทย · รายงานจากหลายคำขอ ไม่ใช่ภาพถ่ายข้อมูลเวลาเดียวกัน</small></>}
 </section>
}
