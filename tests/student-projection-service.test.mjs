import test from 'node:test';
import assert from 'node:assert/strict';
import {publishStudentProjection} from '../lib/student-projection-service.ts';
function fixture({enabled=true,authorized=true,active=true,studentId='s1'}={}){
 const writes=[];
 const backend={enabled:async()=>enabled,authorizePublisher:async()=>authorized,transaction:async run=>run({readOwner:async()=>({studentId:'s1',uid:'u1'}),readBinding:async()=>({uid:'u1',studentId,active}),readSource:async()=>[],replaceWorks:(uid,term,works)=>writes.push({uid,term,works})})};
 return {backend,writes};
}
test('disabled, unauthorized, inactive and mismatched binding never publish',async()=>{for(const options of [{enabled:false},{authorized:false},{active:false},{studentId:'s2'}]){const {backend,writes}=fixture(options);await assert.rejects(publishStudentProjection(backend,'token','s1','t1'));assert.equal(writes.length,0)}});
test('empty authoritative source requests replacement to remove stale work',async()=>{const {backend,writes}=fixture();assert.equal(await publishStudentProjection(backend,'token','s1','t1'),0);assert.deepEqual(writes,[{uid:'u1',term:'t1',works:[]}])});
