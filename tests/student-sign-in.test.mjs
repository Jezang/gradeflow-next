import test from 'node:test';
import assert from 'node:assert/strict';
import {hashStudentPassword,studentAliasKey} from '../lib/student-password.ts';
import {studentSignInBackend} from '../lib/student-sign-in-server.ts';
import {handleStudentSignIn,studentSignInAttemptsPerAccount,studentSignInAttemptsPerShard,studentSignInShardCount,studentSignInWindowMs} from '../lib/student-sign-in.ts';

const keyFor=number=>studentAliasKey('student-'+number+'@students.gradeflow.invalid');
const shardFor=key=>Number.parseInt(key.slice(0,2),16)%studentSignInShardCount;
const password='Synthetic-good-password';

function memoryDatabase(seed) {
  const docs=new Map(Object.entries(seed));
  let pending=Promise.resolve();
  const get=key=>({data:()=>docs.get(key)});
  return {docs,doc:key=>({key,get:async()=>get(key)}),
    runTransaction:run=>{
      const result=pending.then(async()=>{
        const writes=[];
        const output=await run({get:async ref=>get(ref.key),set:(ref,value)=>writes.push(()=>docs.set(ref.key,value)),
          update:(ref,value)=>writes.push(()=>docs.set(ref.key,{...docs.get(ref.key),...value}))});
        for (const write of writes) write();
        return output;
      });
      pending=result.catch(()=>{});
      return result;
    },
  };
}

async function setup() {
  const hash=await hashStudentPassword(password);
  const seeds={'portalConfig/student':{enabled:true}};
  for (const [index,number] of ['00123','00456'].entries()) {
    const uid='uid-'+index;
    const studentId='sid-'+index;
    seeds['students/'+studentId]={active:true,code:number};
    seeds['studentPortalOwners/'+studentId]={uid,studentId};
    seeds['studentPortalBindings/'+uid]={uid,studentId,active:true,credentialVersion:String(index).repeat(32)};
    seeds['studentPortalLoginVerifiers/'+keyFor(number)]={...hash,uid,studentId};
  }
  const db=memoryDatabase(seeds);
  const tokens=[];
  const backend=studentSignInBackend({createCustomToken:async(uid,claims)=>{
    tokens.push({uid,claims});
    return 'test-token';
  }},db);
  return {db,backend,tokens};
}

test('wrong credential, unknown account, and disabled portal produce no custom token',async()=>{
  const {backend,tokens,db}=await setup();
  assert.equal((await handleStudentSignIn(backend,{studentNumber:'00123',password:'wrong-pass-123'})).status,401);
  assert.equal((await handleStudentSignIn(backend,{studentNumber:'99998',password})).status,401);
  assert.equal(db.docs.has('studentPortalLoginVerifiers/'+keyFor('99998')),false);
  db.docs.set('portalConfig/student',{enabled:false});
  assert.equal((await handleStudentSignIn(backend,{studentNumber:'00123',password})).status,503);
  assert.deepEqual(tokens,[]);
});

test('sign-in uses a versioned custom claim and resets successful account attempts',async()=>{
  const {backend,tokens,db}=await setup();
  const account='studentPortalLoginVerifiers/'+keyFor('00123');
  await handleStudentSignIn(backend,{studentNumber:'00123',password:'wrong-pass-123'});
  assert.equal(db.docs.get(account).rate.attempts,1);
  assert.deepEqual(await handleStudentSignIn(backend,{studentNumber:'00123',password}),{status:200,body:{token:'test-token'}});
  assert.deepEqual(tokens,[{uid:'uid-0',claims:{gradeflowStudentSession:'0'.repeat(32)}}]);
  assert.equal(db.docs.get(account).rate,null);
  assert.equal(db.docs.get('studentPortalSignInLimits/'+shardFor(keyFor('00123'))).attempts,2);
});

test('concurrent attempts share the account cap and preserve independent accounts',async()=>{
  const {backend,db}=await setup();
  const key=keyFor('00123');
  const results=await Promise.all(Array.from({length:studentSignInAttemptsPerAccount+3},()=>backend.takeAttempt(key)));
  assert.equal(results.filter(result=>result==='limited').length,3);
  assert.equal((await handleStudentSignIn(backend,{studentNumber:'00123',password})).status,401);
  assert.equal((await handleStudentSignIn(backend,{studentNumber:'00456',password})).status,200);
  const account=db.docs.get('studentPortalLoginVerifiers/'+key);
  account.rate.bucket--;
  assert.equal((await handleStudentSignIn(backend,{studentNumber:'00123',password})).status,200);
});

test('unknown numbers cannot exceed their shard cap or create verifier records',async()=>{
  const {backend,db}=await setup();
  const key=keyFor('99998');
  db.docs.set('studentPortalSignInLimits/'+shardFor(key),{bucket:Math.floor(Date.now()/studentSignInWindowMs),attempts:studentSignInAttemptsPerShard-1});
  assert.equal(await backend.takeAttempt(key),null);
  assert.equal(await backend.takeAttempt(key),'limited');
  assert.equal(db.docs.has('studentPortalLoginVerifiers/'+key),false);
});

test('credential rotation blocks stale sign-in proof before token creation',async()=>{
  const {backend,db,tokens}=await setup();
  const stale={...backend,takeAttempt:async key=>{
    const verifier=await backend.takeAttempt(key);
    const binding=db.docs.get('studentPortalBindings/uid-0');
    db.docs.set('studentPortalBindings/uid-0',{...binding,credentialVersion:'f'.repeat(32)});
    return verifier;
  }};
  await assert.rejects(handleStudentSignIn(stale,{studentNumber:'00123',password}),/credential changed/);
  assert.deepEqual(tokens,[]);
});
