import assert from 'node:assert/strict';
import {test} from 'node:test';
import {StudentSyncForbidden,syncPublishedStudentWork} from '../lib/student-auto-sync.ts';
import {privateRankBand,projectedCourseId} from '../lib/student-private-rank.ts';
import {readTeacherSource} from '../lib/student-source-reader.ts';

const course='assignment_1';
const student='TEST001';
const work='test_1';
const base='teachingAssignments/'+course;
const source=base+'/work/'+work;
const term='studentPortalViews/student-uid/terms/term';
const projected=term+'/works/12_assignment_1_test_1';

function fakeDb(overrides={}) {
  const rows = {
    'portalConfig/student':{enabled:true},
    'profiles/teacher':{role:'teacher',active:true},
    [base]:{teacherUid:'teacher',termId:'term',subjectId:'subject',active:true},
    [source]:{active:true,title:'Quiz',maxScore:20},
    [base+'/roster/'+student]:{active:true,studentId:student},
    ['students/'+student]:{active:true},
    ['studentPortalOwners/'+student]:{uid:'student-uid',studentId:student},
    'studentPortalBindings/student-uid':{uid:'student-uid',studentId:student,active:true},
    [term]:{label:'Term'},
    [projected]:{score:10},
    [source+'/submissions/'+student]:{studentId:student,submitted:true,score:15},
    'subjects/subject':{name:'English'},
    ...overrides,
  };
  const writes=[];
  const reads=[];
  const ref=(path)=>({path,collection:(suffix)=>ref(path+'/'+suffix),doc:(suffix)=>ref(path+'/'+suffix)});
  const get=async ({path})=>{
    assert.equal(writes.length,0,'all transaction reads precede writes');
    reads.push(path);
    return {exists:rows[path]!=null,data:()=>rows[path]};
  };
  const db={doc:ref,collection:ref,runTransaction:run=>run({
    get,getAll:(...refs)=>Promise.all(refs.map(get)),
    set:(target,value)=>writes.push([target.path,value]),
    delete:(target)=>writes.push([target.path,null]),
  })};
  return {db,writes,reads};
}

test('teacher sync updates only the scoped work with the latest score and subject name',async()=>{
  const {db,writes,reads}=fakeDb();
  await syncPublishedStudentWork(db,'teacher',course,work,student);
  assert.ok(reads.includes(term));
  assert.deepEqual(writes,[[projected,{
    id:'12_assignment_1_test_1',title:'Quiz',course:'subject',subjectName:'English',
    maxScore:20,score:15,submitted:true,deadline:null,revisionDeadline:null,
  }]]);
});

test('sync leaves an unpublished or withdrawn term untouched',async()=>{
  const {db,writes,reads}=fakeDb({[term]:null});
  await syncPublishedStudentWork(db,'teacher',course,work,student);
  assert.deepEqual(writes,[]);
  assert.ok(!reads.includes(source+'/submissions/'+student));
});

test('teacher sync refuses a different teacher, a disabled teacher and an advisor-only profile',async()=>{
  const cases=[
    {'profiles/outsider':{role:'teacher',active:true}},
    {'profiles/outsider':{role:'teacher',active:false},[base]:{teacherUid:'outsider',termId:'term',active:true}},
    {'profiles/outsider':{role:'advisor',active:true},[base]:{teacherUid:'outsider',termId:'term',active:true}},
  ];
  for(const overrides of cases){
    const {db,writes}=fakeDb(overrides);
    await assert.rejects(syncPublishedStudentWork(db,'outsider',course,work,student),StudentSyncForbidden);
    assert.deepEqual(writes,[]);
  }
});

test('suspended bindings and inactive rosters cannot be synced',async()=>{
  for (const overrides of [
    {'studentPortalBindings/student-uid':{uid:'student-uid',studentId:student,active:false}},
    {[base+'/roster/'+student]:{active:false,studentId:student}},
  ]) {
    const {db,writes}=fakeDb(overrides);
    await syncPublishedStudentWork(db,'teacher',course,work,student);
    assert.deepEqual(writes,[]);
  }
});

test('attendance can replace a missing status without providing a score',async()=>{
  const {db,writes}=fakeDb({
    [source+'/submissions/'+student]:null,
    [source+'/attendance/'+student]:{studentId:student,status:'leave'},
  });
  await syncPublishedStudentWork(db,'teacher',course,work,student);
  assert.equal(writes[0][1].attendance,'leave');
  assert.equal(writes[0][1].score,null);
});

test('manual publication retains stable subject ids and includes display names',async()=>{
  const rows={
    'terms/term':{name:'Term'},
    'subjects/subject':{name:'ภาษาอังกฤษ'},
    [base+'/roster/'+student]:{active:true,studentId:student},
  };
  const result=await readTeacherSource({
    get:async path=>rows[path]??null,
    listTermCourses:async()=>({complete:true,docs:[{id:course,data:{subjectId:'subject',termId:'term'}}]}),
    listWorks:async()=>({complete:true,docs:[{id:work,data:{title:'Quiz',active:true,maxScore:20}}]}),
    membershipWindows:async()=>undefined,attendance:async()=>undefined,
  },student,'term');
  assert.equal(result.rows[0].course,'subject');
  assert.equal(result.rows[0].subjectName,'ภาษาอังกฤษ');
});

test('comparable cohorts return broad bands and small or fully tied cohorts return no band',()=>{
  assert.equal(privateRankBand(15,[2,4,6,8,9,12,14,15]),null);
  assert.equal(privateRankBand(15,[2,4,6,8,9,12,14,15,18]),'top-quarter');
  assert.equal(privateRankBand(15,[2,4,6,8,9,12,16,18,20]),'top-half');
  assert.equal(privateRankBand(5,[2,4,6,8,9,12,16,18,20]),'lower-half');
  assert.equal(privateRankBand(15,Array(9).fill(15)),null);
  assert.equal(projectedCourseId('12_assignment_1_test_1'),course);
  assert.equal(projectedCourseId('9_assignment_1_test_1'),null);
  assert.equal(projectedCourseId('TEST001'),null);
});
