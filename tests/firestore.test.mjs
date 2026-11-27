import {before,after,test} from 'node:test';
import {readFileSync} from 'node:fs';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {doc,getDoc,setDoc,writeBatch,serverTimestamp,collection,getDocs,updateDoc,query,where,Timestamp} from 'firebase/firestore';
let env;
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-gradeflow',firestore:{rules:readFileSync('firestore.rules','utf8')}});await env.clearFirestore();await env.withSecurityRulesDisabled(async c=>{for(const [id,role] of [['owner','super_admin'],['admin','admin'],['teacher','teacher']])await setDoc(doc(c.firestore(),'profiles',id),{role,active:true});});});
after(async()=>{await env?.cleanup()});
const db=(uid,verified=true)=>env.authenticatedContext(uid,{email:uid+'@example.com',email_verified:verified}).firestore();
const request=()=>({name:'Test Teacher',email:'candidate@example.com',status:'pending',createdAt:serverTimestamp()});
test('anonymous and teacher cannot read student data; admin can add valid record',async()=>{await assertFails(getDocs(collection(env.unauthenticatedContext().firestore(),'students')));await assertFails(getDocs(collection(db('teacher'),'students')));await assertSucceeds(setDoc(doc(db('admin'),'students','S1'),{code:'S1',name:'Example only',active:true,createdAt:serverTimestamp()}));await assertFails(setDoc(doc(db('admin'),'students','S2'),{code:'wrong',name:'Example',active:true,createdAt:serverTimestamp()}));});
test('verified registration, no privilege escalation, atomic owner approval',async()=>{await assertFails(setDoc(doc(db('candidate',false),'teacherRequests','candidate'),request()));await assertSucceeds(setDoc(doc(db('candidate'),'teacherRequests','candidate'),request()));await assertFails(setDoc(doc(db('candidate'),'profiles','candidate'),{role:'super_admin',active:true}));await assertFails(updateDoc(doc(db('admin'),'teacherRequests','candidate'),{status:'approved',reviewedAt:serverTimestamp()}));await assertFails(updateDoc(doc(db('owner'),'teacherRequests','candidate'),{status:'approved',reviewedAt:serverTimestamp()}));const owner=db('owner');const batch=writeBatch(owner);batch.set(doc(owner,'profiles','candidate'),{role:'teacher',active:true,name:'Test Teacher',email:'candidate@example.com'});batch.update(doc(owner,'teacherRequests','candidate'),{status:'approved',reviewedAt:serverTimestamp()});await assertSucceeds(batch.commit());await assertSucceeds(getDoc(doc(db('candidate'),'profiles','candidate')));await assertFails(getDoc(doc(db('candidate'),'students','S1')));await assertFails(updateDoc(doc(db('candidate'),'profiles','candidate'),{role:'admin'}));});

test('owner can suspend teacher but cannot change role; teaching reads scoped',async()=>{const owner=db('owner'),admin=db('admin'),teacher=db('teacher');for(const [kind,id] of [['rooms','R1'],['subjects','ENG'],['terms','T1']])await assertSucceeds(setDoc(doc(admin,kind,id),{code:id,name:id,active:true,createdAt:serverTimestamp()}));const ref=doc(admin,'teachingAssignments','teacher__R1__ENG__T1');await assertSucceeds(setDoc(ref,{teacherUid:'teacher',roomId:'R1',subjectId:'ENG',termId:'T1',active:true,createdAt:serverTimestamp()}));await assertSucceeds(getDoc(doc(teacher,'teachingAssignments',ref.id)));await assertFails(getDoc(doc(db('candidate'),'teachingAssignments',ref.id)));await assertFails(updateDoc(doc(admin,'profiles','teacher'),{active:false}));await assertFails(updateDoc(doc(owner,'profiles','teacher'),{role:'admin'}));await assertSucceeds(updateDoc(doc(owner,'profiles','teacher'),{active:false}));await assertFails(getDoc(doc(teacher,'teachingAssignments',ref.id)));await assertSucceeds(updateDoc(doc(owner,'profiles','teacher'),{active:true}));await assertSucceeds(updateDoc(ref,{active:false}));});

test('course roster and submission boundaries',async()=>{const admin=db('admin'),teacher=db('teacher'),other=db('candidate');await assertSucceeds(setDoc(doc(admin,'subjects','ENG2'),{code:'ENG2',name:'English 2',active:true,createdAt:serverTimestamp()}));const base='teacher__R1__ENG2__T1';await assertSucceeds(setDoc(doc(admin,'teachingAssignments',base),{teacherUid:'teacher',roomId:'R1',subjectId:'ENG2',termId:'T1',active:true,createdAt:serverTimestamp()}));const roster=d=>doc(d,'teachingAssignments',base,'roster','S1');await assertFails(setDoc(roster(teacher),{studentId:'S1',name:'Example only',active:true}));await assertSucceeds(setDoc(roster(admin),{studentId:'S1',name:'Example only',active:true}));await assertSucceeds(getDoc(roster(teacher)));await assertFails(getDoc(roster(other)));const work=d=>doc(d,'teachingAssignments',base,'work','W1');const payload={title:'Test work',maxScore:10,createdBy:'teacher',createdAt:serverTimestamp(),active:true};await assertFails(setDoc(work(other),{...payload,createdBy:'candidate'}));await assertSucceeds(setDoc(work(teacher),payload));const sub=(d,id='S1')=>doc(d,'teachingAssignments',base,'work','W1','submissions',id);const result={studentId:'S1',submitted:true,score:10,updatedBy:'teacher',updatedAt:serverTimestamp()};await assertFails(setDoc(sub(teacher),{...result,score:11}));await assertFails(setDoc(sub(teacher,'unknown'),{...result,studentId:'unknown'}));await assertFails(setDoc(sub(other),{...result,updatedBy:'candidate'}));await assertSucceeds(setDoc(sub(teacher),result));await assertFails(getDoc(sub(other)));await assertSucceeds(getDoc(sub(admin)));await assertSucceeds(updateDoc(doc(admin,'teachingAssignments',base),{active:false}));await assertFails(setDoc(sub(teacher),{...result,score:9}));});

test('admin can teach under same UID; profile name changes cannot elevate privileges',async()=>{const owner=db('owner'),admin=db('admin'),teacher=db('teacher');await assertSucceeds(updateDoc(doc(owner,'profiles','owner'),{name:'Owner Teacher'}));await assertSucceeds(updateDoc(doc(teacher,'profiles','teacher'),{name:'Teacher Name'}));await assertFails(updateDoc(doc(teacher,'profiles','teacher'),{name:'Fake',role:'admin'}));const payload={teacherUid:'owner',roomId:'R1',subjectId:'ENG',termId:'T1',active:true,createdAt:serverTimestamp()};await assertFails(setDoc(doc(admin,'teachingAssignments','owner__R1__ENG__T1'),payload));await assertSucceeds(setDoc(doc(owner,'teachingAssignments','owner__R1__ENG__T1'),payload));await assertSucceeds(setDoc(doc(admin,'teachingAssignments','admin__R1__ENG__T1'),{...payload,teacherUid:'admin'}));});
test('grade edits and cancellation require matching immutable audit record',async()=>{const owner=db('owner'),teacher=db('teacher'),base='owner__R1__ENG__T1';await assertSucceeds(setDoc(doc(owner,'teachingAssignments',base,'roster','S1'),{studentId:'S1',name:'Example only',active:true}));await assertSucceeds(setDoc(doc(owner,'teachingAssignments',base,'work','W1'),{title:'Grade test',maxScore:10,createdBy:'owner',createdAt:serverTimestamp(),active:true}));const ref=doc(owner,'teachingAssignments',base,'work','W1','submissions','S1');const initial={studentId:'S1',score:8,submitted:true,updatedBy:'owner',updatedAt:serverTimestamp()};await assertSucceeds(setDoc(ref,initial));await assertFails(updateDoc(ref,{score:9,updatedAt:serverTimestamp()}));const h=doc(ref,'history','h1');const audit={beforeScore:8,beforeSubmitted:true,afterScore:9,afterSubmitted:true,actor:'owner',at:serverTimestamp()};await assertFails(setDoc(h,audit));let batch=writeBatch(owner);batch.set(h,audit);batch.set(ref,{...initial,score:9,auditId:'h1',updatedAt:serverTimestamp()});await assertSucceeds(batch.commit());await assertFails(updateDoc(h,{afterScore:10}));await assertFails(getDoc(doc(teacher,'teachingAssignments',base,'work','W1','submissions','S1','history','h1')));batch=writeBatch(owner);batch.set(doc(ref,'history','h2'),{beforeScore:9,beforeSubmitted:true,afterScore:null,afterSubmitted:false,actor:'owner',at:serverTimestamp()});batch.set(ref,{...initial,score:null,submitted:false,auditId:'h2',updatedAt:serverTimestamp()});await assertSucceeds(batch.commit());await assertFails(updateDoc(ref,{score:9,submitted:true,auditId:'h1',updatedAt:serverTimestamp()}));});

test('legacy archive is owner-only, immutable and bounds scores',async()=>{const owner=db('owner'),admin=db('admin'),teacher=db('teacher'),cid='owner__R1__ENG__T1';const ref=d=>doc(d,'legacyArchives',cid,'assignments','a123');const header={title:'Legacy',maxScore:10,due:'',level:'M2',room:'5',subject:'ENG',studentCount:1,recordCount:1,createdBy:'owner',createdAt:serverTimestamp()};await assertFails(setDoc(ref(admin),{...header,createdBy:'admin'}));await assertSucceeds(setDoc(ref(owner),header));await assertFails(getDoc(ref(teacher)));await assertFails(getDoc(ref(admin)));await assertFails(updateDoc(ref(owner),{maxScore:20}));const child=d=>doc(ref(d),'students','S1');const row={name:'Example only',level:'M2',room:'5',subject:'ENG',no:'1',record:{studentId:'S1',submitted:true,score:0,status:'submitted',note:'original',originalTs:123}};await assertFails(setDoc(child(owner),{...row,record:{...row.record,score:11}}));await assertFails(setDoc(child(admin),row));await assertSucceeds(setDoc(child(owner),row));await assertSucceeds(getDoc(child(owner)));await assertFails(getDoc(child(teacher)));await assertFails(updateDoc(child(owner),{name:'changed'}));});

test('staged legacy import requires owner and exact archive; activation locks import and audit preserves original',async()=>{const owner=db('owner'),teacher=db('teacher'),admin=db('admin'),cid='owner__R1__ENG__T1',wid='legacy_a123';const work=d=>doc(d,'teachingAssignments',cid,'work',wid),sub=d=>doc(work(d),'submissions','S1');const payload={title:'Legacy',maxScore:10,legacyId:'a123',legacyDue:'',createdBy:'owner',createdAt:serverTimestamp(),active:false,importPending:true};await assertFails(setDoc(work(admin),{...payload,createdBy:'admin'}));await assertSucceeds(setDoc(work(owner),payload));const legacy={studentId:'S1',submitted:true,score:0,status:'submitted',note:'original',originalTs:123};const row={studentId:'S1',score:0,submitted:true,legacy,updatedBy:'owner',updatedAt:serverTimestamp()};await assertFails(setDoc(sub(owner),{...row,score:1}));await assertFails(setDoc(sub(teacher),{...row,updatedBy:'teacher'}));await assertSucceeds(setDoc(sub(owner),row));await assertFails(updateDoc(work(admin),{active:true,importPending:false}));await assertSucceeds(updateDoc(work(owner),{active:true,importPending:false}));await assertFails(setDoc(sub(owner),row));const history=doc(sub(owner),'history','legacyEdit');let batch=writeBatch(owner);batch.set(history,{beforeScore:0,beforeSubmitted:true,afterScore:2,afterSubmitted:true,actor:'owner',at:serverTimestamp()});batch.set(sub(owner),{...row,score:2,legacy:{...legacy,note:'changed'},auditId:'legacyEdit',updatedAt:serverTimestamp()});await assertFails(batch.commit());batch=writeBatch(owner);batch.set(history,{beforeScore:0,beforeSubmitted:true,afterScore:2,afterSubmitted:true,actor:'owner',at:serverTimestamp()});batch.set(sub(owner),{...row,score:2,auditId:'legacyEdit',updatedAt:serverTimestamp()});await assertSucceeds(batch.commit());});

test('LINE rate slots are create-only, current and account scoped',async()=>{const owner=db('owner'),teacher=db('teacher');const bucket=Math.floor(Date.now()/30000);const slot=(d,uid,n)=>doc(d,'lineRate',uid,'slots',String(n));await assertFails(setDoc(slot(teacher,'owner',bucket),{uid:'owner',bucket}));await assertFails(setDoc(slot(owner,'owner',bucket-10),{uid:'owner',bucket:bucket-10}));await assertFails(setDoc(slot(owner,'owner',bucket+10),{uid:'owner',bucket:bucket+10}));const current=Math.floor(Date.now()/30000);await assertSucceeds(setDoc(slot(owner,'owner',current),{uid:'owner',bucket:current}));await assertFails(setDoc(slot(owner,'owner',current),{uid:'owner',bucket:current}));await assertFails(getDoc(slot(owner,'owner',current)));});

test('portal projections remain inaccessible directly under the current release rules', async () => {
  const uid = 'synthetic-portal-student';
  const projection = { uid, role: 'student', active: true, studentId: 'synthetic-student', results: [] };
  await env.withSecurityRulesDisabled((context) =>
    setDoc(doc(context.firestore(), 'portalViews', uid), projection),
  );
  for (const client of [env.unauthenticatedContext().firestore(), db(uid), db('other-portal-user'), db('owner')]) {
    await assertFails(getDoc(doc(client, 'portalViews', uid)));
    await assertFails(getDocs(collection(client, 'portalViews')));
    await assertFails(setDoc(doc(client, 'portalViews', uid), { ...projection, active: false }));
  }
});

test('advisor scope, deadline and attendance writes are separated from scoring',async()=>{
 const owner=db('owner'),teacher=db('teacher'),other=db('candidate'),admin=db('admin');
 const cid='teacher__R1__ENG2__T1',wid='trackingW',student='S1';
 await env.withSecurityRulesDisabled(async c=>{const d=c.firestore();await updateDoc(doc(d,'teachingAssignments',cid),{active:true});await setDoc(doc(d,'rooms','R2'),{code:'R2',name:'R2',active:true});await setDoc(doc(d,'teachingAssignments','outsideTracking'),{teacherUid:'teacher',roomId:'R2',subjectId:'ENG2',termId:'T1',active:true});});
 const work=d=>doc(d,'teachingAssignments',cid,'work',wid),att=d=>doc(work(d),'attendance',student),sub=d=>doc(work(d),'submissions',student),grant=d=>doc(d,'advisorAssignments','candidate','rooms','R1');
 await assertSucceeds(setDoc(work(teacher),{title:'Tracking',maxScore:10,active:true,createdBy:'teacher',createdAt:serverTimestamp()}));
 const due=Timestamp.fromMillis(100000),later=Timestamp.fromMillis(200000);
 const changes={deadline:due,revisionDeadline:later,deadlineUpdatedBy:'teacher',deadlineUpdatedAt:serverTimestamp()};
 await assertFails(updateDoc(work(teacher),{...changes,revisionDeadline:Timestamp.fromMillis(0)}));
 await assertSucceeds(updateDoc(work(teacher),changes));await assertFails(updateDoc(work(other),{...changes,deadlineUpdatedBy:'candidate'}));
 const payload={studentId:student,status:'leave',updatedBy:'teacher',updatedAt:serverTimestamp()};
 await assertSucceeds(setDoc(att(teacher),payload));await assertFails(setDoc(att(other),{...payload,updatedBy:'candidate'}));await assertFails(setDoc(att(teacher),{...payload,status:'bad'}));
 await assertFails(getDoc(work(other)));await assertFails(setDoc(grant(other),{roomId:'R1',active:true,updatedBy:'candidate',updatedAt:serverTimestamp()}));
 await assertFails(setDoc(grant(admin),{roomId:'R1',active:true,updatedBy:'admin',updatedAt:serverTimestamp()}));
 await assertSucceeds(setDoc(grant(owner),{roomId:'R1',active:true,updatedBy:'owner',updatedAt:serverTimestamp()}));
 await assertSucceeds(getDoc(work(other)));await assertSucceeds(getDoc(att(other)));await assertSucceeds(getDocs(query(collection(other,'teachingAssignments'),where('roomId','==','R1'),where('active','==',true))));
 await assertFails(getDoc(doc(other,'teachingAssignments','outsideTracking')));await assertFails(setDoc(att(other),{...payload,updatedBy:'candidate'}));
 await assertFails(setDoc(sub(other),{studentId:student,submitted:true,score:10,updatedBy:'candidate',updatedAt:serverTimestamp()}));
 await assertSucceeds(setDoc(sub(teacher),{studentId:student,submitted:true,score:0,updatedBy:'teacher',updatedAt:serverTimestamp()}));
 await assertSucceeds(getDoc(sub(other)));await assertFails(setDoc(att(teacher),payload));
 await assertSucceeds(setDoc(grant(owner),{roomId:'R1',active:false,updatedBy:'owner',updatedAt:serverTimestamp()}));await assertFails(getDoc(work(other)));
});

test('student identities cannot read or forge bindings, enrollments or another student projection while gated',async()=>{
 const a='synthetic-a',b='synthetic-b';
 await env.withSecurityRulesDisabled(async c=>{
  for(const uid of [a,b]){
   await setDoc(doc(c.firestore(),'studentBindings',uid),{uid,studentId:uid,active:true});
   await setDoc(doc(c.firestore(),'portalViews',uid),{uid,studentId:uid,role:'student',active:true,results:[]});
  }
  await setDoc(doc(c.firestore(),'studentEnrollments','synthetic-enrollment'),{studentId:b,termId:'demo',roomId:'demo',no:1});
 });
 for(const uid of [a,b]){
  const d=db(uid);
  for(const target of [a,b]){
   await assertFails(getDoc(doc(d,'studentBindings',target)));
   await assertFails(getDoc(doc(d,'portalViews',target)));
   await assertFails(setDoc(doc(d,'studentBindings',target),{uid,studentId:target,active:true}));
  }
  await assertFails(getDoc(doc(d,'studentEnrollments','synthetic-enrollment')));
  await assertFails(getDocs(collection(d,'studentEnrollments')));
  await assertFails(getDocs(collection(d,'students')));
 }
});

test('student projection is default-off, own-only, read-only and revocable',async()=>{
 const path=['studentPortalViews','portal-u1','terms','T1','works','W1'];
 const seed=async(fn)=>env.withSecurityRulesDisabled(c=>fn(c.firestore()));
 await seed(async d=>{
  await setDoc(doc(d,...path),{title:'Synthetic',score:0});
  await setDoc(doc(d,'studentPortalBindings','portal-u1'),{studentId:'portal-s1',active:true});
  await setDoc(doc(d,'studentPortalOwners','portal-s1'),{uid:'portal-u1'});
 });
 const own=db('portal-u1'),other=db('portal-u2');
 await assertFails(getDoc(doc(own,...path)));
 await seed(d=>setDoc(doc(d,'portalConfig','student'),{enabled:true}));
 try{
  await assertSucceeds(getDoc(doc(own,...path)));
  await assertSucceeds(getDocs(collection(own,...path.slice(0,-1))));
  await assertFails(getDoc(doc(other,...path)));
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(),...path)));
  await assertFails(updateDoc(doc(own,...path),{score:10}));
  await assertFails(setDoc(doc(other,'studentPortalBindings','portal-u2'),{studentId:'portal-s1',active:true}));
  await assertFails(getDoc(doc(own,'studentPortalBindings','portal-u1')));
  await seed(d=>updateDoc(doc(d,'studentPortalOwners','portal-s1'),{uid:'portal-u2'}));
  await assertFails(getDoc(doc(own,...path)));
  await seed(async d=>{await updateDoc(doc(d,'studentPortalOwners','portal-s1'),{uid:'portal-u1'});await updateDoc(doc(d,'studentPortalBindings','portal-u1'),{active:false})});
  await assertFails(getDoc(doc(own,...path)));
 }finally{await seed(d=>setDoc(doc(d,'portalConfig','student'),{enabled:false}))}
});
