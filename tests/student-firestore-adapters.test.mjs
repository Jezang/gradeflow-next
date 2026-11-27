import test from 'node:test';
import assert from 'node:assert/strict';
import {accountFirestoreBackend} from '../lib/student-account-firestore-adapter.ts';
import {projectionFirestoreBackend} from '../lib/student-projection-firestore-adapter.ts';
import {manageStudentAccount} from '../lib/student-account-service.ts';
import {publishStudentProjection} from '../lib/student-projection-service.ts';
const identity={verifyIdToken:async()=>({uid:'admin-demo',admin:true})};
function store(seed){
 const data=new Map(Object.entries(seed));
 return {data,doc:p=>p,collection:p=>p,runTransaction:async run=>{
 const staged=new Map(data);
 const result=await run({get:async p=>({exists:data.has(p),data:()=>data.get(p)}),list:async p=>({docs:[...data.keys()].filter(k=>k.startsWith(p+'/')&&!k.slice(p.length+1).includes('/')).map(k=>({id:k.slice(p.length+1)}))}),set:(p,v)=>staged.set(p,v),delete:p=>staged.delete(p)});
 data.clear();for(const [k,v] of staged)data.set(k,v);return result;
 }};
}
test('account adapter writes reciprocal mapping and audit together',async()=>{
 const db=store({'students/s1':{}});
 await manageStudentAccount(accountFirestoreBackend(db,identity,async()=>true,async()=>true),'demo',{uid:'u1',studentId:'s1',active:true});
 assert.equal(db.data.get('studentPortalBindings/u1').studentId,'s1');
 assert.equal(db.data.get('studentPortalOwners/s1').uid,'u1');
 assert.equal(db.data.get('studentPortalAccountAudit/u1').actorUid,'admin-demo');
});
test('projection adapter removes stale work and preserves source',async()=>{
 const path='studentPortalViews/u1/terms/t1';
 const db=store({'studentPortalBindings/u1':{uid:'u1',studentId:'s1',active:true},'studentPortalOwners/s1':{uid:'u1',studentId:'s1'},[path+'/works/old']:{score:5},'source/old':{score:5}});
 const backend=projectionFirestoreBackend(db,identity,async()=>true,async()=>({label:'Demo term',rows:[]}));
 await publishStudentProjection(backend,'demo','s1','t1');
 assert.equal(db.data.has(path+'/works/old'),false);
 assert.equal(db.data.get(path).label,'Demo term');
 assert.equal(db.data.get('source/old').score,5);
});
