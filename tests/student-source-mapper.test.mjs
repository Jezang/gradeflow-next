import test from 'node:test';
import assert from 'node:assert/strict';
import {mapTeacherWork} from '../lib/student-source-mapper.ts';
const input={courseId:'c1',workId:'w1',studentId:'s1',termId:'t1',course:{termId:'t1',subjectId:'math'},roster:{studentId:'s1',active:true},work:{active:true,title:'Demo',maxScore:10,deadline:{toMillis:()=>123}},submission:{studentId:'s1',submitted:true,score:0,privateNote:'hidden'}};
test('preserve zero and timestamp without leaking private fields',()=>{const row=mapTeacherWork(input);assert.equal(row.score,0);assert.equal(row.deadline,123);assert.equal('privateNote' in row,false);assert.notEqual(row.id,mapTeacherWork({...input,courseId:'c2'}).id)});
test('exclude inactive roster, archived work and other terms',()=>{assert.equal(mapTeacherWork({...input,roster:null}),null);assert.equal(mapTeacherWork({...input,work:{...input.work,active:false}}),null);assert.equal(mapTeacherWork({...input,termId:'t2'}),null)});
test('reject mismatched student and represent missing submission',()=>{assert.throws(()=>mapTeacherWork({...input,submission:{...input.submission,studentId:'s2'}}));const row=mapTeacherWork({...input,submission:null});assert.equal(row.score,null);assert.equal(row.submitted,false)});

test('attendance applies only to outstanding work',()=>{assert.equal(mapTeacherWork({...input,submission:null,attendance:'leave'}).attendance,'leave');assert.equal(mapTeacherWork({...input,submission:null,attendance:'absent'}).attendance,'absent');assert.equal(mapTeacherWork({...input,attendance:'absent'}).attendance,undefined)});

test('historical membership preserves old work but excludes later assignments',()=>{const membershipWindows=[{studentId:'s1',termId:'t1',courseId:'c1',from:10,until:20}];const historical={...input,roster:null,membershipWindows,work:{...input.work,createdAt:{toMillis:()=>15}}};assert.equal(mapTeacherWork(historical).score,0);assert.equal(mapTeacherWork({...historical,work:{...historical.work,createdAt:{toMillis:()=>20}}}),null);assert.equal(mapTeacherWork({...historical,membershipWindows:[]}),null)});
