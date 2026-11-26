import {test} from 'node:test';
import assert from 'node:assert/strict';
import {gradebookCsvPreview} from '../lib/gradebook-csv-preview.ts';
import {previewSheetsMapping, scoreExportTable} from '../lib/score-export.ts';
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
