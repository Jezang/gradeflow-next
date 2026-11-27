import assert from 'node:assert/strict';
import {test} from 'node:test';
import {boundStudent,planEnrollment,studentProgress,studentWorkState} from '../lib/student-foundation.ts';
const row=(studentId,termId,roomId,no)=>({studentId,termId,roomId,no});
test('verified UID mapping fails closed on duplicate or inactive bindings',()=>{
 const a={uid:'uid-a',studentId:'student-a',active:true};
 assert.equal(boundStudent('uid-a',[a]),'student-a');
 assert.equal(boundStudent('student-a',[a]),null);
 assert.equal(boundStudent('uid-b',[a]),null);
 assert.equal(boundStudent('uid-a',[{...a,active:false}]),null);
 assert.equal(boundStudent('uid-a',[a,{...a,uid:'uid-b'}]),null);
 assert.equal(boundStudent('uid-a',[a,{...a,studentId:'student-b'}]),null);
});
test('insertion, room transfer and promotion preserve stable IDs and historical terms',()=>{
 const original=[row('a','old','r1',1),row('a','new','r1',1),row('b','new','r1',2),row('c','new','r2',1)];
 const snapshot=JSON.stringify(original);
 const moved=planEnrollment(original,row('a','new','r2',1));
 assert.deepEqual(moved,[row('a','old','r1',1),row('b','new','r1',1),row('c','new','r2',2),row('a','new','r2',1)]);
 const promoted=planEnrollment(moved,row('a','future','r3',1));
 assert.deepEqual(promoted.slice(0,-1),moved);
 assert.equal(JSON.stringify(original),snapshot);
 assert.throws(()=>planEnrollment(original,row('d','new','r1',4)));
 assert.throws(()=>planEnrollment([...original,row('d','new','r1',2)],row('e','new','r1',1)));
});
test('zero is a grade, pending is not, and deadline boundaries are explicit',()=>{
 const w={id:'w',course:'demo',title:'demo',maxScore:10,score:null,submitted:false,deadline:100,revisionDeadline:200};
 assert.equal(studentWorkState(w,100),'missing');
 assert.equal(studentWorkState(w,200),'revision');
 assert.equal(studentWorkState(w,201),'overdue');
 assert.equal(studentWorkState({...w,attendance:'leave'},201),'leave');
 assert.equal(studentWorkState({...w,submitted:true,score:0},201),'graded');
 assert.deepEqual(studentProgress([{...w,submitted:true,score:0},{...w,submitted:true},w]),{total:3,submitted:2,outstanding:1,points:0,possible:10});
});
