'use client';
import {useState,useRef} from 'react';
import {collection,query,limit,getDocsFromServer,doc,runTransaction,serverTimestamp,Timestamp,type DocumentData} from 'firebase/firestore';
import {firebaseServices} from '../../lib/firebase';
import {ROOTS,MAX_ROWS,MAX_BYTES,inspectBackup,backupRows,compareBackup,planMasterRecovery,type BackupRow} from '../../lib/backup';
function serialize(v:unknown):unknown{
 if(v instanceof Timestamp)return {$type:'timestamp',seconds:v.seconds,nanoseconds:v.nanoseconds};
 if(v===null||typeof v==='string'||typeof v==='boolean'||(typeof v==='number'&&Number.isFinite(v)))return v;
 if(Array.isArray(v))return v.map(serialize);
 if(v&&typeof v==='object'&&Object.getPrototypeOf(v)===Object.prototype)return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,serialize(x)]));
 throw Error('พบชนิดข้อมูลที่ไม่รองรับ');
}
export default function Backup(){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[result,setResult]=useState<ReturnType<typeof inspectBackup>|null>(null);const lock=useRef(false);
 const [source,setSource]=useState<BackupRow[]|null>(null),[diff,setDiff]=useState<ReturnType<typeof compareBackup>|null>(null);

 async function readLive(){
   const {db}=firebaseServices(),rows:BackupRow[]=[];
   async function read(path:string){const snap=await getDocsFromServer(query(collection(db,path),limit(501)));if(snap.size>500||rows.length+snap.size>MAX_ROWS)throw Error('ข้อมูลเกินขอบเขตการสำรอง (500 ต่อชุด / 5,000 รวม)');for(const d of snap.docs)rows.push({path:d.ref.path,data:serialize(d.data()) as Record<string,unknown>});return snap.docs.map(d=>({id:d.id,data:d.data() as DocumentData}));}
   let courses:{id:string;data:DocumentData}[]=[];
   for(const root of ROOTS){const docs=await read(root);if(root==='teachingAssignments')courses=docs;}
   for(const c of courses){const base='teachingAssignments/'+c.id;await read(base+'/roster');for(const w of await read(base+'/work')){const path=base+'/work/'+w.id;for(const s of await read(path+'/submissions'))await read(path+'/submissions/'+s.id+'/history')}const legacy='legacyArchives/'+c.id+'/assignments';for(const a of await read(legacy))await read(legacy+'/'+a.id+'/students')}
   return rows;
 }
 async function compare(){
  if(lock.current||!source||!window.confirm('เปรียบเทียบกับฐานข้อมูลจริง? ใช้โควตาการอ่าน และไม่แก้ไขข้อมูล'))return;
  lock.current=true;setBusy(true);setDiff(null);try{setDiff(compareBackup(source,await readLive()));setMessage('เปรียบเทียบแล้ว ไม่มีการเขียนข้อมูล')}catch(e){setMessage(e instanceof Error?e.message:'เปรียบเทียบไม่ได้')}finally{lock.current=false;setBusy(false)}
 }
 const recovery=source&&diff?planMasterRecovery(source,diff.missing):null;
 async function restoreMasters(){
  if(lock.current||!recovery?.eligible.length||recovery.eligible.length>500)return;
  if(window.prompt('สร้างเฉพาะข้อมูลพื้นฐานที่ขาด '+recovery.eligible.length+' รายการ ไม่กู้คะแนน ไม่เขียนทับ วันที่สร้างจะเป็นวันปัจจุบัน พิมพ์ RESTORE เพื่อยืนยัน')!=='RESTORE')return;
  lock.current=true;setBusy(true);let created=0,skipped=0;
  try{const {db}=firebaseServices();for(const row of recovery.eligible){const ref=doc(db,row.path);const made=await runTransaction(db,async tx=>{if((await tx.get(ref)).exists())return false;tx.set(ref,{code:row.code,name:row.name,active:true,createdAt:serverTimestamp()});return true});if(made)created++;else skipped++}setMessage('สร้างข้อมูลพื้นฐาน '+created+' รายการ ข้ามรายการที่มีอยู่ '+skipped+' รายการ กรุณาเปรียบเทียบอีกครั้ง')}
  catch{setMessage('หยุดการกู้คืน: สร้างแล้ว '+created+' ข้าม '+skipped+' รายการ ตรวจสอบสิทธิ์และเปรียบเทียบใหม่')}
  finally{setDiff(null);lock.current=false;setBusy(false)}
 }
 async function exportData(){
  if(lock.current||!window.confirm('ไฟล์นี้มีข้อมูลนักเรียนและบัญชีครู โปรดเก็บในที่ปลอดภัย และหยุดแก้ไขข้อมูลระหว่างสำรอง'))return;
  lock.current=true;setBusy(true);setResult(null);setSource(null);setDiff(null);setMessage('กำลังอ่านข้อมูลจากเซิร์ฟเวอร์');
  try{
   const start=new Date().toISOString(),rows=await readLive();
   const payload={format:'gradeflow-firestore-v1',project:'gradeflow-next',startedAt:start,finishedAt:new Date().toISOString(),rows};
   const report=inspectBackup(payload);setResult(report);if(report.issues.length)throw Error('ข้อมูลอ้างอิงไม่ครบ ไม่สร้างไฟล์สำรอง');
   const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});if(blob.size>MAX_BYTES)throw Error('ไฟล์เกิน 10 MB');
   const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='gradeflow-backup-'+start.slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setMessage('สำรองข้อมูลสำเร็จ '+rows.length+' เอกสาร โปรดเก็บไฟล์เป็นความลับ');
  }catch(e){setMessage(e instanceof Error?e.message:'สำรองข้อมูลไม่สำเร็จ')}finally{lock.current=false;setBusy(false)}
 }
 async function inspect(file:File){if(lock.current)return;lock.current=true;setBusy(true);setResult(null);setSource(null);setDiff(null);try{if(file.size>MAX_BYTES)throw Error('ไฟล์เกิน 10 MB');const raw=JSON.parse(await file.text());const report=inspectBackup(raw);setResult(report);if(!report.issues.length)setSource(backupRows(raw));setMessage('ตรวจไฟล์บนอุปกรณ์แล้ว ยังไม่ได้เขียนข้อมูลกลับ')}catch(e){setMessage(e instanceof Error?e.message:'อ่านไฟล์ไม่ได้')}finally{lock.current=false;setBusy(false)}}
 return <div className="teaching-grid"><section className="panel"><h2>🌸 Backup Center</h2><p>สำรองเอกสารที่ระบบรู้จัก รวมรายชื่อ รายวิชา คะแนน ประวัติแก้ไข และสำเนาประวัติเดิม ไม่รวมรหัสผ่าน Firebase Auth หรือการตั้งค่า LINE ไม่ใช่ snapshot ณ เวลาเดียวกัน</p><button className="primary" disabled={busy} onClick={exportData}>ดาวน์โหลด JSON Backup</button><p role="status" aria-live="polite">{message}</p></section><section className="panel"><h2>Restore Preview</h2><p>ตรวจโครงสร้าง ข้อมูลอ้างอิง และคะแนนในไฟล์ โดยไม่เขียนกลับ Firebase</p><input type="file" accept=".json,application/json" disabled={busy} onChange={e=>{const f=e.target.files?.[0];if(f)void inspect(f);e.target.value=''}}/>{result&&<><p>จำนวนเอกสาร {result.total} · ข้อผิดพลาด {result.issues.length}</p>{Object.entries(result.counts).map(([k,n])=><div className="rank" key={k}><span>{k}</span><strong>{n}</strong></div>)}{result.issues.slice(0,100).map((s,i)=><p key={i}>{s}</p>)}</>}{source&&<><button disabled={busy} onClick={compare}>เปรียบเทียบกับฐานข้อมูลปัจจุบัน</button><button disabled={busy} onClick={()=>{setSource(null);setDiff(null);setResult(null);setMessage('ล้างไฟล์แล้ว')}}>ล้างไฟล์</button></>}{diff&&<><h3>ผลเปรียบเทียบ (ไม่เขียนข้อมูล)</h3><p>ตรงกัน {diff.equal} · ขาด {diff.missing.length} · เปลี่ยน {diff.changed.length} · มีเพิ่มในระบบ {diff.extra.length}</p>{[['ขาด',diff.missing],['เปลี่ยน',diff.changed],['เพิ่ม',diff.extra]].map(([name,paths])=><div key={String(name)}><strong>{name}</strong>{(paths as string[]).slice(0,30).map(p=><p key={p}>{p}</p>)}</div>)}<p>ไม่ใช่ snapshot ณ เวลาเดียวกัน ห้ามใช้ผลนี้เพื่อลบหรือเขียนทับข้อมูล</p>{recovery&&<><h3>กู้คืนข้อมูลพื้นฐานที่ขาด</h3><p>สร้างได้ {recovery.eligible.length} รายการ · ไม่รองรับ {recovery.excluded.length} รายการ</p><p>เฉพาะนักเรียน ห้องเรียน วิชา ภาคเรียนที่เปิดใช้งาน ไม่กู้คะแนน บัญชี หรือวันที่สร้างเดิม จำกัด 500 รายการต่อครั้ง</p>{recovery.eligible.slice(0,30).map(r=><p key={r.path}>{r.path} · {r.name}</p>)}<button disabled={busy||!recovery.eligible.length||recovery.eligible.length>500} onClick={restoreMasters}>กู้คืนข้อมูลพื้นฐานที่ขาด</button></>}</>}</section></div>
}
