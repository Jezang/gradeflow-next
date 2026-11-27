import test from 'node:test';
import assert from 'node:assert/strict';
import {accountFirestoreBackend} from '../lib/student-account-firestore-adapter.ts';
import {projectionFirestoreBackend} from '../lib/student-projection-firestore-adapter.ts';
import {manageStudentAccount} from '../lib/student-account-service.ts';
import {publishStudentProjection,withdrawStudentProjection} from '../lib/student-projection-service.ts';
import {readStudentProjectionSource} from '../lib/student-projection-source.ts';
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
 const backend=projectionFirestoreBackend(db,identity,async()=>true,async()=>({label:'Demo term',rows:[],complete:true}));
 await publishStudentProjection(backend,'demo','s1','t1');
 assert.equal(db.data.has(path+'/works/old'),false);
 assert.equal(db.data.get(path).label,'Demo term');
 assert.equal(db.data.get('source/old').score,5);
});

test('incomplete source leaves existing projection untouched',async()=>{const path='studentPortalViews/u1/terms/t1/works/old';const db=store({'studentPortalBindings/u1':{uid:'u1',studentId:'s1',active:true},'studentPortalOwners/s1':{uid:'u1',studentId:'s1'},[path]:{score:5}});const backend=projectionFirestoreBackend(db,identity,async()=>true,async()=>({label:'Demo',rows:[],complete:false}));await assert.rejects(publishStudentProjection(backend,'demo','s1','t1'),/Incomplete source/);assert.equal(db.data.get(path).score,5)});

test('withdrawing atomically removes the term and works and can be retried for a suspended student',async()=>{
 const term='studentPortalViews/u1/terms/t1';
 const other='studentPortalViews/u2/terms/t1';
 const db=store({
  'studentPortalBindings/u1':{uid:'u1',studentId:'s1',active:false},
  'studentPortalOwners/s1':{uid:'u1',studentId:'s1'},
  [term]:{label:'Demo term'},[term+'/works/w1']:{score:5},[other]:{label:'Other term'},
  [other+'/works/w1']:{score:9},'teachingAssignments/demo/work/w1':{maxScore:10}
 });
 const backend=projectionFirestoreBackend(db,identity,async()=>true,async()=>assert.fail('Never read source'));
 await withdrawStudentProjection(backend,'demo','s1','t1');
 await withdrawStudentProjection(backend,'demo','s1','t1');
 assert.equal(db.data.has(term),false);
 assert.equal(db.data.has(term+'/works/w1'),false);
 assert.equal(db.data.get(other+'/works/w1').score,9);
 assert.equal(db.data.get('teachingAssignments/demo/work/w1').maxScore,10);
});

test('transaction source projects an own attendance mark and filters work outside saved enrollment windows',async()=>{
 const root='teachingAssignments/course1';
 const date=millis=>({toMillis:()=>millis});
 const docs=new Map(Object.entries({
  'terms/t1':{name:'Synthetic term'},
  'studentPortalMemberships/s1/terms/t1/courses/course1':{windows:[{from:10,until:20}]},
  [root]:{termId:'t1',subjectId:'Math'},
  [root+'/roster/s1']:{studentId:'s1',active:false},
  [root+'/work/early']:{title:'Before enrollment',maxScore:10,active:true,createdAt:date(9)},
  [root+'/work/own']:{title:'Within enrollment',maxScore:10,active:true,createdAt:date(10)},
  [root+'/work/own/attendance/s1']:{studentId:'s1',status:'leave'},
  [root+'/work/own/submissions/s2']:{studentId:'s2',submitted:true,score:10},
  [root+'/work/late']:{title:'After enrollment',maxScore:10,active:true,createdAt:date(20)}
 }));
 const tx={
  getDocument:async path=>{
   assert.ok(!path.endsWith('/s2'));
   return docs.get(path)??null;
  },
  queryDocuments:async(path,filter,limit)=>{
   assert.equal(limit,501);
   return [...docs].flatMap(([key,data])=>{
    const id=key.slice(path.length+1);
    return key.startsWith(path+'/')&&!id.includes('/')&&(!filter||data[filter.field]===filter.value)?[{id,data}]:[];
   });
  }
 };
 const source=await readStudentProjectionSource(tx,'s1','t1');
 assert.equal(source.label,'Synthetic term');
 assert.deepEqual(source.rows.map(({title,attendance,score})=>({title,attendance,score})),[
  {title:'Within enrollment',attendance:'leave',score:null}
 ]);
});
