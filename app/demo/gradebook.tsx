'use client';
import {useState,type FormEvent} from 'react';
import {matchesScoreFilter,parseQuickScore,type ScoreStatusFilter} from '../../lib/quick-score';
import {SakuraAnimalAvatar,animalAt} from '../workspace/sakura-animals';
import {SakuraIcon} from '../workspace/sakura-icons';

type DemoRow={id:string;name:string;submitted:boolean;score:number|null};
const initialRows:DemoRow[]=[
 {id:'TEST001',name:'นักเรียน A',submitted:true,score:8},
 {id:'TEST002',name:'นักเรียน B',submitted:true,score:0},
 {id:'TEST003',name:'นักเรียน C',submitted:true,score:null},
 {id:'TEST004',name:'นักเรียน D',submitted:false,score:null},
];
const maximum=10;
export default function DemoGradebook(){
 const [rows,setRows]=useState(initialRows),[search,setSearch]=useState(''),[filter,setFilter]=useState<ScoreStatusFilter>('all');
 const [draft,setDraft]=useState<{id:string;raw:string}|null>(null),[message,setMessage]=useState('');
 const visible=rows.filter(row=>matchesScoreFilter(row,row,search,filter));
 const submitted=rows.filter(row=>row.submitted).length;
 const graded=rows.filter(row=>row.submitted&&row.score!==null).length;
 function save(e:FormEvent){
  e.preventDefault();
  if(!draft)return;
  const parsed=parseQuickScore(draft.raw,maximum);
  if(!parsed.ok){setMessage('กรอกคะแนนระหว่าง 0–10 หรือเว้นว่างเพื่อรอคะแนน');return}
  setRows(old=>old.map(row=>row.id===draft.id&&row.submitted?{...row,score:parsed.value}:row));
  setDraft(null);setMessage('บันทึกคะแนนจำลองแล้ว');
 }
 return <div className="teaching-grid sakura-scanner demo-gradebook">
  <section className="panel scanner-intro"><small>SMART SCANNER · DEMO</small><h2 className="sakura-icon-heading"><SakuraIcon name="scanner"/> ทดลองตรวจงานและให้คะแนน</h2><p>ข้อมูลสมมติทั้งหมด เก็บเฉพาะในหน้านี้ ไม่เชื่อมต่อ Firebase และไม่บันทึกข้อมูลจริง</p><p>รายวิชาตัวอย่าง · แบบฝึกหัด 01 · คะแนนเต็ม {maximum}</p></section>
  <div className="stats demo-grade-stats">{[['นักเรียน',rows.length],['ส่งแล้ว',submitted],['ให้คะแนนแล้ว',graded],['รอคะแนน',submitted-graded]].map(([label,value])=><section className="panel hub-kpi" key={label}><small>{label}</small><strong>{value}</strong></section>)}</div>
  <section className="panel"><h2>Gradebook Quick Edit</h2><div className="filters"><label>ค้นหาชื่อหรือรหัส<input value={search} disabled={draft!==null} onChange={e=>setSearch(e.target.value)} placeholder="TEST001"/></label><label>สถานะคะแนน<select value={filter} disabled={draft!==null} onChange={e=>setFilter(e.target.value as ScoreStatusFilter)}><option value="all">ทั้งหมด</option><option value="unsubmitted">ยังไม่ส่ง</option><option value="ungraded">ส่งแล้ว รอคะแนน</option><option value="graded">ตรวจแล้ว (รวม 0 คะแนน)</option></select></label><button type="button" disabled={draft!==null} onClick={()=>{setRows(initialRows);setSearch('');setFilter('all');setMessage('รีเซ็ตข้อมูลจำลองแล้ว')}}>รีเซ็ตตัวอย่าง</button></div>
   <p role="status" aria-live="polite">{message||'แสดง '+visible.length+' จาก '+rows.length+' คน'}</p>
   <div className="score-table-scroll" tabIndex={0} role="region" aria-label="ตารางคะแนนจำลอง"><table className="sakura-score-table"><caption>ตารางคะแนนจำลอง</caption><thead><tr><th scope="col">นักเรียน</th><th scope="col">คะแนน / สถานะ</th><th scope="col">จัดการ</th></tr></thead><tbody>
   {visible.map(row=><tr key={row.id}><td><div className="demo-student"><span className="demo-score-avatar"><SakuraAnimalAvatar animal={animalAt(rows.indexOf(row))}/></span><div><strong>{row.name}</strong><small>{row.id}</small></div></div></td><td>{draft?.id===row.id?<form className="score-inline-edit" onSubmit={save}><label>คะแนนใหม่<input autoFocus inputMode="decimal" value={draft.raw} onChange={e=>setDraft(old=>old?{...old,raw:e.target.value}:null)}/></label><button className="primary">บันทึก</button><button type="button" onClick={()=>{setDraft(null);setMessage('ยกเลิกการแก้ไข')}}>ยกเลิก</button></form>:<span className={'demo-score-state '+(!row.submitted?'missing':row.score===null?'pending':'graded')}>{!row.submitted?'ยังไม่ส่ง':row.score===null?'รอคะแนน':row.score+' / '+maximum}</span>}</td><td><div className="score-row-actions">{row.submitted?<button disabled={draft!==null} onClick={()=>{setDraft({id:row.id,raw:row.score===null?'':String(row.score)});setMessage('')}}>แก้คะแนน</button>:<button disabled={draft!==null} onClick={()=>{setRows(old=>old.map(r=>r.id===row.id?{...r,submitted:true}:r));setMessage('รับงานจำลองแล้ว')}}>รับงาน</button>}</div></td></tr>)}
   {!visible.length&&<tr><td colSpan={3}>ไม่พบรายการที่ตรงกับตัวกรอง</td></tr>}</tbody></table></div>
   <small>ตัวอย่างนี้ใช้ตัวตรวจสอบคะแนนเดียวกับระบบจริง แต่ไม่ได้ทดสอบการบันทึก Firestore หรือกล้องสแกน</small>
  </section>
 </div>
}
