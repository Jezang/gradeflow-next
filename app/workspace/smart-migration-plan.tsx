'use client';
import {useRef,useState} from 'react';
import {collection,getDocsFromServer,limit,query} from 'firebase/firestore';
import {firebaseServices} from '../../lib/firebase';
import {planLegacyGroups,checkLegacyRegistry,planEnglishTerm2,type prepareLegacy} from '../../lib/migration';
import {previewTerm2Setup,applyTerm2Setup,type Term2Setup} from '../../lib/term2-setup';
import {SakuraIcon} from './sakura-icons';

export default function SmartMigrationPlan({prepared,disabled,uid,onBusy}:{prepared:ReturnType<typeof prepareLegacy>;disabled:boolean;uid:string;onBusy:(value:boolean)=>void}){
 const plan=planLegacyGroups(prepared);
 const term2=planEnglishTerm2(prepared);
 const [busy,setBusy]=useState(false),[status,setStatus]=useState(''),[registry,setRegistry]=useState<ReturnType<typeof checkLegacyRegistry>|null>(null);
 const [setup,setSetup]=useState<Term2Setup|null>(null),[setupMessage,setSetupMessage]=useState('');
 const lock=useRef(false);
 async function checkSetup(){
  if(lock.current||busy||disabled)return;
  lock.current=true;setBusy(true);onBusy(true);setSetup(null);setSetupMessage('');
  try{setSetup(await previewTerm2Setup(firebaseServices().db,uid,prepared));setSetupMessage('ตรวจแผนจากเซิร์ฟเวอร์แล้ว ยังไม่ได้บันทึก')}
  catch(e){setSetupMessage(e instanceof Error?e.message:'ตรวจแผนไม่ได้')}
  finally{lock.current=false;setBusy(false);onBusy(false)}
 }
 async function saveSetup(){
  if(lock.current||busy||disabled||!setup||!window.confirm('สร้างเฉพาะห้อง รายวิชา ภาคเรียน และผูกรายชื่อนักเรียนที่ขาดให้บัญชีของฉัน? ไม่เปลี่ยนคะแนนหรือทะเบียนเดิม'))return;
  lock.current=true;setBusy(true);onBusy(true);setSetupMessage('กำลังตรวจสอบอีกครั้ง');
  try{
   const r=await applyTerm2Setup(firebaseServices().db,uid,prepared,setup,setSetupMessage);
   setSetupMessage('ตรวจหลังบันทึกสำเร็จ '+r.groups+' กลุ่ม · '+r.students+' คน · เพิ่มข้อมูลกลาง/มอบหมาย '+r.created+' รายการ · ผูกรายชื่อใหม่ '+r.linked+' คน');
  }catch(e){setSetupMessage('หยุดการสร้างข้อมูล: '+(e instanceof Error?e.message:'เกิดข้อผิดพลาด')+' · อาจมีรายการที่สร้างแล้ว ตรวจแผนใหม่ก่อนทำต่อ โดยไม่เขียนทับ')}
  finally{setSetup(null);lock.current=false;setBusy(false);onBusy(false)}
 }
 const matched=plan.assignments.filter(a=>a.status==='matched').length;
 async function verifyRegistry(){
  if(busy||disabled)return;
  setBusy(true);setRegistry(null);setStatus('');
  try{
   const snap=await getDocsFromServer(query(collection(firebaseServices().db,'students'),limit(501)));
   if(snap.size>500)throw Error('ข้อมูลกลางเกิน 500 รายการ ยังยืนยันความครบถ้วนไม่ได้');
   setRegistry(checkLegacyRegistry(prepared.roster,snap.docs.map(d=>({code:d.id,name:d.data().name,active:d.data().active}))));
   setStatus('ตรวจรายชื่อจากเซิร์ฟเวอร์แล้ว ไม่ได้แก้ไขข้อมูล');
  }catch{setStatus('ตรวจรายชื่อไม่สำเร็จหรือเกินขอบเขต กรุณาตรวจสอบสิทธิ์และจำนวนข้อมูล')}
  finally{setBusy(false)}
 }
 return <section className="panel smart-migration-plan">
  <h2 className="sakura-icon-heading"><SakuraIcon name="teaching"/> Smart Migration · แผนจัดกลุ่ม</h2>
  <p>จัดกลุ่มจากชั้น ห้อง และวิชาที่ระบุในไฟล์เดิมเท่านั้น การแสดงแผนไม่สร้างห้อง รายวิชา รายการมอบหมาย หรือคะแนน</p>
  <div className="admin">{[['นักเรียนในไฟล์',plan.studentCount],['ห้องเรียน',plan.rooms],['รายวิชา',plan.subjects],['กลุ่มรายวิชา-ห้อง',plan.groups.length],['ข้อมูลกลุ่มไม่ครบ',plan.incomplete.length],['งานที่จับคู่ได้',matched+' / '+plan.assignments.length]].map(([label,value])=><div key={label} className="tile"><small>{label}</small><strong>{value}</strong></div>)}</div>
  <h3>ตรวจรายชื่อที่นำเข้าแล้ว</h3><button type="button" disabled={busy||disabled} onClick={verifyRegistry}>{busy?'กำลังตรวจ…':'ตรวจสอบรายชื่อใน Firebase (อ่านอย่างเดียว)'}</button>
  <p role="status">{status}</p>
  {registry&&<><p>ตรงกันและเปิดใช้งาน {registry.matched} / {plan.studentCount} คน · ไม่พบรหัส {registry.missing} · ชื่อไม่ตรง {registry.nameMismatch} · ไม่เปิดใช้งาน {registry.inactive}</p>{registry.matched!==plan.studentCount&&<p role="alert">ยังไม่ควรสร้างรายการมอบหมาย จนกว่าจะแก้ไขข้อแตกต่าง</p>}</>}
  <h3>กลุ่มที่เสนอ</h3>
  {plan.groups.map(g=><div className="rank" key={g.key}><div><strong>ชั้น {g.level} / ห้อง {g.room} · {g.subject}</strong></div><strong>{g.students.length} คน</strong></div>)}
  {plan.incomplete.length>0&&<p role="alert">มี {plan.incomplete.length} คนที่ชั้น ห้อง หรือวิชาไม่ครบ — ยังไม่รวมในแผน</p>}
  <h3>ตรวจการจับคู่งานเดิม</h3>
  {plan.assignments.map(a=><div className="rank" key={a.id}><div><strong>{a.title}</strong><small>{a.level||'ไม่ระบุชั้น'} · {a.room||'ไม่ระบุห้อง'} · {a.subject||'ไม่ระบุวิชา'} · {a.records} รายการ</small></div><small>{a.status==='matched'?'ตรงกลุ่ม':a.status==='review-records'?'ต้องตรวจรายการนอกกลุ่ม '+a.outside:'ต้องระบุขอบเขต · ตัวเลือก '+a.candidateCount}</small></div>)}
  <h3>แผนปรับชื่อวิชา · ปีการศึกษา {term2.year} ภาคเรียน {term2.term}</h3>
  <p>ใช้เฉพาะเมื่อเจ้าของระบบยืนยันว่าข้อมูลเป็นรายวิชาภาษาอังกฤษของตนในภาคเรียนนี้: ม.2 ภาษาอังกฤษ 4 และ ม.3 ภาษาอังกฤษ 6 เก็บชื่อเดิมและไม่เขียนทับคะแนน</p>
  {term2.groups.map(g=><div className="rank" key={g.key}><div><strong>ม.{g.level}/{g.room} · {g.subject}</strong><small>เดิม: {[...new Set(g.students.map(s=>s.subject))].join(' / ')}</small></div><strong>{g.students.length} คน</strong></div>)}
  {term2.unresolved.length>0&&<p role="alert">นักเรียนที่ยังจัดกลุ่มไม่ได้ {term2.unresolved.length} คน</p>}
  <h3>สร้างห้องและผูกรายวิชาอัตโนมัติ</h3>
  <p>สำหรับบัญชีเจ้าของระบบที่กำลังเข้าสู่ระบบ · ปี 2569 เทอม 2 · ไม่สร้างนักเรียนซ้ำ ไม่ย้ายคะแนน</p>
  <button type="button" disabled={busy||disabled||!!term2.unresolved.length} onClick={checkSetup}>ตรวจแผนสร้างห้องและผูกรายวิชา</button>
  {setup&&<><p>ภาคเรียน: {setup.term.name} · นักเรียน {setup.studentCount} คน · {setup.groups.length} กลุ่ม</p>
   {setup.masters.map(m=><div className="rank" key={m.kind+'/'+m.record.id}><span>{m.record.name}</span><small>{m.record.exists?'ใช้รายการเดิม':'สร้างใหม่'}</small></div>)}
   {setup.groups.map(g=><div className="rank" key={g.id}><span>{g.room.name} · {g.subject.name}</span><small>{g.exists?'ใช้รายการมอบหมายเดิม':'สร้างรายการมอบหมาย'} · ผูกเพิ่ม {g.students.length-g.existingRoster.length} / {g.students.length} คน</small></div>)}
   <button type="button" className="primary" disabled={busy||disabled} onClick={saveSetup}>ยืนยันสร้างห้องและผูกนักเรียนให้บัญชีของฉัน</button>
  </>}
  <p role="status">{setupMessage}</p>
  <h3>แผนแบ่งบันทึกงานตามห้อง</h3>
  <p>บันทึกทั้งหมด {term2.recordCount} รายการ · ยังไม่สร้างงานหรือบันทึกคะแนน ไม่ถือว่านักเรียนที่ไม่มีบันทึกได้รับหรือไม่ได้รับงาน</p>
  {term2.assignments.map(a=><div key={a.work.id}><strong>{a.work.title}</strong><small> · วิชาเดิม {a.work.subject||'ไม่ระบุ'} · {a.work.records.length} รายการ</small>
   {a.partitions.map(p=><div className="rank" key={p.groupKey}><span>ม.{p.level}/{p.room} · {p.subject}</span><small>{p.records.length} บันทึก</small></div>)}
   {a.scopeNeedsReview&&<p>ตรวจขอบเขตงานก่อนสร้างจริง (ไฟล์เดิมไม่ระบุครบ)</p>}
   {a.unresolvedRecords.length>0&&<p role="alert">ยังจับคู่ไม่ได้ {a.unresolvedRecords.length} รายการ</p>}
  </div>)}
  <p>การสร้างห้องต้องยืนยันแยกต่างหาก ส่วนงานและคะแนนยังเป็นแผนอ่านอย่างเดียว</p>
 </section>
}
