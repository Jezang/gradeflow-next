import {test} from 'node:test';
import assert from 'node:assert/strict';
import {attendanceFor,bangkokInput,validateDeadlines,deadlineState,parseBangkokDate,resolveCheckingCourse} from '../lib/work-tracking.ts';
test('Bangkok date parsing, validation and round trip',()=>{const due=parseBangkokDate('2026-11-26T21:00');assert.equal(due,Date.parse('2026-11-26T14:00:00Z'));assert.equal(bangkokInput(due),'2026-11-26T21:00');assert.throws(()=>parseBangkokDate('2026-02-30T12:00'));assert.throws(()=>validateDeadlines('','2026-11-26T21:00'));assert.throws(()=>validateDeadlines('2026-11-26T21:00','2026-11-25T21:00'));});
test('deadline windows and attendance precedence',()=>{assert.equal(deadlineState(false,100,200,150),'revision');assert.equal(deadlineState(false,100,200,201),'overdue');assert.equal(deadlineState(false,100,null,100),'open');assert.equal(deadlineState(true,100,null,200),'submitted');assert.equal(attendanceFor(false,'missing','leave'),undefined);assert.equal(attendanceFor(false,'absent','leave'),'absent');assert.equal(attendanceFor(true,'absent',null),undefined);assert.equal(attendanceFor(false,undefined,'leave'),'leave')});

test('separate subject and room selection never silently chooses an ambiguous course',()=>{
 const row=(id,subjectId,roomId,active=true)=>({id,data:{subjectId,roomId,active}});
 const rows=[row('a','ENG','R2'),row('b','ENG','R5'),row('c','MATH','R2'),row('old','ENG','R2',false)];
 assert.equal(resolveCheckingCourse(rows,'ENG','R2'),'a');
 assert.equal(resolveCheckingCourse(rows,'ENG','R5'),'b');
 assert.equal(resolveCheckingCourse(rows,'MATH','R5'),'');
 assert.equal(resolveCheckingCourse(rows,'ENG',''),'');
 assert.equal(resolveCheckingCourse([...rows,row('other-term','ENG','R2')],'ENG','R2'),'');
});
