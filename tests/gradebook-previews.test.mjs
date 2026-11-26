import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeWeightedGrades, weightedGradePreview } from '../lib/weighted-grade-preview.ts';
import { previewBulkRoster } from '../lib/bulk-roster-preview.ts';
import { matchesScoreFilter, parseQuickScore } from '../lib/quick-score.ts';

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

test('weighted previews reject malformed maximum scores even in zero-weight categories', () => {
 const categories = [{ weight: 0, workIds: ['homework'] }, { weight: 100, workIds: ['exam'] }];
 for (const maxScore of [-1, NaN, Infinity]) {
  assert.equal(summarizeWeightedGrades(students, [{ ...works[0], maxScore }, works[1]], categories), null);
 }
 assert.equal(weightedGradePreview([{ weight: 100, earned: Number.MAX_VALUE, possible: Number.MAX_VALUE, complete: true }]), 100);
});


test('bulk preview fails closed for ambiguous master or roster IDs without hiding valid peers', () => {
 const master = students.map(row => ({ ...row, active: true }));
 const duplicateMaster = [...master, { id: 'TEST001', name: 'Conflicting synthetic record', active: false }];
 assert.deepEqual(previewBulkRoster('TEST001 TEST002', duplicateMaster, []), [
  { id: 'TEST001', status: 'unavailable' },
  { id: 'TEST002', name: 'Synthetic Two', status: 'new' },
 ]);
 assert.deepEqual(previewBulkRoster('TEST001 TEST002', master, [
  { id: 'TEST001', active: true }, { id: 'TEST001', active: false },
 ]), [
  { id: 'TEST001', status: 'unavailable' },
  { id: 'TEST002', name: 'Synthetic Two', status: 'new' },
 ]);
});


test('quick score preserves zero and blank and rejects invalid maximums or score drafts', () => {
 assert.deepEqual(parseQuickScore('0', 10), {ok: true, value: 0});
 assert.deepEqual(parseQuickScore('  ', 10), {ok: true, value: null});
 assert.deepEqual(parseQuickScore('7.5', 10), {ok: true, value: 7.5});
 assert.deepEqual(parseQuickScore('10', 10), {ok: true, value: 10});
 for (const raw of ['-1', '10.1', 'Infinity', 'NaN', '0xA', '1e999', '1,5']) {
  assert.deepEqual(parseQuickScore(raw, 10), {ok: false});
 }
 for (const max of [0, -1, NaN, Infinity]) assert.deepEqual(parseQuickScore('', max), {ok: false});
});


test('score table filters distinguish zero, pending and absent scores and search by student', () => {
 const student = {id: 'TEST001', name: 'นักเรียน ตัวอย่าง'};
 const zero = {submitted: true, score: 0};
 const pending = {submitted: true, score: null};
 assert.equal(matchesScoreFilter(student, zero, 'test001', 'graded'), true);
 assert.equal(matchesScoreFilter(student, zero, '', 'ungraded'), false);
 assert.equal(matchesScoreFilter(student, pending, 'ตัวอย่าง', 'ungraded'), true);
 assert.equal(matchesScoreFilter(student, undefined, '', 'unsubmitted'), true);
 assert.equal(matchesScoreFilter(student, {submitted: false, score: 0}, '', 'graded'), false);
 assert.equal(matchesScoreFilter(student, {submitted: true, score: NaN}, '', 'ungraded'), true);
 assert.equal(matchesScoreFilter(student, pending, 'missing', 'all'), false);
});
