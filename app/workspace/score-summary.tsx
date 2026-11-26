'use client';
import {useState} from 'react';
import {orderedScoreRows,scoreColumn,summarizeScores,summaryState,type ScoreSummaryRow,type SummaryState} from '../../lib/score-summary';
const labels:Record<SummaryState,string>={graded:'✓ ตรวจแล้ว',pending:'✓ ส่งแล้ว รอคะแนน',missing:'✕ ยังไม่ส่ง',leave:'◉ ลา',absent:'⊘ ขาด'};
export default function ScoreSummary({rows,title,maxScore,allowExport=false,compact=false}:{rows:ScoreSummaryRow[];title:string;maxScore:number;allowExport?:boolean;compact?:boolean}){
 const [filter,setFilter]=useState<SummaryState|'all'>('all'),[confirmed,setConfirmed]=useState(false),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const sorted=orderedScoreRows(rows),counts=summarizeScores(rows);
 let column:ReturnType<typeof scoreColumn>|null=null;try{column=scoreColumn(rows)}catch{}
 async function copy(){
  if(!column||!confirmed||busy)return;
  setBusy(true);try{
   if(!navigator.clipboard?.write||typeof ClipboardItem==='undefined')throw Error('เบราว์เซอร์ไม่รองรับการคัดลอกแบบรักษาแถว ใช้ Excel แทน');
   await navigator.clipboard.write([new ClipboardItem({'text/html':new Blob([column.html],{type:'text/html'}),'text/plain':new Blob([column.plain],{type:'text/plain'})})]);
   setMessage('คัดลอก '+column.count+' แถวแล้ว · วางที่เซลล์คะแนนของเลขที่ 1 แล้วตรวจสอบช่วงแถว รวมถึงช่องว่างท้ายตาราง');
  }catch(e){setMessage(e instanceof Error?e.message:'คัดลอกไม่ได้ ใช้ Excel แทน')}finally{setBusy(false)}
 }
 async function download(){
  if(busy)return;setBusy(true);try{
   const {Workbook}=await import('exceljs');const wb=new Workbook(),sheet=wb.addWorksheet('คะแนน');
   sheet.addRow(['เลขที่','ชื่อ-นามสกุล','รหัสนักเรียน',title+' / '+maxScore,'สถานะ']);
   sheet.columns.forEach((c,i)=>{c.width=[10,34,20,24,28][i]});sheet.getColumn(3).numFmt='@';
   for(const r of sorted)sheet.addRow([r.no??null,r.name,r.id,summaryState(r)==='graded'?r.score:null,labels[summaryState(r)]]);
   sheet.views=[{state:'frozen',ySplit:1}];sheet.getRow(1).font={bold:true};
   const bytes=await wb.xlsx.writeBuffer();const url=URL.createObjectURL(new Blob([new Uint8Array(bytes).buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));const a=document.createElement('a');a.href=url;a.download='GradeFlow-'+title.replace(/[^\p{L}\p{N}_-]/gu,'_').slice(0,80)+'.xlsx';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);setMessage('ส่งออก '+sorted.length+' คนแล้ว · ตรวจเลขที่และรหัสก่อนนำไปใช้');
  }catch{setMessage('สร้าง Excel ไม่สำเร็จ')}finally{setBusy(false)}
 }
 const metrics:[string,number|string,string][]=[['นักเรียนทั้งหมด',counts.total,'total'],['ส่งแล้ว',counts.submitted,'graded'],['ยังไม่ส่ง',counts.missing,'missing'],['ลา',counts.leave,'leave'],['ขาด',counts.absent,'absent'],['เฉลี่ย / '+maxScore,counts.average===null?'—':counts.average.toFixed(2),'average']];
 return <section className="panel checking-summary" style={{marginTop:16}}>
  <small>SMART SCORE SUMMARY</small><h2>สรุปผลคะแนน · {title}</h2>
  <div className="checking-metrics">{metrics.map(([label,value,state])=><div key={state} className="checking-metric" data-score-state={state}><strong>{value}</strong><small>{label}</small>{state==='graded'&&<progress max={Math.max(1,counts.total)} value={counts.submitted} aria-label="สัดส่วนการส่งงาน"/>}</div>)}</div>
  <p>ตรวจแล้ว {counts.graded} · ส่งแล้วรอคะแนน {counts.pending} · เฉลี่ยเฉพาะคนที่มีคะแนน</p>
  {!compact&&<><div className="filters"><label>สถานะ<select value={filter} onChange={e=>setFilter(e.target.value as SummaryState|'all')}><option value="all">ทั้งหมด</option>{Object.entries(labels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label></div>
  <div className="score-table-scroll" role="region" aria-label="สรุปคะแนนรายงาน" tabIndex={0}><table className="sakura-score-table"><thead><tr><th>เลขที่</th><th>นักเรียน</th><th>คะแนน</th><th>สถานะ</th></tr></thead><tbody>{sorted.filter(r=>filter==='all'||summaryState(r)===filter).map(r=><tr key={r.id}><td>{r.no??'—'}</td><td>{r.name}<br/><small>{r.id}</small></td><td>{summaryState(r)==='graded'?r.score:'—'}</td><td><span className="checking-status" data-score-state={summaryState(r)}>{labels[summaryState(r)]}</span></td></tr>)}</tbody></table></div></>}
  {allowExport&&<><p>ส่งออกทุกคนโดยไม่ขึ้นกับตัวกรอง · 0 คือคะแนนจริง ช่องว่างคือยังไม่มีคะแนน · เลขที่จากประวัติเดิมไม่ใช่การยืนยันลำดับของชีตปัจจุบัน</p>
  <label><input type="checkbox" checked={confirmed} disabled={!column||busy} onChange={e=>setConfirmed(e.target.checked)}/> ยืนยันว่าชีตปลายทางมีรหัสนักเรียนตรงกันทุกแถว เรียงตามเลขที่ 1 ถึง {rows.length} และเป็นงานเดียวกัน</label>
  {!column&&<p>ยังยืนยันเลขที่ไม่ครบหรือมีช่องว่างในลำดับ จึงปิดการคัดลอกเฉพาะคะแนนไว้ ใช้ Excel พร้อมรหัสนักเรียนแทน</p>}
  <div className="filters"><button className="primary" disabled={!column||!confirmed||busy} onClick={()=>void copy()}>คัดลอกคอลัมน์คะแนน</button><button disabled={busy||!rows.length} onClick={()=>void download()}>ดาวน์โหลด Excel งานนี้</button></div><p role="status">{message}</p></>}
  <small>สถานะลาและขาดเฉพาะงานนี้ · เมื่อส่งงานแล้ว สถานะส่งจะมีความสำคัญกว่า</small>
 </section>
}
