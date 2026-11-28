import assert from 'node:assert/strict';
import {after, test} from 'node:test';
import {deleteApp, initializeApp} from 'firebase-admin/app';
import {getFirestore, Timestamp} from 'firebase-admin/firestore';
import {changeStudentEnrollment} from '../lib/student-enrollment-server.ts';
import {parseEnrollmentChange} from '../lib/student-enrollment-change.ts';
import {StudentSyncForbidden,syncPublishedStudentWork} from '../lib/student-auto-sync.ts';
import {readPrivateStudentRank,StudentRankForbidden} from '../lib/student-private-rank-server.ts';
import {projectionWorkId} from '../lib/student-source-mapper.ts';
import {readStudentProjectionSource} from '../lib/student-projection-source.ts';

const project = 'demo-gradeflow-enrollment';
if (!/^(127\.0\.0\.1|localhost):[1-9]\d{0,4}$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? '')) {
  throw Error('Enrollment suite requires the loopback Firestore Emulator');
}
const app = initializeApp({projectId: project}, 'enrollment-test');
const db = getFirestore(app);
after(async () => {await db.terminate(); await deleteApp(app)});

test('transfer and promotion update rosters atomically and preserve historical scores', async () => {
  const t1 = 'old-term', t2 = 'new-term', roomA = 'room-a', roomB = 'room-b', roomC = 'room-c';
  const studentId = 'fictional-student', uid = 'fictional-user';
  const base = (term, room) => 'teachingAssignments/' + term + '-' + room;
  const roster = (term, room) => base(term, room) + '/roster/' + studentId;
  const mark = base(t1, roomA) + '/work/early/submissions/' + studentId;
  const markHistory = mark + '/history/first';
  const put = (batch, path, value) => batch.set(db.doc(path), value);
  const read = async path => (await db.doc(path).get()).data();
  const seed = db.batch();
  put(seed, 'portalConfig/student', {enabled: true});
  put(seed, 'students/' + studentId, {name: 'Fictional learner', active: true});
  put(seed, 'studentPortalOwners/' + studentId, {studentId, uid});
  for (const term of [t1, t2]) put(seed, 'terms/' + term, {name: term, active: true});
  for (const room of [roomA, roomB, roomC]) put(seed, 'rooms/' + room, {active: true});
  for (const [term, room] of [[t1, roomA], [t1, roomB], [t2, roomC]]) {
    put(seed, base(term, room), {termId: term, roomId: room, subjectId: 'math', active: true});
  }
  put(seed, roster(t1, roomA), {studentId, name: 'Fictional learner', active: true});
  for (const [term, room, work, time] of [
    [t1, roomA, 'early', 100], [t1, roomA, 'excluded-old', 200],
    [t1, roomB, 'excluded-new', 199], [t1, roomB, 'included-new', 200],
    [t2, roomC, 'future', 400],
  ]) {
    put(seed, base(term, room) + '/work/' + work, {
      title: work, active: true, maxScore: 10, createdAt: Timestamp.fromMillis(time),
    });
  }
  const score = {studentId, submitted: true, score: 0};
  put(seed, mark, score);
  put(seed, markHistory, {score: 0, actor: 'fictional-teacher'});
  const publication = 'studentPortalViews/' + uid + '/terms/' + t1;
  put(seed, publication, {label: t1});
  await seed.commit();

  const transfer = {action: 'transfer', studentId, sourceTermId: t1, sourceRoomId: roomA,
    targetTermId: t1, targetRoomId: roomB, effectiveAt: 200, operationId: 'transfer-001'};
  const change = input => changeStudentEnrollment(db, input, 'fictional-admin');
  assert.deepEqual(parseEnrollmentChange(transfer, 500), transfer);
  assert.equal(parseEnrollmentChange({...transfer, targetTermId: t2}, 500), null);
  assert.equal(parseEnrollmentChange({...transfer, effectiveAt: 501}, 500), null);
  assert.equal((await change(transfer)).status, 409);
  assert.equal((await read(roster(t1, roomA))).active, true);
  assert.equal(await read(roster(t1, roomB)), undefined);
  await db.doc(publication).delete();

  const moved = await change(transfer);
  assert.equal(moved.status, 200);
  assert.deepEqual(moved.body.termsToPublish, [t1]);
  assert.equal((await change(transfer)).body.replayed, true);
  assert.equal((await change({...transfer, effectiveAt: 201})).status, 409);
  assert.equal((await read(roster(t1, roomA))).active, false);
  assert.equal((await read(roster(t1, roomB))).active, true);

  const readSource = termId => readStudentProjectionSource({
    getDocument: async path => (await read(path)) ?? null,
    queryDocuments: async (path, filter, limit) => {
      let query = db.collection(path).limit(limit);
      if (filter) query = query.where(filter.field, '==', filter.value);
      return (await query.get()).docs.map(doc => ({id: doc.id, data: doc.data()}));
    },
  }, studentId, termId);
  const oldResults = (await readSource(t1)).rows.map(row => [row.title, row.score]).sort();
  assert.deepEqual(oldResults, [['early', 0], ['included-new', null]]);

  const promotion = {action: 'promote', studentId, sourceTermId: t1, sourceRoomId: roomB,
    targetTermId: t2, targetRoomId: roomC, effectiveAt: 400, operationId: 'promotion-001'};
  assert.equal((await change(promotion)).status, 200);
  assert.equal((await change({...promotion, operationId: 'promotion-002'})).status, 409);
  assert.equal((await read(roster(t1, roomB))).active, true);
  assert.equal((await read(roster(t2, roomC))).active, true);
  assert.deepEqual((await readSource(t1)).rows.map(row => [row.title, row.score]).sort(), oldResults);
  assert.deepEqual((await readSource(t2)).rows.map(row => row.title), ['future']);
  assert.deepEqual(await read(mark), score);
  assert.deepEqual(await read(markHistory), {score: 0, actor: 'fictional-teacher'});
  const audit = 'studentPortalEnrollments/' + studentId + '/operations/transfer-001';
  assert.deepEqual((await read(audit)).input, transfer);
  const membership = 'studentPortalMemberships/' + studentId + '/terms/' + t1 + '/courses/' + t1 + '-' + roomA;
  assert.equal((await db.collection(membership + '/history').get()).size, 1);
});

test('an authorized sync cannot recreate a term during or after withdrawal', async () => {
  const teacher = 'sync-teacher', sid = 'sync-student', uid = 'sync-user';
  const course = 'sync-course', termId = 'sync-term', workId = 'quiz';
  const base = db.doc('teachingAssignments/'+course);
  const work = base.collection('work').doc(workId);
  const term = db.doc('studentPortalViews/'+uid+'/terms/'+termId);
  const result = term.collection('works').doc(projectionWorkId(course,workId));
  const batch = db.batch();
  for (const [path,data] of [
    ['portalConfig/student',{enabled:true}],
    ['profiles/'+teacher,{role:'teacher',active:true}],
    ['profiles/sync-other',{role:'teacher',active:true}],
    ['students/'+sid,{active:true}],
    ['studentPortalOwners/'+sid,{studentId:sid,uid}],
    ['studentPortalBindings/'+uid,{studentId:sid,uid,active:true}],
    ['subjects/sync-subject',{name:'English'}],
    [base.path,{active:true,subjectId:'sync-subject',termId,teacherUid:teacher}],
    [base.collection('roster').doc(sid).path,{studentId:sid,active:true}],
    [work.path,{active:true,title:'Quiz',maxScore:20}],
    [work.collection('submissions').doc(sid).path,{studentId:sid,score:15,submitted:true}],
  ]) batch.set(db.doc(path),data);
  await batch.commit();
  const sync = actor => syncPublishedStudentWork(db,actor,course,workId,sid);
  await assert.rejects(sync('sync-other'),StudentSyncForbidden);
  await sync(teacher);
  assert.equal((await result.get()).exists,false);

  await term.set({label:'Term'});
  await sync(teacher);
  assert.equal((await result.get()).get('score'),15);
  assert.equal((await result.get()).get('subjectName'),'English');

  const withdraw = db.runTransaction(async tx => {
    const rows = await tx.get(term.collection('works'));
    for (const row of rows.docs) tx.delete(row.ref);
    tx.delete(term);
  });
  await Promise.all([withdraw,sync(teacher)]);
  await sync(teacher);
  assert.equal((await term.get()).exists,false);
  assert.equal((await result.get()).exists,false);
  assert.equal((await work.collection('submissions').doc(sid).get()).get('score'),15);
});

test('rank returns only a band for the requester and suppresses small published cohorts', async () => {
  const termId = 'rank-term', courseId = 'rank-course', workId = projectionWorkId(courseId,'quiz');
  const base = db.doc('teachingAssignments/'+courseId);
  const term = i => db.doc('studentPortalViews/rank-uid-'+i+'/terms/'+termId);
  const batch = db.batch();
  batch.set(base,{termId,active:true});
  batch.set(db.doc('subjects/rank-subject'),{name:'Mathematics'});
  for(let i=0;i<10;i++){
    const sid = 'rank-student-'+i, uid = 'rank-uid-'+i;
    batch.set(base.collection('roster').doc(sid),{studentId:sid,active:true});
    batch.set(db.doc('students/'+sid),{active:true});
    batch.set(db.doc('studentPortalOwners/'+sid),{studentId:sid,uid});
    batch.set(db.doc('studentPortalBindings/'+uid),{studentId:sid,uid,active:true,credentialVersion:'fresh'});
    batch.set(term(i),{label:'Term'});
    batch.set(term(i).collection('works').doc(workId),{
      id:workId,course:'rank-subject',title:'Quiz',maxScore:20,score:i===0?20:i,
      submitted:true,deadline:null,revisionDeadline:null,
    });
  }
  await batch.commit();
  const identity = {uid:'rank-uid-0',firebase:{sign_in_provider:'custom'},auth_time:100,gradeflowStudentSession:'fresh'};
  await assert.rejects(readPrivateStudentRank(db,{...identity,gradeflowStudentSession:'old'},termId,courseId),StudentRankForbidden);
  assert.deepEqual(await readPrivateStudentRank(db,identity,termId),{labels:{'rank-subject':'Mathematics'}});
  assert.deepEqual(await readPrivateStudentRank(db,identity,termId,courseId),{band:'top-quarter'});
  await term(9).delete();
  assert.deepEqual(await readPrivateStudentRank(db,identity,termId,courseId),{band:null});
});
