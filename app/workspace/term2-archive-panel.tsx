'use client';
import {useRef,useState} from 'react';
import {firebaseServices} from '../../lib/firebase';
import {previewTerm2ArchiveBatch,archiveTerm2Batch,promoteTerm2Batch,auditTerm2Migration,type Term2ArchiveBatch} from '../../lib/term2-archive';
import type {prepareLegacy} from '../../lib/migration';

export default function Term2ArchivePanel({uid,prepared,disabled,onBusy}:{uid:string;prepared:ReturnType<typeof prepareLegacy>;disabled:boolean;onBusy:(busy:boolean)=>void}){
 const [batch,setBatch]=useState<Term2ArchiveBatch|null>(null),[status,setStatus]=useState(''),[selected,setSelected]=useState<string[]>([]),[busy,setBusy]=useState(false);
 const [audit,setAudit]=useState<Awaited<ReturnType<typeof auditTerm2Migration>>|null>(null);
 const lock=useRef(false);
 async function verify(){
  if(lock.current||busy||disabled)return;
  lock.current=true;setBusy(true);onBusy(true);setAudit(null);setStatus('กำลังตรวจรับจากเซิร์ฟเวอร์ (อ่านอย่างเดียว)…');
  try{
   const result=await auditTerm2Migration(firebaseServices().db,uid,prepared,setStatus);
   setAudit(result);setStatus('ตรวจรับแล้ว ไม่ได้เขียนหรือแก้ไขข้อมูล');
  }catch(e){setStatus('ตรวจรับไม่สำเร็จ: '+(e instanceof Error?e.message:'เกิดข้อผิดพลาด')+' · ไม่มีการแก้ไขข้อมูล')}
  finally{lock.current=false;setBusy(false);onBusy(false)}
 }
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
  lock.current=true;setBusy(true);onBusy(true);setAudit(null);
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
  <h3>ตรวจรับหลังย้ายข้อมูล (อ่านอย่างเดียว)</h3>
  <p>เทียบไฟล์ต้นฉบับกับสำเนาประวัติและรายการคะแนนที่นำเข้า ตรวจเฉพาะงานเดิมที่จับคู่ได้ ไม่รวมงานใหม่ทั้งหมด และไม่ใช่ภาพถ่ายฐานข้อมูล ณ เวลาเดียวกัน ควรหยุดแก้คะแนนระหว่างตรวจ</p>
  <button type="button" disabled={busy||disabled} onClick={()=>void verify()}>ตรวจรับทุกห้องและคะแนนเดิม</button>
  {audit&&<>
   <p>ตรวจเมื่อ {new Date(audit.checkedAt).toLocaleString('th-TH')} · {audit.studentCount} นักเรียน · {audit.workCount} งานต้นฉบับ · {audit.recordCount} บันทึก</p>
   <div className="stats">{[
    ['สำเนาที่ตรวจครบ',audit.totals.archived],
    ['บันทึกเดิมในงานเปิดใช้',audit.totals.activeExpected],
    ['คะแนนและสถานะตรงต้นฉบับ',audit.totals.activeExact],
    ['คะแนนหรือสถานะต่าง (ประวัติเดิมตรง)',audit.totals.activeChanged],
    ['บันทึกหายในงานเปิดใช้',audit.totals.activeMissing],
    ['ประวัติเดิมไม่ตรง',audit.totals.activeLegacyMismatch],
    ['บันทึกเพิ่มในงานเปิดใช้',audit.totals.activeAdditional],
    ['เฉพาะสำเนา (ยังไม่เปิดใช้)',audit.totals.archiveOnly],
    ['งานค้าง/ปิด/ผิดปกติ',audit.totals.other]
   ].map(([label,value])=><div className="tile" key={label}><small>{label}</small><strong>{value}</strong></div>)}</div>
   {audit.totals.archived!==audit.recordCount||audit.totals.activeMissing>0||audit.totals.activeLegacyMismatch>0||audit.totals.other>0?<p role="alert">พบรายการที่ต้องตรวจสอบ ไม่แก้ไขอัตโนมัติ</p>:<p>สำเนาประวัติครบ และไม่พบบันทึกเดิมหายหรือประวัติเดิมไม่ตรงในงานที่เปิดใช้</p>}
   <p>คะแนนต่างอาจเป็นการแก้ไขหลังนำเข้า ไม่ใช่ข้อผิดพลาดเสมอไป · รายการเฉพาะสำเนาไม่ใช่งานเปิดใช้</p>
   {audit.details.map(x=><div className="rank" key={x.key}><div><strong>{x.room} · {x.title}</strong><small>{x.state==='active'?'เปิดใช้':x.state==='archiveOnly'?'เฉพาะสำเนา':x.state==='pending'?'นำเข้าค้าง':x.state==='inactive'?'ปิดใช้งาน':'ข้อมูลไม่ตรง'} · สำเนา{x.archiveComplete?'ครบ':'ไม่ครบ'} · {x.recordCount} บันทึกเดิม</small><small>ตรง {x.counts.exact} · ต่าง {x.counts.changed} · ไม่มีในตาราง {x.counts.missing} · ประวัติไม่ตรง {x.counts.legacyMismatch} · เพิ่ม {x.counts.additional}</small></div></div>)}
  </>}
  <p role="status" aria-live="polite">{status}</p>
 </section>
}
