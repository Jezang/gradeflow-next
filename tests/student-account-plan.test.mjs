import test from 'node:test';
import assert from 'node:assert/strict';
import {planStudentAccount} from '../lib/student-account-plan.ts';
const base={uid:'u1',studentId:'s1',active:true,studentExists:true,authExists:true,binding:null,owner:null};
test('provision reciprocal identity and suspend without deleting',()=>{const p=planStudentAccount(base);assert.deepEqual(p,{binding:{uid:'u1',studentId:'s1',active:true},owner:{studentId:'s1',uid:'u1'}});const suspended=planStudentAccount({...base,...p,active:false});assert.equal(suspended.binding.active,false);assert.deepEqual(suspended.owner,p.owner);assert.deepEqual(planStudentAccount({...base,...suspended}),p)});
test('reject collisions, missing records and partial mappings',()=>{for(const patch of [{authExists:false},{studentExists:false},{uid:'a/b'},{active:false},{binding:{uid:'u1',studentId:'s2',active:true}},{owner:{studentId:'s1',uid:'u2'}},{binding:{uid:'u1',studentId:'s1',active:true}}])assert.throws(()=>planStudentAccount({...base,...patch}))});
