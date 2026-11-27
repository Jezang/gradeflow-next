import test from 'node:test';
import assert from 'node:assert/strict';
import {readTeacherSource} from '../lib/student-source-reader.ts';
const docs={'terms/t1':{name:'Demo'},'teachingAssignments/c1/roster/s1':{studentId:'s1',active:true},'teachingAssignments/c1/work/w1/submissions/s1':{studentId:'s1',submitted:true,score:0}};
const reader={get:async p=>docs[p]??null,listTermCourses:async()=>({complete:true,docs:[{id:'c1',data:{termId:'t1',subjectId:'math'}}]}),listWorks:async()=>({complete:true,docs:[{id:'w1',data:{active:true,title:'Demo work',maxScore:10}}]}),membershipWindows:async()=>undefined,attendance:async()=>undefined};
test('complete source retains zero score and term label',async()=>{const result=await readTeacherSource(reader,'s1','t1');assert.equal(result.complete,true);assert.equal(result.label,'Demo');assert.equal(result.rows.length,1);assert.equal(result.rows[0].score,0)});
test('incomplete course or work list rejects publication',async()=>{await assert.rejects(readTeacherSource({...reader,listTermCourses:async()=>({complete:false,docs:[]})},'s1','t1'),/Incomplete courses/);await assert.rejects(readTeacherSource({...reader,listWorks:async()=>({complete:false,docs:[]})},'s1','t1'),/Incomplete work list/)});
test('student outside roster receives no work',async()=>{const result=await readTeacherSource(reader,'s2','t1');assert.deepEqual(result.rows,[])});
