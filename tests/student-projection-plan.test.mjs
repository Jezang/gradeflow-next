import test from 'node:test';
import assert from 'node:assert/strict';
import {planStudentProjection} from '../lib/student-projection-plan.ts';
const row={id:'w1',studentId:'s1',termId:'t1',active:true,course:'Demo',title:'Demo work',maxScore:10,score:0,submitted:true,deadline:null,revisionDeadline:null,privateNote:'not public'};
test('only own active term work and allowlisted fields',()=>{const result=planStudentProjection('s1','t1',[row,{...row,studentId:'s2'},{...row,termId:'t2'},{...row,active:false}]);assert.equal(result.length,1);assert.equal(result[0].score,0);assert.equal('privateNote' in result[0],false);assert.equal('studentId' in result[0],false)});
test('duplicate ids and invalid scores fail closed',()=>{assert.throws(()=>planStudentProjection('s1','t1',[row,row]));assert.throws(()=>planStudentProjection('s1','t1',[{...row,score:11}]))});
