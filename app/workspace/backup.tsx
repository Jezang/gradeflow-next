'use client';
import {useState,useRef} from 'react';
import {collection,query,limit,getDocsFromServer,Timestamp,type DocumentData} from 'firebase/firestore';
import {firebaseServices} from '../../lib/firebase';
import {ROOTS,MAX_ROWS,MAX_BYTES,inspectBackup,type BackupRow} from '../../lib/backup';
function serialize(v:unknown):unknown{
 if(v instanceof Timestamp)return {$type:'timestamp',seconds:v.seconds,nanoseconds:v.nanoseconds};
 if(v===null||typeof v==='string'||typeof v==='boolean'||(typeof v==='number'&&Number.isFinite(v)))return v;
 if(Array.isArray(v))return v.map(serialize);
 if(v&&typeof v==='object'&&Object.getPrototypeOf(v)===Object.prototype)return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,serialize(x)]));
 throw Error('พบชนิดข้อมูลที่ไม่รองรับ');
}
export default function Backup(){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[result,setResult]=useState<ReturnType<typeof inspectBackup>|null>(null);const lock=useRef(false);
 async function exportData(){
  if(lock.current||!window.confirm('ไฟล์นี้มีข้อมูลนักเรียนและบัญชีครู โปรดเก็บในที่ปลอดภัย และหยุดแก้ไขข้อมูลระหว่างสำรอง'))return;
  lock.current=true;setBusy(true);setResult(null);setMessage('กำลังอ่านข้อมูลจากเซิร์ฟเวอร์');
  try{
   const {db}=firebaseServices(),rows:BackupRow[]=[];const start=new Date().toISOString();
   async function read(path:string){const snap=await getDocsFromServer(query(collection(db,path),limit(501)));if(snap.size>500||rows.length+snap.size>MAX_ROWS)throw Error('ข้อมูลเกินขอบเขตการสำรอง (500 ต่อชุด / 5,000 รวม)');for(const d of snap.docs){const data=d.data();rows.push({path:d.ref.path,data:serialize(data) as Record<string,unknown>})}return snap.docs.map(d=>({id:d.id,data:d.data() as DocumentData}));}
   let courses:{id:string;data:DocumentData}[]=[];
   for(const root of ROOTS){const docs=await read(root);if(root==='teachingAssignments')courses=docs;}
   for(const c of courses){const base='teachingAssignments/'+c.id;setMessage('กำลังสำรองรายวิชา '+c.id);await read(base+'/roster');for(const w of await read(base+'/work')){const path=base+'/work/'+w.id;for(const s of await read(path+'/submissions'))await read(path+'/submissions/'+s.id+'/history')}const legacy='legacyArchives/'+c.id+'/assignments';for(const a of await read(legacy))await read(legacy+'/'+a.id+'/students')}
   const payload={format:'gradeflow-firestore-v1',project:'gradeflow-next',startedAt:start,finishedAt:new Date().toISOString(),rows};
   const report=inspectBackup(payload);setResult(report);if(report.issues.length)throw Error('ข้อมูลอ้างอิงไม่ครบ ไม่สร้างไฟล์สำรอง');
   const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});if(blob.size>MAX_BYTES)throw Error('ไฟล์เกิน 10 MB');
   const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='gradeflow-backup-'+start.slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setMessage('สำรองข้อมูลสำเร็จ '+rows.length+' เอกสาร โปรดเก็บไฟล์เป็นความลับ');
  }catch(e){setMessage(e instanceof Error?e.message:'สำรองข้อมูลไม่สำเร็จ')}finally{lock.current=false;setBusy(false)}
 }
 async function inspect(file:File){if(lock.current)return;lock.current=true;setBusy(true);setResult(null);try{if(file.size>MAX_BYTES)throw Error('ไฟล์เกิน 10 MB');const report=inspectBackup(JSON.parse(await file.text()));setResult(report);setMessage('ตรวจไฟล์บนอุปกรณ์แล้ว ยังไม่ได้เขียนข้อมูลกลับ')}catch(e){setMessage(e instanceof Error?e.message:'อ่านไฟล์ไม่ได้')}finally{lock.current=false;setBusy(false)}}
 return <div className="teaching-grid"><section className="panel"><h2>🌸 Backup Center</h2><p>สำรองเอกสารที่ระบบรู้จัก รวมรายชื่อ รายวิชา คะแนน ประวัติแก้ไข และสำเนาประวัติเดิม ไม่รวมรหัสผ่าน Firebase Auth หรือการตั้งค่า LINE ไม่ใช่ snapshot ณ เวลาเดียวกัน</p><button className="primary" disabled={busy} onClick={exportData}>ดาวน์โหลด JSON Backup</button><p role="status" aria-live="polite">{message}</p></section><section className="panel"><h2>Restore Preview</h2><p>ตรวจโครงสร้าง ข้อมูลอ้างอิง และคะแนนในไฟล์ โดยไม่เขียนกลับ Firebase</p><input type="file" accept=".json,application/json" disabled={busy} onChange={e=>{const f=e.target.files?.[0];if(f)void inspect(f);e.target.value=''}}/>{result&&<><p>จำนวนเอกสาร {result.total} · ข้อผิดพลาด {result.issues.length}</p>{Object.entries(result.counts).map(([k,n])=><div className="rank" key={k}><span>{k}</span><strong>{n}</strong></div>)}{result.issues.slice(0,100).map((s,i)=><p key={i}>{s}</p>)}</>}</section></div>
}
