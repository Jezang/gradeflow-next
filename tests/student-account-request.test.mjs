import test from 'node:test';
import assert from 'node:assert/strict';
import {handleStudentAccount} from '../lib/student-account-request.ts';
const body={uid:'u1',studentId:'s1',active:false};
function backend(allowed=true){return {enabled:async()=>true,authorizeAdmin:async token=>allowed&&token==='synthetic'?'admin1':null,authExists:async()=>true,transaction:async run=>run({readBinding:async()=>({...body,active:true}),readOwner:async()=>({uid:'u1',studentId:'s1'}),studentExists:async()=>true,writePlan:(plan,actor)=>{assert.equal(actor,'admin1');assert.equal(plan.binding.active,false)}})}}
test('missing token rejected',async()=>assert.equal((await handleStudentAccount(backend(),null,body)).status,401));
test('invalid body rejected',async()=>assert.equal((await handleStudentAccount(backend(),'Bearer synthetic',{...body,active:'false'})).status,400));
test('non-admin rejected',async()=>assert.equal((await handleStudentAccount(backend(false),'Bearer synthetic',body)).status,403));
test('authorized suspension accepted',async()=>assert.deepEqual(await handleStudentAccount(backend(),'Bearer synthetic',body),{status:200,body:{ok:true}}));
