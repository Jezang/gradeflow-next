'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {collection,doc,onSnapshot,query,limit,runTransaction,serverTimestamp,Timestamp} from 'firebase/firestore';
import {firebaseServices} from '../../lib/firebase';
import {attendanceFor,attendanceLabels,bangkokInput,deadlineLabels,deadlineState,timestampMillis,validateDeadlines,type Attendance} from '../../lib/work-tracking';

type AttendanceSnapshot={key:string;ready:boolean;values:Record<string,Attendance>;error:boolean};
export function useAttendance(course:string,work:string):AttendanceSnapshot{
 const key=course+'/'+work;
 const [state,setState]=useState<{key:string;ready:boolean;values:Record<string,Attendance>;error:boolean}>({key:'',ready:false,values:{},error:false});
 useEffect(()=>{
  setState({key,ready:false,values:{},error:false});if(!course||!work)return;
  const ref=collection(firebaseServices().db,'teachingAssignments',course,'work',work,'attendance');
  return onSnapshot(query(ref,limit(501)),{includeMetadataChanges:true},s=>{
   const ready=!s.metadata.fromCache&&!s.metadata.hasPendingWrites&&s.size<=500;
   const values:Record<string,Attendance>=Object.create(null);if(ready)for(const d of s.docs){const status=d.data().status;if(status==='missing'||status==='leave'||status==='absent')values[d.id]=status;}
   setState({key,ready,values,error:s.size>500});
  },()=>setState({key,ready:false,values:{},error:true}));
 },[course,work,key]);
 return state.key===key?state:{key,ready:false,values:{},error:false};
}
type Person={id:string;name:string;submitted:boolean;legacy?:unknown};
export default function WorkTracking({uid,course,work,deadline,revision,people,attendance,ready,blocked}:{uid:string;course:string;work:string;deadline:number|null;revision:number|null;people:Person[];attendance:Record<string,Attendance>;ready:boolean;blocked:boolean}){
 const [due,setDue]=useState(bangkokInput(deadline)),[editDue,setEditDue]=useState(bangkokInput(revision)),[student,setStudent]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const baseline=useRef({deadline,revision});const lock=useRef(false);
 useEffect(()=>{setDue(bangkokInput(deadline));setEditDue(bangkokInput(revision));baseline.current={deadline,revision}},[deadline,revision]);
 async function execute(fn:()=>Promise<void>){if(lock.current||blocked)return;lock.current=true;setBusy(true);try{await fn()}catch(e){setMessage(e instanceof Error?e.message:'บันทึกไม่สำเร็จ')}finally{lock.current=false;setBusy(false)}}
 async function save(e:FormEvent){e.preventDefault();await execute(async()=>{
  const {a,b}=validateDeadlines(due,editDue);const before={...baseline.current};const {db}=firebaseServices();const ref=doc(db,'teachingAssignments',course,'work',work);
  await runTransaction(db,async tx=>{const s=await tx.get(ref);if(!s.exists()||s.data().active!==true||timestampMillis(s.data().deadline)!==before.deadline||timestampMillis(s.data().revisionDeadline)!==before.revision)throw Error('ข้อมูลกำหนดส่งเปลี่ยนแล้ว กรุณาตรวจสอบใหม่');
   tx.update(ref,{deadline:a===null?null:Timestamp.fromMillis(a),revisionDeadline:b===null?null:Timestamp.fromMillis(b),deadlineUpdatedBy:uid,deadlineUpdatedAt:serverTimestamp()})});
  setMessage('บันทึกกำหนดส่งแล้ว');
 })}
 async function mark(status:Attendance){if(!ready||!people.some(p=>p.id===student&&!p.submitted))return;await execute(async()=>{
  const {db}=firebaseServices();const base=doc(db,'teachingAssignments',course,'work',work);const sub=doc(base,'submissions',student),ref=doc(base,'attendance',student);
  await runTransaction(db,async tx=>{const s=await tx.get(sub);if(s.data()?.submitted===true)throw Error('นักเรียนส่งงานแล้ว');await tx.get(ref);tx.set(ref,{studentId:student,status,updatedBy:uid,updatedAt:serverTimestamp()})});
  setMessage('บันทึกสถานะ '+attendanceLabels[status]+' แล้ว โดยไม่แก้คะแนน');
 })}
 return <details className="panel checking-tools"><summary>กำหนดส่ง · แก้งาน · บันทึกลา/ขาด</summary>
 <p>เวลาประเทศไทย · {deadlineLabels[deadlineState(false,deadline,revision,Date.now())]} · ครูยังรับงานและแก้คะแนนหลังวันกำหนดได้ตามปกติ</p>
 <form className="filters" onSubmit={save}><label>วันส่งงาน<input type="datetime-local" value={due} onChange={e=>setDue(e.target.value)} disabled={busy||blocked}/></label><label>วันหมดเขตแก้งาน<input type="datetime-local" value={editDue} onChange={e=>setEditDue(e.target.value)} disabled={busy||blocked}/></label><button className="primary" disabled={busy||blocked}>บันทึกกำหนดส่ง</button></form>
 <p>บันทึกลา/ขาดเฉพาะงานนี้ ไม่เปลี่ยนคะแนน และถ้านักเรียนส่งงานแล้ว สถานะส่งจะมีความสำคัญกว่า</p>
 <label>นักเรียน<select value={student} disabled={!ready||busy||blocked} onChange={e=>setStudent(e.target.value)}><option value="">เลือกนักเรียนที่ยังไม่ส่ง</option>{people.filter(p=>!p.submitted).map(p=><option key={p.id} value={p.id}>{p.name} · {attendanceLabels[attendanceFor(false,attendance[p.id],p.legacy)??'missing']}</option>)}</select></label>
 <div className="filters">{(['leave','absent','missing'] as const).map(s=><button type="button" key={s} disabled={!ready||!student||busy||blocked||!people.some(p=>p.id===student&&!p.submitted)} onClick={()=>void mark(s)}>{attendanceLabels[s]}</button>)}</div>
 {!ready&&<p>ยังยืนยันสถานะจากเซิร์ฟเวอร์ไม่ได้</p>}<p role="status">{message}</p></details>;
}
