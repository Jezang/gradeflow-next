import test from 'node:test';
import assert from 'node:assert/strict';
import {manageStudentAccount} from '../lib/student-account-service.ts';
const input={uid:'u1',studentId:'s1',active:true};
function fixture({enabled=true,admin=true,exists=true}={}){
 const writes=[];
 const backend={enabled:async()=>enabled,authorizeAdmin:async()=>admin?'admin1':null,authExists:async()=>exists,transaction:async run=>run({readBinding:async()=>null,readOwner:async()=>null,studentExists:async()=>true,writePlan:(plan,actor)=>writes.push({plan,actor})})};
 return {backend,writes};
}
test('disabled, unauthorized and unknown accounts never write',async()=>{for(const options of [{enabled:false},{admin:false},{exists:false}]){const {backend,writes}=fixture(options);await assert.rejects(manageStudentAccount(backend,'token',input));assert.equal(writes.length,0)}});
test('authorized request passes reciprocal mapping and audit actor to transaction',async()=>{const {backend,writes}=fixture();const plan=await manageStudentAccount(backend,'token',input);assert.deepEqual(writes,[{plan,actor:'admin1'}]);assert.equal(plan.owner.uid,input.uid)});
