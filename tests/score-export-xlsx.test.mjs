import assert from 'node:assert/strict';
import {test} from 'node:test';
import ExcelJS from 'exceljs';
import {scoreExportTable} from '../lib/score-export.ts';
import {scoreExportXlsx} from '../lib/score-export-xlsx.ts';

test('XLSX retains stable text IDs, formula-like text, zero scores, and blank grades', async () => {
  const student = {
    studentId: '001', name: '=1+1', points: 0, maximum: 10,
    expected: 1, submitted: 1, graded: 1, grade: null,
  };
  const scope = {term: 'SYNTHETIC-TERM', subject: 'SUB-DEMO', room: 'ROOM-DEMO'};
  const bytes = await scoreExportXlsx(scoreExportTable(scope, [student]));
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes);
  const sheet = workbook.getWorksheet('Scores');
  assert.equal(sheet.getCell('A6').value, '001');
  assert.equal(sheet.getCell('B6').type, ExcelJS.ValueType.String);
  assert.equal(sheet.getCell('B6').value, '=1+1');
  assert.equal(sheet.getCell('F6').value, 0);
  assert.equal(sheet.getCell('H6').value, null);
});
