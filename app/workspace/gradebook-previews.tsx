'use client';

import { useState } from 'react';
import { previewBulkRoster, type RosterPreviewRow } from '../../lib/bulk-roster-preview';
import { summarizeWeightedGrades, type GradeWork } from '../../lib/weighted-grade-preview';
import { provisionalGrade } from '../../lib/ranking';

const rosterStatus: Record<RosterPreviewRow['status'], string> = {
 new: 'พร้อมเพิ่ม',
 reactivate: 'รายชื่อเดิมที่ปิดใช้งาน',
 enrolled: 'อยู่ในรายวิชาแล้ว',
 unavailable: 'ไม่พบข้อมูลกลางที่เปิดใช้งาน',
 invalid: 'รูปแบบรหัสไม่ถูกต้อง',
};

export function BulkRosterPreview({ roomId, ready, students, roster }: {
 roomId: string;
 ready: boolean;
 students: { id: string; name: string; active: boolean }[];
 roster: { id: string; active: boolean }[];
}) {
 const [raw, setRaw] = useState('');
 const [confirmed, setConfirmed] = useState('');
 const preview = ready && confirmed.trim() ? previewBulkRoster(confirmed, students, roster) : null;
 return <section className="panel">
  <h2>ตรวจรายชื่อก่อนเพิ่มหลายคน</h2>
  <p>ห้อง {roomId} · ตรวจรหัสกับทะเบียนกลางและรายชื่อรายวิชา โปรดยืนยันห้องของนักเรียนจากรายชื่อห้องเรียนก่อนเพิ่ม</p>
  <form onSubmit={event => { event.preventDefault(); if (ready) setConfirmed(raw); }}>
   <label>รหัสนักเรียน คั่นด้วยบรรทัดใหม่หรือจุลภาค
    <textarea rows={4} maxLength={32000} value={raw} disabled={!ready}
     onChange={event => { setRaw(event.target.value); setConfirmed(''); }} />
   </label>
   <button disabled={!ready || !raw.trim()}>ตรวจรายชื่อสำหรับห้อง {roomId}</button>
  </form>
  {!ready && <p role="status">ต้องมีข้อมูลกลางและรายชื่อรายวิชาจากเซิร์ฟเวอร์ครบก่อนตรวจ</p>}
  {ready && confirmed.trim() && !preview && <p role="alert">ตรวจได้สูงสุด 500 รหัส</p>}
  {preview && <>
   <p role="status">พร้อมเพิ่ม {preview.filter(row => row.status === 'new').length} จาก {preview.length} รหัส</p>
   <div style={{ overflowX: 'auto' }}><table>
    <thead><tr><th scope="col">รหัส</th><th scope="col">ชื่อ</th><th scope="col">สถานะ</th></tr></thead>
    <tbody>{preview.map(row => <tr key={row.id}><td>{row.id}</td><td>{row.name ?? '—'}</td>
     <td>{rosterStatus[row.status]}</td></tr>)}</tbody>
   </table></div>
  </>}
 </section>;
}

const initialCategories = [
 { name: 'งานและแบบฝึกหัด', weight: '100' },
 { name: 'กลางภาค', weight: '0' },
 { name: 'ปลายภาค', weight: '0' },
];
const thresholds = [80, 75, 70, 65, 60, 55, 50];

export function WeightedGradePreview({ students, works }: {
 students: { id: string; name: string }[];
 works: GradeWork[];
}) {
 const [categories, setCategories] = useState(initialCategories);
 const [assignments, setAssignments] = useState<Record<string, number>>({});
 const [draft, setDraft] = useState(thresholds.join(', '));
 const criteria = draft.split(',').map(value => Number(value.trim()));
 const validCriteria = criteria.length === 7 && criteria.every((value, i) =>
  Number.isFinite(value) && value > 0 && value <= 100 && (i === 0 || value < criteria[i - 1]));
 const rows = summarizeWeightedGrades(students, works, categories.map((category, index) => ({
  weight: category.weight.trim() ? Number(category.weight) : NaN,
  workIds: works.filter(work => (assignments[work.id] ?? 0) === index).map(work => work.id),
 })));
 return <div>
  <h3>ตัวอย่างเกรดถ่วงน้ำหนัก</h3>
  <p>ปรับหมวด น้ำหนัก และเกณฑ์สำหรับรายวิชานี้ การตั้งค่าใช้กับตัวอย่างบนหน้านี้</p>
  {!works.length ? <p>ยังไม่มีงานที่เปิดใช้งาน</p> : <>
   {categories.map((category, index) => <div className="filters" key={index}>
    <label>ชื่อหมวด {index + 1}<input maxLength={60} value={category.name}
     onChange={event => setCategories(previous => previous.map((item, i) =>
      i === index ? { ...item, name: event.target.value } : item))} /></label>
    <label>น้ำหนักหมวด {index + 1} (%)<input type="number" min="0" max="100" step="any" value={category.weight}
     onChange={event => setCategories(previous => previous.map((item, i) =>
      i === index ? { ...item, weight: event.target.value } : item))} /></label>
   </div>)}
   <button type="button" disabled={categories.length >= 10}
    onClick={() => setCategories(previous => [...previous, { name: '', weight: '0' }])}>เพิ่มหมวด</button>
   {works.map(work => <label key={work.id}>หมวดของ {work.title} ({work.maxScore} คะแนน)
    <select value={assignments[work.id] ?? 0} onChange={event =>
     setAssignments(previous => ({ ...previous, [work.id]: Number(event.target.value) }))}>
     {categories.map((category, index) => <option key={index} value={index}>
      {category.name.trim() || 'หมวด ' + (index + 1)}
     </option>)}
    </select>
   </label>)}
   <label>เกณฑ์ 4, 3.5, 3, 2.5, 2, 1.5, 1 (%)<input value={draft}
    onChange={event => setDraft(event.target.value)} /></label>
   {!validCriteria && <p role="alert">กรอกเกณฑ์ 7 ค่า จากมากไปน้อย ระหว่าง 0–100%</p>}
   {!rows ? <p role="status">น้ำหนักรวมต้องเท่ากับ 100% และทุกหมวดที่มีน้ำหนักต้องมีงานอย่างน้อยหนึ่งรายการ</p>
    : <div style={{ overflowX: 'auto' }}><table>
     <caption>คะแนนถ่วงน้ำหนักจะแสดงเมื่อให้คะแนนครบในทุกหมวดที่มีน้ำหนัก</caption>
     <thead><tr><th scope="col">นักเรียน</th>{categories.map((category, i) =>
      <th key={i} scope="col">{category.name.trim() || 'หมวด ' + (i + 1)}</th>)}
      <th scope="col">คะแนนถ่วงน้ำหนัก</th><th scope="col">เกรดจำลอง</th></tr></thead>
     <tbody>{rows.map(row => {
      const grade = row.percent !== null && validCriteria
       ? provisionalGrade({ ...row, expected: 1, submitted: 1, graded: 1, points: row.percent, maximum: 100 }, criteria)
       : null;
      return <tr key={row.id}><th scope="row">{row.name} · {row.id}</th>
       {row.scores.map((score, i) => <td key={i}>{score.expected === 0 ? '—' : score.graded === 0 ? 'รอคะแนน'
        : `${score.earned.toLocaleString('th-TH')} / ${score.possible.toLocaleString('th-TH')} · ตรวจ ${score.graded}/${score.expected}`}</td>)}
       <td>{row.percent === null ? 'รอคะแนน' : row.percent.toFixed(2) + '%'}</td><td>{grade ?? '—'}</td>
      </tr>;
     })}</tbody>
    </table></div>}
  </>}
 </div>;
}
