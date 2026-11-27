import test from 'node:test';
import assert from 'node:assert/strict';
import {planEnrollmentHistory} from '../lib/student-enrollment-history.ts';
const rows=[{studentId:'s1',termId:'t1',roomId:'a',no:1},{studentId:'s2',termId:'t1',roomId:'a',no:2}];
test('transfer records both moved and renumbered students',()=>{const p=planEnrollmentHistory(rows,{...rows[0],roomId:'b'},'admin',1);assert.equal(p.events.length,2);assert.equal(p.events.find(e=>e.studentId==='s1').before.roomId,'a');assert.equal(p.enrollments.find(e=>e.studentId==='s2').no,1);assert.equal(rows[1].no,2)});
test('promotion preserves previous term',()=>{const p=planEnrollmentHistory(rows,{...rows[0],termId:'t2'},'admin',2);assert.equal(p.enrollments.length,3);assert.equal(p.events.length,1);assert.equal(p.events[0].before,null);assert.deepEqual(p.enrollments.filter(e=>e.termId==='t1'),rows)});
