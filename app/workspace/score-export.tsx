'use client';

import {useLayoutEffect, useRef, useState} from 'react';
import {gradebookCsvPreview} from '../../lib/gradebook-csv-preview';
import {scoreExportXlsx} from '../../lib/score-export-xlsx';
import {
  previewSheetsMapping, scoreExportColumns, scoreExportTable, scoreExportSnapshotKey,
  type ExportScope, type ScoreExportRow, type SheetsMapping,
} from '../../lib/score-export';

const mappingMessages = {
  sheet: 'กรอกชื่อแท็บของ Google Sheets',
  column: 'ใช้ตัวอักษรคอลัมน์ A ถึง ZZZ',
  duplicate: 'เลือกคอลัมน์ปลายทางต่างกันสำหรับแต่ละข้อมูล',
  id: 'ระบุคอลัมน์รหัสนักเรียนสำหรับจับคู่แถว',
  fields: 'เลือกข้อมูลที่จะส่งออกเพิ่มอย่างน้อยหนึ่งคอลัมน์',
};

type ScoreExportProps = {
  scope: ExportScope;
  students: readonly ScoreExportRow[];
};

export default function ScoreExport({scope, students}: ScoreExportProps) {
  const snapshotKey = scoreExportSnapshotKey(scope, students);
  const [snapshot, setSnapshot] = useState(() => ({identity: snapshotKey, version: 0}));
  // Compare the local identity in state, but keep student data out of React element keys.
  // React retries this render before committing children when the identity changes.
  if (snapshot.identity !== snapshotKey) {
    setSnapshot({identity: snapshotKey, version: snapshot.version + 1});
  }
  return <div>
    <p>หากข้อมูลคะแนน รายชื่อ หรือรายวิชาเปลี่ยน ระบบจะให้ตรวจสอบและอนุมัติตัวอย่างใหม่ก่อนดาวน์โหลด</p>
    <ReviewedScoreExport key={snapshot.version} scope={scope} students={students}/>
  </div>;
}

function ReviewedScoreExport({scope, students}: ScoreExportProps) {
  const [table, setTable] = useState<ReturnType<typeof scoreExportTable> | null>(null);
  const [approved, setApproved] = useState(false);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState('');
  const [mapping, setMapping] = useState<SheetsMapping>({});
  const lock = useRef(false);
  const revision = useRef(0);
  // Invalidate an in-flight XLSX download as soon as the reviewed snapshot is replaced.
  useLayoutEffect(() => () => {revision.current++}, []);
  const destination = previewSheetsMapping(sheet, mapping);

  function openPreview() {
    setApproved(false);
    setStatus('');
    try {
      setTable(scoreExportTable(scope, students));
    } catch {
      setTable(null);
      setStatus('เปิดตัวอย่างไม่ได้ โปรดตรวจสอบรหัสนักเรียนที่ว่าง ซ้ำ มีช่องว่างหัวท้าย/อักขระควบคุม หรือข้อมูลคะแนนและจำนวนงานที่ไม่ถูกต้อง');
    }
  }

  async function download(format: 'csv' | 'xlsx') {
    if (!approved || !table || lock.current) return;
    const current = revision.current;
    lock.current = true;
    setBusy(true);
    try {
      let blob: Blob;
      if (format === 'csv') {
        blob = new Blob(['\uFEFF', gradebookCsvPreview(table)], {type: 'text/csv;charset=utf-8'});
      } else {
        const bytes = await scoreExportXlsx(table);
        blob = new Blob([bytes], {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
      }
      if (current !== revision.current) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'gradeflow-scores.' + format;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus('ส่งออกไฟล์แล้ว โปรดเก็บไฟล์ไว้เป็นส่วนตัว');
    } catch {
      if (current === revision.current) setStatus('ส่งออกไฟล์ไม่สำเร็จ');
    } finally {
      lock.current = false;
      if (current === revision.current) setBusy(false);
    }
  }

  return <div>
    <button type="button" onClick={openPreview} disabled={busy || !students.length}>
      ดูตัวอย่างไฟล์คะแนน
    </button>
    {table && <div>
      <h3>ตัวอย่าง CSV / XLSX</h3>
      <p>ภาคเรียน {scope.term} · {scope.subject} · {scope.room} · นักเรียน {students.length} คน</p>
      <div style={{overflowX: 'auto', maxHeight: '24rem'}}>
        <table style={{width: '100%'}}>
          <thead><tr>{scoreExportColumns.map(({key, label}) => <th key={key} scope="col">{label}</th>)}</tr></thead>
          <tbody>{table.slice(5).map(row => <tr key={row[0]}>
            {row.map((cell, index) => <td key={scoreExportColumns[index].key}>{cell ?? '—'}</td>)}
          </tr>)}</tbody>
        </table>
      </div>
      <p>ช่องที่มีขีดในตัวอย่างจะว่างในไฟล์ ใช้ XLSX เพื่อรักษาเลขศูนย์นำหน้ารหัสเมื่อเปิดในโปรแกรมตารางคำนวณ</p>
      <label><input type="checkbox" checked={approved} disabled={busy}
        onChange={event => setApproved(event.target.checked)}/> ตรวจสอบข้อมูลและอนุมัติการดาวน์โหลดแล้ว</label>
      <div className="filters">
        <button type="button" disabled={!approved || busy} onClick={() => void download('csv')}>ดาวน์โหลด CSV</button>
        <button type="button" disabled={!approved || busy} onClick={() => void download('xlsx')}>ดาวน์โหลด XLSX</button>
      </div>
      <details>
        <summary>วางแผนคอลัมน์ Google Sheets</summary>
        <p>เก็บตารางปลายทางเป็นส่วนตัว ตรวจสอบคอลัมน์ที่มีสูตรในชีตด้วยตนเอง ระบบปิดการเขียนลงชีตโดยตรง</p>
        <label>ชื่อแท็บ<input value={sheet} onChange={event => setSheet(event.target.value)}/></label>
        <div className="filters">{scoreExportColumns.map(({key, label}) => <label key={key}>
          คอลัมน์ {label}<input value={mapping[key] ?? ''} maxLength={3} placeholder="เช่น A"
            onChange={event => setMapping({...mapping, [key]: event.target.value})}/>
        </label>)}</div>
        {destination.ok ? <>
          <p>แท็บ {destination.sheet} · ใช้รหัสนักเรียนจับคู่แถว</p>
          <ul>{destination.mapping.map(({key, column}) => <li key={key}>
            {scoreExportColumns.find(field => field.key === key)?.label} → {column}
          </li>)}</ul>
        </> : <p>{mappingMessages[destination.reason]}</p>}
      </details>
    </div>}
    {status && <p role="status">{status}</p>}
  </div>;
}
