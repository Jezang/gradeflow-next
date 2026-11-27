import test from 'node:test';
import assert from 'node:assert/strict';
import {handleStudentAccount} from '../lib/student-account-request.ts';
import {manageStudentAccount} from '../lib/student-account-service.ts';
import {issueStudentCredential} from '../lib/student-credential-service.ts';

const input={action:'provision',studentId:'synthetic-s1'};

function fixture({enabled=true,allow=true}={}) {
  let owner=null;
  let failActivation=false;
  const events=[];
  const backend={
    enabled:async()=>enabled,
    authorizeAdmin:async token=>token==='token'&&allow?'example-admin':null,
    withOperation:async(sid,run)=>{events.push(['lock',sid]);return run()},
    readStudentNumber:async()=> '00123',
    readOwnerUid:async()=>owner,
    ensureDedicatedAccount:async(uid,alias)=>events.push(['ensure',uid,alias]),
    requireDedicatedAccount:async(uid,alias)=>events.push(['require',uid,alias]),
    installCredential:async({action},uid,alias,password,actor)=>{owner=uid;events.push([action,uid,alias,password,actor])},
    enableAccount:async(uid,recover)=>{
      events.push(['enable',uid,recover]);
      if (failActivation) {failActivation=false;throw Error('Synthetic activation failure')}
    },
  };
  return {backend,events,failNextActivation:()=>{failActivation=true}};
}

test('only a verified authorized request can issue a credential',async()=>{
  for (const settings of [{enabled:false},{allow:false}]) {
    const {backend,events}=fixture(settings);
    await assert.rejects(issueStudentCredential(backend,'token',input));
    assert.deepEqual(events,[]);
  }
  const {backend}=fixture();
  const result=await handleStudentAccount({},'Bearer token',{...input,password:'extra'},backend);
  assert.equal(result.status,400);
  assert.equal(result.body.password,undefined);
});

test('provision and recover use the private canonical alias and fresh generated credentials',async()=>{
  const {backend,events}=fixture();
  const first=await issueStudentCredential(backend,'token',input);
  assert.match(first.uid,/^student-[a-f\d]{64}$/);
  assert.match(first.password,/^[\w-]{32}$/);
  assert.deepEqual(events,[['lock',input.studentId],['ensure',first.uid,'student-00123@students.gradeflow.invalid'],
    ['provision',first.uid,'student-00123@students.gradeflow.invalid',first.password,'example-admin'],['enable',first.uid,false]]);
  await assert.rejects(issueStudentCredential(backend,'token',input));
  const recovery=await handleStudentAccount({},'Bearer token',{...input,action:'recover'},backend);
  assert.equal(recovery.status,200);
  assert.equal(recovery.body.uid,first.uid);
  assert.notEqual(recovery.body.password,first.password);
  assert.deepEqual(events.at(-1),['enable',first.uid,true]);
});

test('failed activation after binding can be recovered without creating a second identity',async()=>{
  const {backend,events,failNextActivation}=fixture();
  failNextActivation();
  await assert.rejects(issueStudentCredential(backend,'token',input));
  const issued=await issueStudentCredential(backend,'token',{...input,action:'recover'});
  assert.equal(events.filter(([event])=>event==='ensure').length,1);
  assert.notEqual(events.find(([event])=>event==='provision')[3],issued.password);
});

test('suspension and reactivation invalidate every earlier credential version',async()=>{
  const uid='synthetic-user';
  const owner={studentId:input.studentId,uid};
  let binding={...owner,active:true,credentialVersion:'a'.repeat(32)};
  const account={
    enabled:async()=>true,authorizeAdmin:async()=>'example-admin',authExists:async()=>true,
    transaction:async run=>run({readBinding:async()=>binding,readOwner:async()=>owner,studentExists:async()=>true,
      writePlan:plan=>{binding=plan.binding}}),
  };
  const initialVersion=binding.credentialVersion;
  const suspended=await manageStudentAccount(account,'token',{...owner,active:false});
  assert.equal(suspended.binding.active,false);
  assert.notEqual(suspended.binding.credentialVersion,initialVersion);
  const restored=await manageStudentAccount(account,'token',{...owner,active:true});
  assert.equal(restored.binding.active,true);
  assert.notEqual(restored.binding.credentialVersion,suspended.binding.credentialVersion);
});
