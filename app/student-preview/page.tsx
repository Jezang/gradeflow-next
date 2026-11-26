'use client';
import {useState} from 'react';
import {studentProgress,studentWorkState,type StudentWork} from '../../lib/student-foundation';
import './student-preview.css';
const day=86400000, now=Date.UTC(2026,10,27,5);
const works:StudentWork[]=[
 {id:'1',course:'ภาษาอังกฤษ',title:'Unit 6 Worksheet',maxScore:10,score:8,submitted:true,deadline:now-day,revisionDeadline:null},
 {id:'2',course:'ภาษาอังกฤษ',title:'Vocabulary',maxScore:5,score:null,submitted:true,deadline:now+day,revisionDeadline:null},
 {id:'3',course:'คณิตศาสตร์',title:'แบบฝึกหัด 4',maxScore:10,score:null,submitted:false,deadline:now-day,revisionDeadline:now+day},
 {id:'4',course:'วิทยาศาสตร์',title:'ใบงานทดลอง',maxScore:10,score:null,submitted:false,deadline:now+day*2,revisionDeadline:null}
];
const labels={graded:'ตรวจแล้ว',pending:'ส่งแล้ว รอคะแนน',missing:'ยังไม่ส่ง',leave:'ลา',absent:'ขาด',revision:'อยู่ในช่วงแก้งาน',overdue:'เลยกำหนด'};
const date=(n:number|null)=>n===null?'—':new Intl.DateTimeFormat('th-TH',{dateStyle:'medium',timeZone:'Asia/Bangkok'}).format(n);
export default function StudentPreview(){
 const [course,setCourse]=useState(''),[theme,setTheme]=useState('sakura');
 const p=studentProgress(works);
 return <main className="student-preview" data-theme={theme}>
 <header><small>SAKURA CLASSROOM · DEMO ONLY</small><h1>สวัสดี นักเรียนจำลอง 🌸</h1><p>ม.2/2 · เลขที่ 7 · ข้อมูลสมมติทั้งหมด</p></header>
 <section className="student-metrics" aria-label="ภาพรวมงาน">
 {[[p.total,'งานทั้งหมด'],[p.submitted,'ส่งแล้ว'],[p.outstanding,'งานค้าง'],[p.points+' / '+p.possible,'คะแนนที่ตรวจแล้ว']].map(([n,l])=><div key={l}><strong>{n}</strong><small>{l}</small></div>)}
 </section>
 <section className="student-champion"><h2>🌱 Sakura Champions</h2><p>ส่งงานแล้ว {p.submitted} จาก {p.total} งาน</p><progress max={p.total} value={p.submitted}/><small>ความสำเร็จส่วนตัว ไม่จัดอันดับเพื่อน</small></section>
 <section><h2>งานของฉัน</h2><label>รายวิชา<select value={course} onChange={e=>setCourse(e.target.value)}><option value="">ทุกวิชา</option>{[...new Set(works.map(w=>w.course))].map(c=><option key={c}>{c}</option>)}</select></label>
 {works.filter(w=>!course||w.course===course).map(w=>{const state=studentWorkState(w,now);return <article key={w.id}><small>{w.course}</small><h3>{w.title}</h3><span className="student-status" data-state={state}>{labels[state]}</span><p>คะแนน {w.score===null?'—':w.score} / {w.maxScore}</p><small>ส่ง {date(w.deadline)} · แก้ {date(w.revisionDeadline)}</small></article>})}
 </section><section><h2>โปรไฟล์จำลอง</h2><label>ธีม<select value={theme} onChange={e=>setTheme(e.target.value)}><option value="sakura">Sakura</option><option value="mint">Mint</option></select></label></section>
 <footer>ต้นแบบออฟไลน์ · ไม่เชื่อม Firebase · ไม่ใช่คะแนนจริง</footer></main>
}
