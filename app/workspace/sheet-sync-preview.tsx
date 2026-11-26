'use client';
import {useRef,useState} from 'react';
import type {Workbook,Worksheet} from 'exceljs';
import type {advisorPreview} from '../../lib/advisor-preview';
import {planSheetGradeSync,reviewSheetMatches,sheetScoreColumns,type SyncDirection,type SheetGrade,type SheetColumn} from '../../lib/sheet-grade-sync';
type Report=ReturnType<typeof advisorPreview>;
type Snapshot={name:string;columns:SheetColumn[];rows:{row:number;name:string;studentId?:string}[];sheet:Worksheet};
const hasFormula=(value:unknown)=>!!value&&typeof value==='object'&&('formula' in value||'sharedFormula' in value);
function readTab(sheet:Worksheet):Snapshot{
 if(sheet.rowCount>2000||sheet.columnCount>100)throw Error('ไฟล์เกินขอบเขต 2,000 แถว / 100 คอลัมน์');
 const headers=Array.from({length:4},(_,r)=>Array.from({length:sheet.columnCount},(_,c)=>{
  const value=sheet.getCell(r+1,c+1).value;
  return typeof value==='string'||typeof value==='number'?value:null;
 }));
 const rows:{row:number;name:string;studentId?:string}[]=[];
 const withIds=headers[0][2]==='รหัสนักเรียน';
 const blocked=new Set<number>();
 for(let c=4;c<=sheet.columnCount;c++)if(hasFormula(sheet.getCell(4,c).value))blocked.add(c);
 for(let r=5;r<=sheet.rowCount;r++){
  const number=sheet.getCell(r,1).value,name=sheet.getCell(r,2).value,id=withIds?sheet.getCell(r,3).value:null;
  if((number===null||number==='')&&(name===null||name==='')&&(id===null||id===''))continue;
  if(typeof name!=='string'||!name.trim()||(!withIds&&!/^\d+$/.test(String(number??'').trim()))||(withIds&&(typeof id!=='string'||!(/^[A-Za-z0-9_-]{1,60}$/).test(id))))throw Error('พบแถวที่ไม่ใช่รายชื่อนักเรียนที่แถว '+r+' กรุณาใช้สำเนาที่มีเฉพาะตารางคะแนน');
  rows.push({row:r,name,...(withIds?{studentId:String(id)}:{})});
  for(let c=4;c<=sheet.columnCount;c++)if(hasFormula(sheet.getCell(r,c).value))blocked.add(c);
 }
 if(!rows.length||rows.length>500)throw Error('ต้องมีรายชื่อนักเรียน 1–500 คน');
 return {name:sheet.name,rows,columns:sheetScoreColumns(headers,[...blocked]),sheet};
}
function letter(n:number){let out='';while(n){n--;out=String.fromCharCode(65+n%26)+out;n=Math.floor(n/26)}return out}
const stateLabel={protected:'สูตร (ไม่แก้ไข)',invalid:'ข้อมูลไม่ถูกต้อง',same:'ตรงกัน',conflict:'คะแนนต่างกัน ต้องตรวจสอบ',reviewImport:'เสนอให้นำเข้า',reviewExport:'เสนอให้ส่งออก',skip:'ข้าม'};
export default function SheetSyncPreview({report}:{report:Report}){
 const [book,setBook]=useState<Workbook|null>(null),[tabs,setTabs]=useState<string[]>([]),[snapshot,setSnapshot]=useState<Snapshot|null>(null),[fileName,setFileName]=useState(''),[busy,setBusy]=useState(false),[status,setStatus]=useState('');
 const [work,setWork]=useState(''),[column,setColumn]=useState(''),[direction,setDirection]=useState<SyncDirection>('import'),[confirmed,setConfirmed]=useState(false),[plan,setPlan]=useState<ReturnType<typeof planSheetGradeSync>|null>(null);
 const [manual,setManual]=useState<Record<string,number>>({});
 const lock=useRef(false);
 function reset(){setPlan(null);setConfirmed(false);setManual({})}
 async function load(file:File){
  if(lock.current)return;
  lock.current=true;setBusy(true);setBook(null);setSnapshot(null);setTabs([]);setFileName('');reset();setWork('');setColumn('');setStatus('กำลังอ่านไฟล์บนอุปกรณ์');
  try{
   if(!/\.xlsx$/i.test(file.name)||file.size>8*1024*1024)throw Error('รองรับไฟล์ XLSX ไม่เกิน 8 MB');
   const {Workbook}=await import('exceljs');
   const wb=new Workbook();await wb.xlsx.load(await file.arrayBuffer());
   const names=wb.worksheets.filter(s=>s.state==='visible').map(s=>s.name);
   if(!names.length)throw Error('ไม่พบแท็บที่แสดงอยู่');
   setBook(wb);setTabs(names);setFileName(file.name);setStatus('เลือกแท็บที่จะตรวจสอบ');
  }catch(e){setStatus(e instanceof Error?e.message:'อ่านไฟล์ไม่ได้')}
  finally{lock.current=false;setBusy(false)}
 }
 function chooseTab(name:string){
  setSnapshot(null);setColumn('');reset();setStatus('');
  if(!name||!book)return;
  try{const s=book.getWorksheet(name);if(!s||s.state!=='visible')throw Error('ไม่พบแท็บ');
   const data=readTab(s);setSnapshot(data);setStatus('พบ '+data.rows.length+' รายชื่อ และ '+data.columns.length+' คอลัมน์คะแนนที่ไม่พบสูตรในช่วงตรวจสอบ');
  }catch(e){setStatus(e instanceof Error?e.message:'ตรวจแท็บไม่ได้')}
 }
 let review:ReturnType<typeof reviewSheetMatches>|null=null,matchError='';
 if(snapshot){try{review=reviewSheetMatches(report.students.map(s=>({studentId:s.id,name:s.name})),snapshot.rows,manual)}catch(e){matchError=e instanceof Error?e.message:'จับคู่ไม่ได้'}}
 const matches=review?.complete?review.matches:null;
 const w=report.works.find(x=>x.id===work),c=snapshot?.columns.find(x=>String(x.column)===column);
 function compare(){
  setPlan(null);
  if(!snapshot||!matches||!confirmed||!w||!c)return;
  try{
   const rows:SheetGrade[]=snapshot.rows.map(s=>{const cell=snapshot.sheet.getCell(s.row,c.column);return {...s,value:cell.value,formula:hasFormula(cell.value)}});
   const web=report.students.map(s=>{const cell=s.cells.find(x=>x.workId===w.id);if(!cell)throw Error('ข้อมูลเว็บไม่ครบ');return {studentId:s.id,name:s.name,score:cell.score,submitted:cell.state!=='missing'}});
   setPlan(planSheetGradeSync({direction,webMax:w.maxScore,sheetMax:c.maxScore,web,sheet:rows,matches}));setStatus('เปรียบเทียบสำเร็จ · ไม่มีการบันทึกคะแนน');
  }catch(e){setStatus(e instanceof Error?e.message:'เปรียบเทียบไม่ได้')}
 }
 return <details className="panel checking-tools"><summary>Smart Google Sheets Sync · ทดลองจับคู่คะแนน</summary>
 <p>ดาวน์โหลด Google Sheets เป็น Microsoft Excel (.xlsx) แล้วเลือกไฟล์ที่นี่ ระบบอ่านบนอุปกรณ์เท่านั้น ยังไม่เชื่อม API หรือเขียนข้อมูลจริง รองรับหัวตาราง 4 แถว ชื่อในคอลัมน์ B และรายชื่อเริ่มแถว 5 · ไฟล์ต้นแบบใหม่ตรวจรหัสในคอลัมน์ C เพิ่มเติม</p>
 <label>ไฟล์คะแนน<input type="file" accept=".xlsx" disabled={busy} onChange={e=>{const f=e.target.files?.[0];e.target.value='';if(f)void load(f)}}/></label>
 {fileName&&<small>{fileName}</small>}
 {book&&<label>แท็บคะแนน<select value={snapshot?.name??''} onChange={e=>chooseTab(e.target.value)}><option value="">เลือกแท็บ</option>{tabs.map(t=><option key={t}>{t}</option>)}</select></label>}
 {snapshot&&<><p>{matchError||'จับคู่แล้ว '+(review?.matches.length??0)+' / '+report.students.length+' คน · รายชื่อในไฟล์ '+snapshot.rows.length+' คน'}</p>
 {review&&<><div className="score-table-scroll"><table><thead><tr><th>รหัสในเว็บ</th><th>ชื่อในเว็บ</th><th>ชื่อในไฟล์ / แถว</th></tr></thead><tbody>{review.matches.map(m=><tr key={m.studentId}><td>{m.studentId}</td><td>{m.name}</td><td>{m.sheetName} · {m.row}{manual[m.studentId]!==undefined&&<button type="button" onClick={()=>{setManual(old=>{const next={...old};delete next[m.studentId];return next});setConfirmed(false);setPlan(null)}}>ยกเลิกการจับคู่</button>}</td></tr>)}</tbody></table></div>
 {review.unresolved.length>0&&<><p role="alert">ยังไม่ตรง {review.unresolved.length} คน · ตรวจชื่อและเลือกแถวของนักเรียนคนเดียวกันเท่านั้น</p>{review.unresolved.map(s=><label key={s.studentId}>{s.name} ({s.studentId})<select value="" onChange={e=>{if(!e.target.value)return;setManual(old=>({...old,[s.studentId]:Number(e.target.value)}));setConfirmed(false);setPlan(null)}}><option value="">เลือกชื่อในไฟล์</option>{review.unused.filter(r=>r.studentId===undefined||r.studentId===s.studentId).map(r=><option key={r.row} value={r.row}>{r.name} · แถว {r.row}</option>)}</select></label>)}</>}
 {review.unused.length>0&&<p>แถวในไฟล์ที่ยังไม่จับคู่: {review.unused.map(r=>r.row+' '+r.name).join(' · ')}</p>}
 {snapshot.rows.length!==report.students.length&&<p role="alert">จำนวนรายชื่อไม่เท่ากัน กรุณาตรวจห้องและแท็บคะแนน</p>}
 {matches&&<label><input type="checkbox" checked={confirmed} onChange={e=>{setConfirmed(e.target.checked);setPlan(null)}}/> ตรวจยืนยันรายชื่อทั้งสองฝั่งและขอบเขตห้องนี้แล้ว</label>}</>}
 <div className="filters">
 <label>งานใน GradeFlow<select value={work} onChange={e=>{setWork(e.target.value);setPlan(null)}}><option value="">เลือกงาน</option>{report.works.map(x=><option key={x.id} value={x.id}>{x.title} ({x.maxScore})</option>)}</select></label>
 <label>คอลัมน์คะแนนในไฟล์<select value={column} onChange={e=>{setColumn(e.target.value);setPlan(null)}}><option value="">เลือกคอลัมน์</option>{snapshot.columns.map(x=><option key={x.column} value={x.column}>{letter(x.column)} · {x.label} ({x.maxScore})</option>)}</select></label>
 <label>ทิศทาง<select value={direction} onChange={e=>{setDirection(e.target.value as SyncDirection);setPlan(null)}}><option value="import">จากชีตเข้าเว็บ</option><option value="export">จากเว็บไปชีต</option></select></label>
 <button type="button" className="primary" disabled={!confirmed||!matches||!w||!c||w.maxScore!==c.maxScore} onClick={compare}>ตรวจตัวอย่างคะแนน</button>
 </div>{w&&c&&w.maxScore!==c.maxScore&&<p role="alert">คะแนนเต็มไม่ตรงกัน รุ่นแรกยังไม่แปลงสัดส่วน</p>}</>}
 <p role="status" aria-live="polite">{status}</p>
 {plan&&<><p>เสนอเปลี่ยน {plan.filter(x=>x.state==='reviewImport'||x.state==='reviewExport').length} · คะแนนต่าง {plan.filter(x=>x.state==='conflict').length} · ไม่ถูกต้อง {plan.filter(x=>x.state==='invalid').length} · ตรงกัน {plan.filter(x=>x.state==='same').length}</p><div className="score-table-scroll"><table><thead><tr><th>รหัส</th><th>แถว</th><th>เว็บ</th><th>ชีต</th><th>ผลตรวจ</th></tr></thead><tbody>{plan.map(x=><tr key={x.studentId}><td>{x.studentId}</td><td>{x.row}</td><td>{x.webScore??'—'}</td><td>{typeof x.sheetScore==='number'||typeof x.sheetScore==='string'?String(x.sheetScore)||'—':'—'}</td><td>{stateLabel[x.state]}</td></tr>)}</tbody></table></div><small>ตัวอย่างเท่านั้น ไม่สามารถยืนยันเขียนคะแนนได้ในรุ่นนี้ · ใช้ไฟล์ล่าสุดและโหลดรายงานเว็บใหม่ก่อนเปรียบเทียบ</small></>}
 </details>
}
