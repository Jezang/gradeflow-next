'use client';
import {useRef,useState} from 'react';
import {firebaseServices} from '../../lib/firebase';
import {previewTerm2ArchiveBatch,archiveTerm2Batch,promoteTerm2Batch,type Term2ArchiveBatch} from '../../lib/term2-archive';
import type {prepareLegacy} from '../../lib/migration';

export default function Term2ArchivePanel({uid,prepared,disabled,onBusy}:{uid:string;prepared:ReturnType<typeof prepareLegacy>;disabled:boolean;onBusy:(busy:boolean)=>void}){
 const [batch,setBatch]=useState<Term2ArchiveBatch|null>(null),[status,setStatus]=useState(''),[selected,setSelected]=useState<string[]>([]),[busy,setBusy]=useState(false);
 const lock=useRef(false);
 const complete=!!batch&&batch.targets.every(x=>x.complete);
 const chosen=batch?.targets.filter(x=>selected.includes(x.item.key))||[];
 function accept(next:Term2ArchiveBatch){
  setBatch(next);
  setSelected(next.targets.filter(x=>!x.item.needsScopeConfirmation).map(x=>x.item.key));
 }
 async function perform(action:'preview'|'archive'|'promote'){
  if(lock.current||busy||disabled)return;
  if(action!=='preview'&&!batch)return;
  if(action==='archive'&&!window.confirm('เก็บสำเนางานและบันทึกเดิมทั้งหมดใน Firebase สำหรับเจ้าของระบบเท่านั้น? ไม่เปลี่ยนคะแนนปัจจุบัน'))return;
  if(action==='promote'&&(!complete||!chosen.length||!window.confirm('เปิดงานที่เลือกให้ครอบคลุมนักเรียนทั้งห้อง? นักเรียนที่ไม่มีบันทึกเดิมจะยังไม่มีคะแนน และระบบจะนับงานนี้ในภาระงานของทั้งห้อง')))return;
  lock.current=true;setBusy(true);onBusy(true);
  setStatus('กำลังตรวจข้อมูลจากเซิร์ฟเวอร์…');
  try{
   const {db}=firebaseServices();
   if(action==='preview'){
    accept(await previewTerm2ArchiveBatch(db,uid,prepared));
    setStatus('ตรวจแผนแล้ว ยังไม่ได้บันทึกข้อมูล');
   }else if(action==='archive'&&batch){
    const result=await archiveTerm2Batch(db,uid,prepared,batch,setStatus);
    accept(result);setStatus('ตรวจสำเนาประวัติครบ '+result.recordCount+' รายการ จาก '+result.workCount+' งานเดิม ยังไม่เปิดใช้ในระบบตรวจงาน');
   }else if(action==='promote'&&batch){
    const confirmed=chosen.filter(x=>x.item.needsScopeConfirmation).map(x=>x.item.key);
    const result=await promoteTerm2Batch(db,uid,prepared,batch,selected,confirmed,setStatus);
    setStatus('ตรวจและเปิดใช้สำเร็จ '+result.groups+' กลุ่มงาน · '+result.records+' บันทึก (เฉพาะงานที่เลือก)');
    setBatch(null);setSelected([]);
   }
  }catch(e){
   setBatch(null);setSelected([]);
   setStatus('หยุดดำเนินการ: '+(e instanceof Error?e.message:'เกิดข้อผิดพลาด')+' · อาจมีบางส่วนที่บันทึกแล้ว ตรวจแผนใหม่ด้วยไฟล์เดิมเพื่อทำต่อโดยไม่เขียนทับ');
  }finally{lock.current=false;setBusy(false);onBusy(false)}
 }
 return <section className="panel">
  <h2>Smart Migration · นำเข้างานและคะแนนเดิม</h2>
  <p>ตรวจรายวิชาที่สร้างแล้วในปี 2569 ภาคเรียน 2 และจับคู่บันทึกด้วยรหัสนักเรียน เก็บชื่อวิชาเดิม คะแนน สถานะ หมายเหตุ และเวลาเดิม</p>
  <p>แบ่งงานตามห้องที่มีบันทึกจริงเท่านั้น ไม่สร้างงานให้ห้องที่ไม่มีหลักฐาน และไม่เติมคะแนนศูนย์หรือสถานะขาดส่งเอง</p>
  <button type="button" disabled={busy||disabled} onClick={()=>void perform('preview')}>ตรวจแผนนำเข้างานและคะแนนทั้งหมด</button>
  {batch&&<>
   <p>{batch.studentCount} นักเรียน · {batch.workCount} งานต้นฉบับ · {batch.recordCount} บันทึก · {batch.targets.length} กลุ่มงานตามห้อง</p>
   {batch.targets.map(x=><div className="rank" key={x.item.key}>
    <div><strong>{x.item.work.title} · {x.item.room}</strong><small>{x.item.subject} · บันทึกเดิม {x.item.recordCount}/{x.item.students.length} คน · {x.complete?'สำเนาครบ':'ยังเก็บสำเนาไม่ครบ'}</small>
    {x.item.needsScopeConfirmation&&<small>มีนักเรียนที่ไม่มีบันทึกเดิม ต้องยืนยันว่ามอบหมายให้ทั้งห้องก่อนเปิดใช้</small>}</div>
    {complete&&<label><input type="checkbox" checked={selected.includes(x.item.key)} disabled={busy||disabled} onChange={e=>setSelected(old=>e.target.checked?[...old,x.item.key]:old.filter(k=>k!==x.item.key))}/>{x.item.needsScopeConfirmation?'ยืนยันงานนี้ให้ทั้งห้องและเลือกเปิดใช้':'เลือกเปิดใช้'}</label>}
   </div>)}
   {!complete?<button type="button" className="primary" disabled={busy||disabled} onClick={()=>void perform('archive')}>ยืนยันเก็บสำเนาประวัติทั้งหมด</button>:<>
    <p>เก็บสำเนาครบแล้ว · เลือกเปิดใช้ {chosen.length} กลุ่มงาน · {chosen.reduce((n,x)=>n+x.item.recordCount,0)} บันทึก ส่วนที่ไม่ได้เลือกยังคงอยู่ในสำเนาประวัติ</p>
    <button type="button" className="primary" disabled={busy||disabled||!chosen.length} onClick={()=>void perform('promote')}>ยืนยันนำงานและคะแนนที่เลือกเข้าสู่ระบบตรวจงาน</button>
   </>}
  </>}
  <p role="status" aria-live="polite">{status}</p>
 </section>
}
