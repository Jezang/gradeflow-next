import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeWeightedGrades } from '../lib/weighted-grade-preview.ts';
import { previewBulkRoster } from '../lib/bulk-roster-preview.ts';

const students = [{ id: 'TEST001', name: 'Synthetic One' }, { id: 'TEST002', name: 'Synthetic Two' }];
const works = [
 { id: 'homework', title: 'Homework', maxScore: 20, scores: new Map([['TEST001', 0]]) },
 { id: 'exam', title: 'Exam', maxScore: 50, scores: new Map([['TEST001', 45], ['TEST002', 45]]) },
];

test('weighted grades preserve a real zero and defer grades when scores are missing', () => {
 const rows = summarizeWeightedGrades(students, works, [
  { weight: 40, workIds: ['homework'] }, { weight: 60, workIds: ['exam'] },
 ]);
 assert.deepEqual(rows.map(row => row.percent), [54, null]);
 assert.deepEqual(rows.map(row => row.scores[0].graded), [1, 0]);
});

test('weighted grades reject invalid weights and overlapping or omitted work', () => {
 assert.equal(summarizeWeightedGrades(students, works, [{ weight: 90, workIds: ['homework', 'exam'] }]), null);
 assert.equal(summarizeWeightedGrades(students, works, [{ weight: 100, workIds: ['exam', 'exam'] }]), null);
 assert.equal(summarizeWeightedGrades(students, works, [
  { weight: 90, workIds: ['homework', 'exam'] }, { weight: 10, workIds: [] },
 ]), null);
 const rows = summarizeWeightedGrades(students, works, [
  { weight: 0, workIds: ['homework'] }, { weight: 100, workIds: ['exam'] },
 ]);
 assert.deepEqual(rows.map(row => row.percent), [90, 90]);
});

test('bulk preview considers only explicit unique IDs and reflects active server records', () => {
 const master = [...students.map(row => ({ ...row, active: true })),
  { id: 'TEST003', name: 'Synthetic Three', active: false },
  { id: 'TEST004', name: 'Synthetic Four', active: true },
  { id: 'TEST005', name: 'Synthetic Five', active: true }];
 const roster = [{ id: 'TEST002', active: true }, { id: 'TEST004', active: false }];
 const result = previewBulkRoster('TEST001, TEST002\nTEST001 TEST003\nTEST004 TEST999 bad/id', master, roster);
 assert.deepEqual(result.map(({ id, status }) => [id, status]), [
  ['TEST001', 'new'], ['TEST002', 'enrolled'], ['TEST003', 'unavailable'],
  ['TEST004', 'reactivate'], ['TEST999', 'unavailable'], ['bad/id', 'invalid'],
 ]);
 assert.equal(previewBulkRoster(Array.from({ length: 501 }, (_, index) => 'T' + index).join(','), master, roster), null);
});
