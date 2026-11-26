import {codeBox} from '../lib/worksheet-placement.ts';
import {planSheetGradeSync,sheetScoreColumns,proposeSheetMatches} from '../lib/sheet-grade-sync.ts';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {gradebookCsvPreview} from '../lib/gradebook-csv-preview.ts';
import {previewSheetsMapping, scoreExportTable, scoreExportSnapshotKey} from '../lib/score-export.ts';
import {validateStudents,parseCsv,csv,csvCell} from '../lib/reports.ts';
test('preserves leading zeros and rejects duplicates, nontext ids and extra data',()=>{const r=validateStudents([['001','ชื่อ'],['001','ซ้ำ'],[2,'numeric'],['A','ok','unexpected'],['B',''],['C','ชื่อ 2']]);assert.deepEqual(r.valid,[{code:'001',name:'ชื่อ'},{code:'C',name:'ชื่อ 2'}]);assert.equal(r.errors.length,4)});
test('CSV handles BOM, quotes, commas and line breaks',()=>{assert.deepEqual(parseCsv('\uFEFFcode,name\r\n001,"A, B"\r\n002,"a""b\nc"'),[['code','name'],['001','A, B'],['002','a"b\nc']]);assert.throws(()=>parseCsv('a,"bad'));assert.throws(()=>parseCsv('a,"bad"x'));});
test('CSV formula injection protection and numeric values',()=>{assert.equal(csvCell(' =1+1'),"\"' =1+1\"");assert.equal(csvCell(-2),'"-2"');assert.equal(parseCsv(csv([['001','ชื่อ']]))[0][0],'001');});

const scope = {term: 'SYNTHETIC-TERM', subject: 'SUB-DEMO', room: 'ROOM-DEMO'};
const student = {
  studentId: '001', name: ' =SUM(1,2)', expected: 2, submitted: 1,
  graded: 1, points: 0, maximum: 10, grade: null,
};

test('score preview and CSV preserve stable IDs, zero scores, and blank grades', () => {
  const table = scoreExportTable(scope, [student]);
  assert.deepEqual(table[5], ['001', ' =SUM(1,2)', 2, 1, 1, 0, 10, null]);
  const serialized = gradebookCsvPreview(table);
  assert.deepEqual(parseCsv(serialized)[5], ['001', "' =SUM(1,2)", '2', '1', '1', '0', '10', '']);
  assert.throws(() => scoreExportTable(scope, [student, student]));
  assert.throws(() => scoreExportTable(scope, [{...student, studentId: ''}]));
});

test('Sheets mapping requires explicit unique columns and a stable ID column', () => {
  assert.deepEqual(previewSheetsMapping(' คะแนนตัวอย่าง ', {studentId: 'a', points: ' aa '}), {
    ok: true, sheet: 'คะแนนตัวอย่าง',
    mapping: [{key: 'studentId', column: 'A'}, {key: 'points', column: 'AA'}],
  });
  assert.deepEqual(previewSheetsMapping('Demo', {studentId: 'a', points: 'A'}), {ok: false, reason: 'duplicate'});
  assert.deepEqual(previewSheetsMapping('Demo', {studentId: 'A1', points: 'B'}), {ok: false, reason: 'column'});
  assert.deepEqual(previewSheetsMapping('Demo', {points: 'B'}), {ok: false, reason: 'id'});
  assert.deepEqual(previewSheetsMapping('Demo', {studentId: 'A'}), {ok: false, reason: 'fields'});
  assert.deepEqual(previewSheetsMapping('', {studentId: 'A', points: 'B'}), {ok: false, reason: 'sheet'});
});

test('score export rejects ambiguous IDs without silently rewriting them', () => {
  for (const studentId of [' 001', '001 ', '00\t1', '00\n1', '00\u007f1']) {
    assert.throws(() => scoreExportTable(scope, [{...student, studentId}]), /invalid student IDs/);
  }
  assert.throws(() => scoreExportTable(scope, [student, {...student, studentId: '001 '}]), /invalid student IDs/);
  assert.equal(scoreExportTable(scope, [student])[5][0], '001');
});


test('score export rejects non-finite counts and scores before preview or download', () => {
  for (const key of ['expected', 'submitted', 'graded', 'points', 'maximum']) {
    for (const value of [NaN, Infinity, -Infinity]) {
      assert.throws(() => scoreExportTable(scope, [{ ...student, [key]: value }]), /invalid numeric export values/);
    }
  }
  assert.equal(scoreExportTable(scope, [student])[5][5], 0);
});


test('export snapshot identity changes when the reviewed scope, roster, scores or order changes', () => {
 const original = scoreExportSnapshotKey(scope, [student]);
 assert.ok(original);
 assert.equal(scoreExportSnapshotKey({...scope}, [{...student}]), original);
 for (const changed of [{...scope, room: 'ROOM-OTHER'}, {...scope, subject: 'SUB-OTHER'}, {...scope, term: 'TERM-OTHER'}]) {
  assert.notEqual(scoreExportSnapshotKey(changed, [student]), original);
 }
 for (const changed of [{...student, points: 1}, {...student, name: 'Synthetic Other'}, {...student, grade: '4'}, {...student, studentId: '002'}]) {
  assert.notEqual(scoreExportSnapshotKey(scope, [changed]), original);
 }
 const other = {...student, studentId: '002'};
 assert.notEqual(scoreExportSnapshotKey(scope, [student, other]), scoreExportSnapshotKey(scope, [other, student]));
 assert.notEqual(scoreExportSnapshotKey(scope, []), original);
 assert.equal(scoreExportSnapshotKey(scope, [{...student, points: Infinity}]), null);
 assert.equal(scoreExportSnapshotKey(scope, [student, student]), null);
});

test('sheet sync preview preserves zero and decimal scores and never silently overwrites',()=>{
 const web=[{studentId:'01',name:'A',submitted:false,score:null},{studentId:'02',name:'B',submitted:true,score:0},{studentId:'03',name:'C',submitted:true,score:2},{studentId:'04',name:'D',submitted:true,score:1},{studentId:'05',name:'E',submitted:false,score:null}];
 const sheet=[{row:5,name:'A',value:2.5,formula:false},{row:6,name:'B',value:'',formula:false},{row:7,name:'C',value:1,formula:false},{row:8,name:'D',value:1,formula:false},{row:9,name:'E',value:0,formula:true}];
 const matches=web.map((w,i)=>({studentId:w.studentId,row:i+5,name:w.name}));
 const base={webMax:2.5,sheetMax:2.5,web,sheet,matches};
 const imports=planSheetGradeSync({...base,direction:'import'});
 const exports=planSheetGradeSync({...base,direction:'export'});
 assert.deepEqual(imports.map(x=>x.state),['reviewImport','skip','conflict','same','protected']);
 assert.equal(imports[0].proposed,2.5);
 assert.deepEqual(exports.map(x=>x.state),['skip','reviewExport','conflict','same','protected']);
 assert.equal(exports[1].proposed,0);
 assert.throws(()=>planSheetGradeSync({...base,direction:'import',sheetMax:5}));
 assert.throws(()=>planSheetGradeSync({...base,direction:'import',matches:matches.slice(1)}));
 assert.throws(()=>planSheetGradeSync({...base,direction:'import',sheet:[{...sheet[0],name:'Different'},...sheet.slice(1)]}));
});

test('four-row sheet headers preserve nested labels, fractions and exclude totals',()=>{
 const h=[['ที่','ชื่อ',null,'กลางภาค',null,null,null,'ปลายภาค'],[null,null,null,'บทที่ 6',null,null,'รวม','Test'],[null,null,null,'หนังสือ','ใบงาน','รวม',null,'ครั้งที่ 1'],[null,null,null,3,2,5,10,2.5]];
 assert.deepEqual(sheetScoreColumns(h,[6,7]).map(x=>[x.column,x.label,x.maxScore]),[[4,'กลางภาค · บทที่ 6 · หนังสือ',3],[5,'กลางภาค · บทที่ 6 · ใบงาน',2],[8,'ปลายภาค · Test · ครั้งที่ 1',2.5]]);
 const web=[{studentId:'001',name:'A B'},{studentId:'002',name:'C'}];
 assert.deepEqual(proposeSheetMatches(web,[{row:5,name:'C'},{row:6,name:'A  B'}]).map(x=>x.row),[6,5]);
 assert.throws(()=>proposeSheetMatches(web,[{row:5,name:'C'},{row:6,name:'C'}]));
 assert.throws(()=>proposeSheetMatches(web,[{row:5,name:'C'}]));
});

test('worksheet placement stays on page and preserves code aspect ratio',()=>{
 const b=codeBox(600,800,2,{x:.95,y:.95,width:.3});
 assert.equal(b.width,180);assert.equal(b.height,90);assert.equal(b.left,420);assert.equal(b.y,0);
 const tall=codeBox(600,200,.5,{x:-1,y:-1,width:1});
 assert.equal(tall.width,100);assert.equal(tall.height,200);assert.equal(tall.left,0);assert.equal(tall.y,0);
 assert.throws(()=>codeBox(600,800,0,{x:0,y:0,width:.2}));
});
