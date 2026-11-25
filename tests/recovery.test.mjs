import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rehearse} from '../scripts/recovery-emulator.mjs';
const ts={$type:'timestamp',seconds:1700000000,nanoseconds:123456000};
const row=(path,data)=>({path,data});
const cid='T__R__ENG__1',base='teachingAssignments/'+cid,work=base+'/work/W',sub=work+'/submissions/S',archive='legacyArchives/'+cid+'/assignments/A';
const rows=[
 row('profiles/T',{role:'super_admin',active:true}),
 row('students/S',{code:'S',name:'Synthetic student',active:true,createdAt:ts}),
 row('rooms/R',{code:'R',name:'Room',active:true,createdAt:ts}),
 row('subjects/ENG',{code:'ENG',name:'English',active:true,createdAt:ts}),
 row('terms/1',{code:'1',name:'Term',active:true,createdAt:ts}),
 row(base,{teacherUid:'T',roomId:'R',subjectId:'ENG',termId:'1',active:true,createdAt:ts}),
 row(base+'/roster/S',{studentId:'S',name:'Synthetic student',active:true}),
 row(work,{title:'Synthetic assignment',maxScore:10,createdBy:'T',active:true,createdAt:ts}),
 row(sub,{studentId:'S',submitted:true,score:0,updatedBy:'T',updatedAt:ts,auditId:'H'}),
 row(sub+'/history/H',{beforeScore:5,beforeSubmitted:true,afterScore:0,afterSubmitted:true,actor:'T',at:ts}),
 row(archive,{title:'Historical',maxScore:10,studentCount:1,recordCount:1,createdBy:'T',createdAt:ts}),
 row(archive+'/students/S',{name:'Synthetic student',record:{studentId:'S',submitted:false,score:null,status:'leave',note:'Example',originalTs:123}})
];
const backup={format:'gradeflow-firestore-v1',project:'gradeflow-next',rows};
test('restore exact synthetic documents including zero score, timestamp, audit and archive',async()=>{const result=await rehearse(backup);assert.equal(result.verified,rows.length);assert.match(result.projectId,/^demo-gf-recovery-/)});
test('reject malformed backup before writing',async()=>{await assert.rejects(rehearse({...backup,rows:[...rows,rows[0]]}));await assert.rejects(rehearse({...backup,rows:[...rows,row('students/Bad',{createdAt:{$type:'timestamp',seconds:1,nanoseconds:-1}})]}));});
