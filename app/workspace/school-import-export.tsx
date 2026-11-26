'use client';
import {useRef,useState} from 'react';
import {collection,doc,getDocsFromServer,runTransaction,serverTimestamp} from 'firebase/firestore';
import {firebaseServices} from '../../lib/firebase';
import {csv,parseCsv} from '../../lib/reports';
import {IMPORT_LIMIT,schoolLabels,template,validateSchoolRows,previewSchoolRows,sameRecord,exportSchoolRows,type SchoolKind,type SchoolRecord,type PreviewRow} from '../../lib/school-import-export';
function download(blob:Blob,name:string){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function saveFile(rows:unknown[][],name:string,format:'csv'|'xlsx'){
 if(format==='csv'){download(new Blob([csv(rows)],{type:'text/csv;charset=utf-8'}),name+'.csv');return;}
 const {Workbook}=await import('exceljs');const wb=new Workbook();const sheet=wb.addWorksheet('School data');
 sheet.addRows(rows.map(row=>row.map(v=>v==null?'':String(v))));sheet.columns.forEach(c=>{c.width=28;c.numFmt='@'});sheet.getRow(1).font={bold:true};
 const bytes=new Uint8Array(await wb.xlsx.writeBuffer());download(new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),name+'.xlsx');
}
function record(id:string,data:{name?:unknown;active?:unknown}):SchoolRecord{
 if(typeof data.name!=='string'||typeof data.active!=='boolean')throw Error('พบข้อมูลเดิมที่รูปแบบไม่ถูกต้อง กรุณาตรวจสอบก่อน');
 return {code:id,name:data.name,active:data.active};
}
async function existing(kind:SchoolKind){
 const snap=await getDocsFromServer(collection(firebaseServices().db,kind));
 return snap.docs.map(d=>record(d.id,d.data()));
}
const actions={new:'เพิ่มใหม่',rename:'เปลี่ยนชื่อ',same:'ไม่เปลี่ยน',blocked:'สถานะไม่ตรง (ไม่อนุญาต)'};
export default function SchoolImportExport({kind}:{kind:SchoolKind}){
 const [busy,setBusy]=useState(false),[status,setStatus]=useState(''),[errors,setErrors]=useState<string[]>([]),[preview,setPreview]=useState<PreviewRow[]>([]),[confirmed,setConfirmed]=useState(false);
 const lock=useRef(false);
 async function work(fn:()=>Promise<void>){if(lock.current)return;lock.current=true;setBusy(true);try{await fn()}catch(e){setStatus(e instanceof Error?e.message:'ดำเนินการไม่สำเร็จ')}finally{lock.current=false;setBusy(false)}}
 async function read(file:File){await work(async()=>{
  setPreview([]);setErrors([]);setConfirmed(false);setStatus('กำลังตรวจสอบไฟล์');
  if(file.size>2*1024*1024)throw Error('ไฟล์ต้องไม่เกิน 2 MB');
  let rows:unknown[][];
  if(file.name.toLowerCase().endsWith('.csv'))rows=parseCsv(await file.text());
  else if(file.name.toLowerCase().endsWith('.xlsx')){
   const {Workbook}=await import('exceljs');const wb=new Workbook();await wb.xlsx.load(await file.arrayBuffer());const sheet=wb.worksheets[0];
   if(!sheet||wb.worksheets.length!==1||sheet.rowCount>IMPORT_LIMIT+1||sheet.columnCount>3)throw Error('ใช้แผ่นงานเดียว และไม่เกิน '+IMPORT_LIMIT+' แถว / 3 คอลัมน์');
   rows=Array.from({length:sheet.rowCount},(_,i)=>Array.from({length:sheet.columnCount},(_,j)=>sheet.getRow(i+1).getCell(j+1).value));
  }else throw Error('รองรับเฉพาะ CSV และ XLSX');
  const parsed=validateSchoolRows(rows);setErrors(parsed.errors);
  if(parsed.errors.length){setStatus('กรุณาแก้ไขไฟล์ก่อนนำเข้า');return;}
  setPreview(previewSchoolRows(parsed.valid,await existing(kind)));setStatus('ตรวจสอบกับข้อมูลล่าสุดจากเซิร์ฟเวอร์แล้ว');
 })}
 async function apply(){if(!confirmed||errors.length||!preview.length||preview.some(r=>r.action==='blocked'))return;
  await work(async()=>{
   setConfirmed(false);const {db}=firebaseServices();
   try{
    await runTransaction(db,async tx=>{
     const refs=preview.map(r=>doc(db,kind,r.code));
     const snapshots=await Promise.all(refs.map(ref=>tx.get(ref)));
     snapshots.forEach((s,i)=>{const actual=s.exists()?record(s.id,s.data()):undefined;if(!sameRecord(preview[i].before,actual))throw Error('ข้อมูลเปลี่ยนระหว่างตรวจสอบ กรุณาเลือกไฟล์ใหม่');});
     preview.forEach((r,i)=>{if(r.action==='new')tx.set(refs[i],{code:r.code,name:r.name,active:true,createdAt:serverTimestamp()});else if(r.action==='rename')tx.update(refs[i],{name:r.name});});
    });
    setStatus('บันทึกสำเร็จ '+preview.filter(r=>r.action==='new'||r.action==='rename').length+' รายการ');setPreview([]);
   }catch(e){setPreview([]);throw e}
  });
 }
 return <details className="panel checking-tools"><summary>📥 Smart Import / Export · {schoolLabels[kind]}</summary>
 <p>รองรับ Excel (.xlsx) และ CSV · เพิ่มหรือแก้ชื่อจากรหัสเดิม ไม่ลบข้อมูล ไม่เปลี่ยนสถานะและไม่แก้คะแนนหรือรายชื่อในรายวิชา · ไม่เกิน {IMPORT_LIMIT} แถวต่อครั้ง</p>
 <div className="filters">{(['xlsx','csv'] as const).map(format=><button key={'template-'+format} disabled={busy} onClick={()=>void work(async()=>{await saveFile(template(kind),kind+'-template',format);setStatus('สร้างไฟล์ตัวอย่างแล้ว')})}>ไฟล์ตัวอย่าง {format.toUpperCase()}</button>)}
 {(['xlsx','csv'] as const).map(format=><button key={'export-'+format} disabled={busy} onClick={()=>void work(async()=>{const data=await existing(kind);await saveFile(exportSchoolRows(data),kind+'-export',format);setStatus('ส่งออก '+data.length+' รายการ')})}>Export {format.toUpperCase()}</button>)}</div>
 <p>แนะนำ Excel เพื่อรักษารหัสที่มีเลขศูนย์นำหน้า CSV อาจถูกโปรแกรมตารางคำนวณแปลงรหัสหรือข้อความพิเศษได้</p>
 <label>Import {schoolLabels[kind]}<input type="file" accept=".xlsx,.csv" disabled={busy} onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)void read(file)}}/></label>
 <p role="status">{status}</p>{errors.map((error,i)=><p role="alert" key={i}>{error}</p>)}
 {preview.length>0&&<><p>เพิ่มใหม่ {preview.filter(r=>r.action==='new').length} · เปลี่ยนชื่อ {preview.filter(r=>r.action==='rename').length} · ไม่เปลี่ยน {preview.filter(r=>r.action==='same').length} · ติดเงื่อนไข {preview.filter(r=>r.action==='blocked').length}</p>
 <div style={{maxHeight:320,overflow:'auto'}}><table><thead><tr><th>รหัส</th><th>ชื่อเดิม</th><th>ชื่อในไฟล์</th><th>ผลตรวจ</th></tr></thead><tbody>{preview.map(r=><tr key={r.code}><td>{r.code}</td><td>{r.before?.name??'—'}</td><td>{r.name}</td><td>{actions[r.action]}</td></tr>)}</tbody></table></div>
 <label><input type="checkbox" checked={confirmed} disabled={busy} onChange={e=>setConfirmed(e.target.checked)}/> ตรวจสอบรหัสและชื่อแล้ว ยืนยันการเพิ่ม/แก้ชื่อในข้อมูลกลาง</label>
 <div className="filters"><button type="button" disabled={busy} onClick={()=>{setPreview([]);setConfirmed(false)}}>ยกเลิก</button><button type="button" className="primary" disabled={busy||!confirmed||preview.some(r=>r.action==='blocked')} onClick={()=>void apply()}>ยืนยัน Import</button></div></>}
 </details>;
}
