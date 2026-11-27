import test from 'node:test';
import assert from 'node:assert/strict';
import {handleStudentPublish} from '../lib/student-publish-request.ts';
function backend(allowed=true){return {enabled:async()=>true,authorizePublisher:async token=>allowed&&token==='synthetic',transaction:async run=>run({readOwner:async()=>({studentId:'s1',uid:'u1'}),readBinding:async()=>({studentId:'s1',uid:'u1',active:true}),readSource:async()=>[],replaceWorks:(uid,term,works)=>{assert.equal(uid,'u1');assert.equal(term,'t1');assert.deepEqual(works,[])}})}}
const body={studentId:'s1',termId:'t1'};
test('missing bearer is rejected',async()=>assert.equal((await handleStudentPublish(backend(),null,body)).status,401));
test('invalid or extra fields rejected',async()=>{for(const value of [null,[],{...body,score:10},{...body,studentId:'../s1'}])assert.equal((await handleStudentPublish(backend(),'Bearer synthetic',value)).status,400)});
test('unauthorized publisher rejected',async()=>assert.equal((await handleStudentPublish(backend(false),'Bearer synthetic',body)).status,403));
test('authorized publication returns count',async()=>assert.deepEqual(await handleStudentPublish(backend(),'Bearer synthetic',body),{status:200,body:{published:0}}));
